/**
 * Extension Review Statuses Sync Endpoint
 *
 * POST /api/extension/review-statuses - Receive review statuses from Extension
 * GET  /api/extension/review-statuses - Get stored statuses (for testing)
 *
 * Purpose: Sync review statuses parsed by Chrome Extension from WB seller cabinet.
 * This allows Backend to filter reviews before GPT complaint generation,
 * saving ~80% of GPT tokens.
 *
 * @version 1.0.0
 * @date 2026-02-01
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db/client';
import { getUserByApiToken } from '@/db/extension-helpers';

// ============================================
// Types
// ============================================

interface ReviewStatusInput {
  reviewKey: string;        // Format: {productId}_{rating}_{datetime without seconds}
  productId: string;        // WB product ID (nmId)
  rating: number;           // 1-5
  reviewDate: string;       // ISO 8601 datetime
  statuses: string[];       // Array of status strings from WB
  canSubmitComplaint: boolean;
}

interface PostRequestBody {
  storeId: string;
  parsedAt: string;         // ISO 8601 datetime
  reviews: ReviewStatusInput[];
}

// ============================================
// Status Mapping
// ============================================

// WB status → complaint_status ENUM
// ENUM values: not_sent, draft, sent, approved, rejected, pending, reconsidered
const COMPLAINT_STATUS_MAP: Record<string, string> = {
  'Жалоба отклонена': 'rejected',   // not 'declined'!
  'Жалоба одобрена': 'approved',
  'Проверяем жалобу': 'pending',
  'Жалоба пересмотрена': 'reconsidered'
};

// All complaint statuses that should clear drafts
const COMPLAINT_STATUSES = Object.keys(COMPLAINT_STATUS_MAP);

/**
 * Get complaint_status from array of WB statuses
 * Priority: reconsidered > rejected > approved > pending
 */
function getComplaintStatusFromStatuses(statuses: string[]): string | null {
  if (statuses.includes('Жалоба пересмотрена')) return 'reconsidered';
  if (statuses.includes('Жалоба отклонена')) return 'rejected';  // ENUM value is 'rejected'
  if (statuses.includes('Жалоба одобрена')) return 'approved';
  if (statuses.includes('Проверяем жалобу')) return 'pending';
  return null;
}

/**
 * Check if any complaint status is present
 */
function hasAnyComplaintStatus(statuses: string[]): boolean {
  return statuses.some(s => COMPLAINT_STATUSES.includes(s));
}

// ============================================
// POST /api/extension/review-statuses
// ============================================

/**
 * Receive review statuses from Chrome Extension
 *
 * Request Body:
 * {
 *   "storeId": "7kKX9WgLvOPiXYIHk6hi",
 *   "parsedAt": "2026-02-01T12:00:00.000Z",
 *   "reviews": [
 *     {
 *       "reviewKey": "649502497_1_2026-01-07T20:09",
 *       "productId": "649502497",
 *       "rating": 1,
 *       "reviewDate": "2026-01-07T20:09:37.000Z",
 *       "statuses": ["Жалоба отклонена", "Выкуп"],
 *       "canSubmitComplaint": false
 *     }
 *   ]
 * }
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": { "received": 20, "created": 15, "updated": 5, "errors": 0 },
 *   "message": "Статусы успешно синхронизированы"
 * }
 */
