/**
 * Bulk Complaint Status Sync — fast endpoint for Complaint Checker Extension
 *
 * POST /api/extension/complaint-statuses
 *
 * Receives complaint statuses parsed from WB complaints page.
 * Optimized for speed: 2 bulk SQL queries per request (not per review).
 *
 * Input: reviewKey + Russian status string from WB page.
 * Backend maps statuses and updates reviews + review_complaints in bulk.
 *
 * @version 1.0.0
 * @date 2026-02-20
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db/client';
import { getUserByApiToken } from '@/db/extension-helpers';

// ============================================
// Types
// ============================================

interface ComplaintStatusInput {
  reviewKey: string;   // Format: {nmId}_{rating}_{YYYY-MM-DDTHH:mm}
  status: string;      // Russian string from WB: "Жалоба одобрена", "Жалоба отклонена", etc.
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
    const validItems: { productId: string; rating: number; dateMinute: string; dbStatus: string }[] = [];
    const skipped: { reviewKey: string; reason: string }[] = [];

    for (const item of results) {
      if (!item.reviewKey || !item.status) {
        skipped.push({ reviewKey: item.reviewKey || 'unknown', reason: 'missing fields' });
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

      validItems.push({
        productId: `${storeId}_${parsed.nmId}`,
        rating: parsed.rating,
        dateMinute: parsed.dateMinute,
        dbStatus,
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
    //    Uses unnest arrays to match reviews by (store_id, product_id, rating, date minute)
    const productIds = validItems.map(v => v.productId);
    const ratings = validItems.map(v => v.rating);
    const dateMinutes = validItems.map(v => v.dateMinute);
    const statuses = validItems.map(v => v.dbStatus);

    // DEBUG: log first 3 items to verify matching data
    console.log(`[Extension ComplaintStatuses] 🔍 Debug: first 3 items:`);
    validItems.slice(0, 3).forEach(v =>
      console.log(`  productId=${v.productId}, rating=${v.rating}, dateMinute=${v.dateMinute}, status=${v.dbStatus}`)
    );

    // First, check how many reviews exist (without status filter) for debugging
    const debugMatchResult = await query<{ cnt: string }>(
      `SELECT COUNT(*) as cnt
       FROM reviews r
       JOIN (
         SELECT
           unnest($2::text[]) as product_id,
           unnest($3::int[]) as rating,
           unnest($4::text[]) as date_minute
       ) v ON r.product_id = v.product_id
           AND r.rating = v.rating
           AND to_char(r.date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI') = v.date_minute
       WHERE r.store_id = $1`,
      [storeId, productIds, ratings, dateMinutes]
    );
    const matchedWithoutFilter = parseInt(debugMatchResult.rows[0]?.cnt || '0');
    console.log(`[Extension ComplaintStatuses] 🔍 Debug: matched WITHOUT status filter: ${matchedWithoutFilter}/${validItems.length}`);

    if (matchedWithoutFilter === 0 && validItems.length > 0) {
      // Check if any review exists with these product_ids at all
      const debugProductResult = await query<{ product_id: string; cnt: string }>(
        `SELECT r.product_id, COUNT(*) as cnt
         FROM reviews r
         WHERE r.store_id = $1 AND r.product_id = ANY($2::text[])
         GROUP BY r.product_id
         LIMIT 5`,
        [storeId, [...new Set(productIds.slice(0, 10))]]
      );
      console.log(`[Extension ComplaintStatuses] 🔍 Debug: reviews with matching product_ids:`);
      debugProductResult.rows.forEach(r => console.log(`  ${r.product_id}: ${r.cnt} reviews`));

      // Check a sample date match
      if (validItems.length > 0) {
        const sample = validItems[0];
        const debugDateResult = await query<{ date_raw: string; date_key: string }>(
          `SELECT r.date::text as date_raw,
                  to_char(r.date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI') as date_key
           FROM reviews r
           WHERE r.store_id = $1 AND r.product_id = $2 AND r.rating = $3
           LIMIT 3`,
          [storeId, sample.productId, sample.rating]
        );
        console.log(`[Extension ComplaintStatuses] 🔍 Debug: dates for ${sample.productId} rating=${sample.rating} (ext sends: ${sample.dateMinute}):`);
        debugDateResult.rows.forEach(r => console.log(`  raw=${r.date_raw}, key=${r.date_key}`));
      }
    }

    const bulkUpdateResult = await query<{ id: string; new_status: string }>(
      `UPDATE reviews r
       SET
         complaint_status = v.new_status::complaint_status,
         complaint_text = NULL,
         has_complaint_draft = false,
         has_complaint = true,
         updated_at = NOW()
       FROM (
         SELECT
           unnest($2::text[]) as product_id,
           unnest($3::int[]) as rating,
           unnest($4::text[]) as date_minute,
           unnest($5::text[]) as new_status
       ) v
       WHERE r.store_id = $1
         AND r.product_id = v.product_id
         AND r.rating = v.rating
         AND to_char(r.date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI') = v.date_minute
         AND (r.complaint_status IS NULL OR r.complaint_status IN ('not_sent', 'draft', 'sent', 'pending'))
       RETURNING r.id, v.new_status`,
      [storeId, productIds, ratings, dateMinutes, statuses]
    );

    const reviewsUpdated = bulkUpdateResult.rowCount || 0;
    console.log(`[Extension ComplaintStatuses] 📝 Reviews updated: ${reviewsUpdated}`);

    // 6. BULK UPDATE review_complaints table — set status for all affected reviews
    let complaintsUpdated = 0;
    if (reviewsUpdated > 0) {
      const updatedIds = bulkUpdateResult.rows.map(r => r.id);
      const updatedStatuses = bulkUpdateResult.rows.map(r => r.new_status);

      const rcResult = await query(
        `UPDATE review_complaints rc
         SET
           status = v.new_status,
           updated_at = NOW()
         FROM (
           SELECT
             unnest($1::text[]) as review_id,
             unnest($2::text[]) as new_status
         ) v
         WHERE rc.review_id = v.review_id::uuid
           AND rc.status IN ('draft', 'sent', 'pending')`,
        [updatedIds, updatedStatuses]
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
