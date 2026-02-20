/**
 * Bulk Complaint Status Sync — fast endpoint for Complaint Checker Extension
 *
 * POST /api/extension/complaint-statuses
 *
 * Receives complaint statuses parsed from WB complaints page.
 * Optimized for speed: 2 bulk SQL queries per request (not per review).
 *
 * Input: reviewKey + Russian status string from WB page + filedBy + complaintDate.
 * Backend maps statuses and updates reviews + review_complaints in bulk.
 *
 * @version 1.1.0
 * @date 2026-02-20
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db/client';
import { getUserByApiToken } from '@/db/extension-helpers';

// ============================================
// Types
// ============================================

interface ComplaintStatusInput {
  reviewKey: string;       // Format: {nmId}_{rating}_{YYYY-MM-DDTHH:mm}
  status: string;          // Russian string from WB: "Жалоба одобрена", "Жалоба отклонена", etc.
  filedBy: string;         // "R5" — filed by R5 system, "Продавец" — filed by seller directly
  complaintDate: string | null;  // Date complaint was filed, DD.MM.YYYY format. null if filed by seller
}

interface PostRequestBody {
  storeId: string;
  results: ComplaintStatusInput[];
}

// ============================================
// Status Mapping (WB Russian → DB enum)
// ============================================

const STATUS_MAP: Record<string, string> = {
  'Жалоба одобрена': 'approved',
  'Жалоба отклонена': 'rejected',
  'Проверяем жалобу': 'pending',
  'Жалоба пересмотрена': 'reconsidered',
};

/**
 * Parse reviewKey into components.
 * Format: "{nmId}_{rating}_{YYYY-MM-DDTHH:mm}"
 * Example: "766104062_1_2026-01-15T10:30"
 */
function parseReviewKey(reviewKey: string): { nmId: string; rating: number; dateMinute: string } | null {
  // Split: first part = nmId, second = rating, rest = date
  const firstUnderscore = reviewKey.indexOf('_');
  if (firstUnderscore === -1) return null;

  const nmId = reviewKey.substring(0, firstUnderscore);
  const rest = reviewKey.substring(firstUnderscore + 1);

  const secondUnderscore = rest.indexOf('_');
  if (secondUnderscore === -1) return null;

  const rating = parseInt(rest.substring(0, secondUnderscore));
  const dateMinute = rest.substring(secondUnderscore + 1); // "2026-01-15T10:30"

  if (!nmId || isNaN(rating) || !dateMinute) return null;

  return { nmId, rating, dateMinute };
}