export async function POST(request: NextRequest) {
  console.log('[Extension ReviewStatuses] 📥 POST request received');

  try {
    // 1. Authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' }
        },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const user = await getUserByApiToken(token);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Invalid token' }
        },
        { status: 401 }
      );
    }

    // 2. Parse and validate request body
    let body: PostRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'INVALID_JSON', message: 'Invalid JSON in request body' }
        },
        { status: 400 }
      );
    }

    const { storeId, parsedAt, reviews } = body;

    // Validate required fields
    if (!storeId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'storeId is required' }
        },
        { status: 400 }
      );
    }

    if (!parsedAt) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'parsedAt is required' }
        },
        { status: 400 }
      );
    }

    if (!reviews || !Array.isArray(reviews)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'reviews must be an array' }
        },
        { status: 400 }
      );
    }

    // Limit: max 100 reviews per request
    if (reviews.length > 100) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'LIMIT_EXCEEDED', message: 'Maximum 100 reviews per request' }
        },
        { status: 400 }
      );
    }

    console.log(`[Extension ReviewStatuses] 📋 Processing ${reviews.length} reviews for store ${storeId}`);

    // 3. Verify store exists and user has access
    const storeResult = await query(
      'SELECT id, owner_id FROM stores WHERE id = $1',
      [storeId]
    );

    if (!storeResult.rows[0]) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: `Store ${storeId} not found` }
        },
        { status: 404 }
      );
    }

    if (storeResult.rows[0].owner_id !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'You do not have access to this store' }
        },
        { status: 403 }
      );
    }

    // 4. UPSERT reviews into database
    let created = 0;
    let updated = 0;
    let errors = 0;
    const errorDetails: { reviewKey: string; error: string }[] = [];

    for (const review of reviews) {
      try {
        // Validate review fields
        if (!review.reviewKey || !review.productId || !review.rating || !review.reviewDate) {
          errors++;
          errorDetails.push({
            reviewKey: review.reviewKey || 'unknown',
            error: 'Missing required fields'
          });
          continue;
        }

        // Validate rating
        if (review.rating < 1 || review.rating > 5) {
          errors++;
          errorDetails.push({
            reviewKey: review.reviewKey,
            error: `Invalid rating: ${review.rating}`
          });
          continue;
        }

        // UPSERT query
        const result = await query(
          `INSERT INTO review_statuses_from_extension
            (review_key, store_id, product_id, rating, review_date, statuses, can_submit_complaint, parsed_at)
          VALUES
            ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (review_key, store_id)
          DO UPDATE SET
            statuses = EXCLUDED.statuses,
            can_submit_complaint = EXCLUDED.can_submit_complaint,
            parsed_at = EXCLUDED.parsed_at,
            updated_at = CURRENT_TIMESTAMP
          RETURNING (xmax = 0) as is_insert`,
          [
            review.reviewKey,
            storeId,
            review.productId,
            review.rating,
            review.reviewDate,
            JSON.stringify(review.statuses || []),
            review.canSubmitComplaint ?? true,
            parsedAt
          ]
        );

        if (result.rows[0]?.is_insert) {
          created++;
        } else {
          updated++;
        }
      } catch (err: any) {
        errors++;
        errorDetails.push({
          reviewKey: review.reviewKey,
          error: err.message
        });
        console.error(`[Extension ReviewStatuses] ❌ Error processing review ${review.reviewKey}:`, err.message);
      }
    }

    console.log(`[Extension ReviewStatuses] ✅ Processed: created=${created}, updated=${updated}, errors=${errors}`);

    // 5. Sync statuses to reviews table
    let synced = 0;
    let syncErrors = 0;
    const syncErrorDetails: { reviewKey: string; error: string }[] = [];

    for (const review of reviews) {
      // Skip if no statuses or missing required fields
      if (!review.statuses || !review.productId || !review.rating || !review.reviewDate) {
        continue;
      }

      // Check if review has any complaint status
      if (!hasAnyComplaintStatus(review.statuses)) {
        continue; // No complaint status, nothing to sync
      }

      try {
        const complaintStatus = getComplaintStatusFromStatuses(review.statuses);
        if (!complaintStatus) continue;

        // Build product_id in reviews table format: {store_id}_{wb_product_id}
        const reviewsProductId = `${storeId}_${review.productId}`;

        // Update reviews table:
        // - Set complaint_status
        // - Clear draft (complaint_text = NULL)
        // - Set has_complaint_draft = false
        // - Set has_complaint = true (complaint was submitted)
        const syncResult = await query(
          `UPDATE reviews
           SET
             complaint_status = $1::complaint_status,
             complaint_text = NULL,
             has_complaint_draft = false,
             has_complaint = true,
             updated_at = NOW()
           WHERE
             store_id = $2
             AND product_id = $3
             AND rating = $4
             AND DATE_TRUNC('minute', date) = DATE_TRUNC('minute', $5::timestamptz)
             AND (complaint_status = 'not_sent' OR complaint_status IS NULL)
           RETURNING id`,
          [complaintStatus, storeId, reviewsProductId, review.rating, review.reviewDate]
        );

        if (syncResult.rowCount && syncResult.rowCount > 0) {
          synced++;
          console.log(`[Extension ReviewStatuses] 🔄 Synced review ${review.reviewKey} → ${complaintStatus}`);
        }
      } catch (err: any) {
        syncErrors++;
        syncErrorDetails.push({
          reviewKey: review.reviewKey,
          error: err.message
        });
        console.error(`[Extension ReviewStatuses] ❌ Sync error for ${review.reviewKey}:`, err.message);
      }
    }

    console.log(`[Extension ReviewStatuses] 🔄 Sync complete: synced=${synced}, syncErrors=${syncErrors}`);

    // 6. Return response
    const response: any = {
      success: true,
      data: {
        received: reviews.length,
        created,
        updated,
        errors,
        // Sync to reviews table
        synced,
        syncErrors
      },
      message: 'Статусы успешно синхронизированы'
    };

    // Include error details if any
    if (errorDetails.length > 0) {
      response.data.errorDetails = errorDetails.slice(0, 10); // Limit to first 10 errors
    }
    if (syncErrorDetails.length > 0) {
      response.data.syncErrorDetails = syncErrorDetails.slice(0, 10);
    }

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('[Extension ReviewStatuses] ❌ Unexpected error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Internal server error'
        }
      },
      { status: 500 }
    );
  }
}