// CORS headers for Chrome Extension
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// ============================================
// POST /api/extension/complaint-statuses
// ============================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('[Extension ComplaintStatuses] 📥 POST request received');

  try {
    // 1. Auth
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' } },
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.substring(7);
    const user = await getUserByApiToken(token);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } },
        { status: 401, headers: corsHeaders }
      );
    }

    // 2. Parse body
    let body: PostRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON in request body' } },
        { status: 400, headers: corsHeaders }
      );
    }

    const { storeId, results } = body;

    if (!storeId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'storeId is required' } },
        { status: 400, headers: corsHeaders }
      );
    }
    if (!results || !Array.isArray(results) || results.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'results must be a non-empty array' } },
        { status: 400, headers: corsHeaders }
      );
    }
    if (results.length > 500) {
      return NextResponse.json(
        { success: false, error: { code: 'LIMIT_EXCEEDED', message: 'Maximum 500 results per request' } },
        { status: 400, headers: corsHeaders }
      );
    }

    // 3. Verify store access
    const storeResult = await query(
      'SELECT id, owner_id FROM stores WHERE id = $1',
      [storeId]
    );
    if (!storeResult.rows[0]) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `Store ${storeId} not found` } },
        { status: 404, headers: corsHeaders }
      );
    }
    if (storeResult.rows[0].owner_id !== user.id) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this store' } },
        { status: 403, headers: corsHeaders }
      );
    }

    // 4. Parse and validate all results, build bulk arrays
    const validItems: {
      productId: string; rating: number; dateMinute: string; dbStatus: string;
      filedBy: string; complaintFiledDate: string | null;
    }[] = [];
    const skipped: { reviewKey: string; reason: string }[] = [];

    for (const item of results) {
      if (!item.reviewKey || !item.status) {
        skipped.push({ reviewKey: item.reviewKey || 'unknown', reason: 'missing fields' });
        continue;
      }

      // filedBy is required
      if (!item.filedBy) {
        skipped.push({ reviewKey: item.reviewKey, reason: 'missing filedBy' });
        continue;
      }

      const dbStatus = STATUS_MAP[item.status];
      if (!dbStatus) {
        skipped.push({ reviewKey: item.reviewKey, reason: `unknown status: "${item.status}"` });
        continue;
      }

      const parsed = parseReviewKey(item.reviewKey);
      if (!parsed) {
        skipped.push({ reviewKey: item.reviewKey, reason: 'invalid reviewKey format' });
        continue;
      }

      // Normalize filedBy: "R5" → "r5", "Продавец" → "seller"
      const filedBy = item.filedBy === 'R5' ? 'r5' : 'seller';

      // Parse complaintDate: "DD.MM.YYYY" → "YYYY-MM-DD" (ISO for PostgreSQL DATE)
      let complaintFiledDate: string | null = null;
      if (item.complaintDate) {
        const parts = item.complaintDate.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
        if (parts) {
          complaintFiledDate = `${parts[3]}-${parts[2]}-${parts[1]}`; // YYYY-MM-DD
        }
      }

      validItems.push({
        productId: `${storeId}_${parsed.nmId}`,
        rating: parsed.rating,
        dateMinute: parsed.dateMinute,
        dbStatus,
        filedBy,
        complaintFiledDate,
      });
    }

    if (validItems.length === 0) {
      return NextResponse.json({
        success: true,
        data: { received: results.length, updated: 0, complaintsUpdated: 0, skipped: skipped.length },
        skipped: skipped.slice(0, 20),
        elapsed: Date.now() - startTime,
      }, { headers: corsHeaders });
    }

    // 5. BULK UPDATE reviews table — one query for all items
    //    Uses unnest arrays to match reviews by (store_id, product_id, rating, date minute in MSK)
    //    Extension sends dates as shown on WB (Moscow time), so we convert DB dates to MSK for matching
    //    Idempotent: updates complaint_status + filed_by + filed_date even for already-processed reviews
    const productIds = validItems.map(v => v.productId);
    const ratings = validItems.map(v => v.rating);
    const dateMinutes = validItems.map(v => v.dateMinute);
    const statuses = validItems.map(v => v.dbStatus);
    const filedBys = validItems.map(v => v.filedBy);
    const filedDates = validItems.map(v => v.complaintFiledDate);

    const bulkUpdateResult = await query<{ id: string; new_status: string; filed_by: string; filed_date: string | null }>(
      `UPDATE reviews r
       SET
         complaint_status = v.new_status::complaint_status,
         complaint_filed_by = v.filed_by,
         complaint_filed_date = v.filed_date::date,
         has_complaint_draft = false,
         has_complaint = true,
         updated_at = NOW()
       FROM (
         SELECT
           unnest($2::text[]) as product_id,
           unnest($3::int[]) as rating,
           unnest($4::text[]) as date_minute,
           unnest($5::text[]) as new_status,
           unnest($6::text[]) as filed_by,
           unnest($7::text[]) as filed_date
       ) v
       WHERE r.store_id = $1
         AND r.product_id = v.product_id
         AND r.rating = v.rating
         AND to_char(r.date AT TIME ZONE 'Europe/Moscow', 'YYYY-MM-DD"T"HH24:MI') = v.date_minute
       RETURNING r.id, v.new_status, v.filed_by, v.filed_date`,
      [storeId, productIds, ratings, dateMinutes, statuses, filedBys, filedDates]
    );

    const reviewsUpdated = bulkUpdateResult.rowCount || 0;
    console.log(`[Extension ComplaintStatuses] 📝 Reviews updated: ${reviewsUpdated}`);

    // 6. BULK UPDATE review_complaints table — set status + filed_by + filed_date
    let complaintsUpdated = 0;
    if (reviewsUpdated > 0) {
      const updatedIds = bulkUpdateResult.rows.map(r => r.id);
      const updatedStatuses = bulkUpdateResult.rows.map(r => r.new_status);
      const updatedFiledBys = bulkUpdateResult.rows.map(r => r.filed_by);
      const updatedFiledDates = bulkUpdateResult.rows.map(r => r.filed_date);

      const rcResult = await query(
        `UPDATE review_complaints rc
         SET
           status = v.new_status,
           filed_by = v.filed_by,
           complaint_filed_date = v.filed_date::date,
           moderated_at = COALESCE(rc.moderated_at, NOW()),
           updated_at = NOW()
         FROM (
           SELECT
             unnest($1::text[]) as review_id,
             unnest($2::text[]) as new_status,
             unnest($3::text[]) as filed_by,
             unnest($4::text[]) as filed_date
         ) v
         WHERE rc.review_id = v.review_id`,
        [updatedIds, updatedStatuses, updatedFiledBys, updatedFiledDates]
      );
      complaintsUpdated = rcResult.rowCount || 0;
      console.log(`[Extension ComplaintStatuses] 📝 Review complaints updated: ${complaintsUpdated}`);
    }

    const elapsed = Date.now() - startTime;

    console.log(
      `[Extension ComplaintStatuses] ✅ Done in ${elapsed}ms: ` +
      `received=${results.length}, valid=${validItems.length}, ` +
      `reviewsUpdated=${reviewsUpdated}, complaintsUpdated=${complaintsUpdated}, ` +
      `skipped=${skipped.length}`
    );

    // 7. Response
    return NextResponse.json({
      success: true,
      data: {
        received: results.length,
        valid: validItems.length,
        reviewsUpdated,
        complaintsUpdated,
        skipped: skipped.length,
      },
      ...(skipped.length > 0 ? { skippedDetails: skipped.slice(0, 20) } : {}),
      elapsed,
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('[Extension ComplaintStatuses] ❌ Error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: error.message || 'Internal server error' } },
      { status: 500, headers: corsHeaders }
    );
  }
}