// ============================================
// GET /api/extension/review-statuses
// ============================================

/**
 * Get stored review statuses (for testing and verification)
 *
 * Query Parameters:
 *   - storeId: string (required) - Store ID
 *   - limit: number (default: 50, max: 100)
 *   - canSubmit: 'true' | 'false' | 'all' (default: 'all')
 *
 * Response 200:
 * {
 *   "success": true,
 *   "data": {
 *     "total": 1500,
 *     "reviews": [...],
 *     "stats": { "canSubmit": 300, "cannotSubmit": 1200 }
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  console.log('[Extension ReviewStatuses] 📤 GET request received');

  try {
    // 1. Authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' }
        },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const user = await getUserByApiToken(token);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Invalid token' }
        },
        { status: 401 }
      );
    }

    // 2. Parse query parameters
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const canSubmitFilter = searchParams.get('canSubmit') || 'all';

    if (!storeId) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'storeId query parameter is required' }
        },
        { status: 400 }
      );
    }

    // 3. Verify store exists and user has access
    const storeResult = await query(
      'SELECT id, owner_id FROM stores WHERE id = $1',
      [storeId]
    );

    if (!storeResult.rows[0]) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: `Store ${storeId} not found` }
        },
        { status: 404 }
      );
    }

    if (storeResult.rows[0].owner_id !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'You do not have access to this store' }
        },
        { status: 403 }
      );
    }

    // 4. Build query based on filter
    let whereClause = 'store_id = $1';
    const queryParams: any[] = [storeId];

    if (canSubmitFilter === 'true') {
      whereClause += ' AND can_submit_complaint = true';
    } else if (canSubmitFilter === 'false') {
      whereClause += ' AND can_submit_complaint = false';
    }

    // 5. Get reviews
    const reviewsResult = await query(
      `SELECT
        review_key,
        product_id,
        rating,
        review_date,
        statuses,
        can_submit_complaint,
        parsed_at,
        created_at,
        updated_at
      FROM review_statuses_from_extension
      WHERE ${whereClause}
      ORDER BY parsed_at DESC
      LIMIT $2`,
      [...queryParams, limit]
    );

    // 6. Get stats
    const statsResult = await query(
      `SELECT
        COUNT(*) FILTER (WHERE can_submit_complaint = true) as can_submit,
        COUNT(*) FILTER (WHERE can_submit_complaint = false) as cannot_submit,
        COUNT(*) as total
      FROM review_statuses_from_extension
      WHERE store_id = $1`,
      [storeId]
    );

    const stats = statsResult.rows[0] || { can_submit: 0, cannot_submit: 0, total: 0 };

    console.log(`[Extension ReviewStatuses] ✅ Found ${reviewsResult.rows.length} reviews for store ${storeId}`);

    // 7. Format response
    return NextResponse.json({
      success: true,
      data: {
        total: parseInt(stats.total),
        reviews: reviewsResult.rows.map(row => ({
          reviewKey: row.review_key,
          productId: row.product_id,
          rating: row.rating,
          reviewDate: row.review_date,
          statuses: row.statuses,
          canSubmitComplaint: row.can_submit_complaint,
          parsedAt: row.parsed_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        })),
        stats: {
          canSubmit: parseInt(stats.can_submit),
          cannotSubmit: parseInt(stats.cannot_submit)
        }
      }
    });

  } catch (error: any) {
    console.error('[Extension ReviewStatuses] ❌ Unexpected error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'Internal server error'
        }
      },
      { status: 500 }
    );
  }
}
