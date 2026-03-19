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
 * @version 2.0.0 — Sprint-012: batch UPSERT + batch sync (700 SQL → ~10)
 * @date 2026-03-19
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db/client';
import { getUserByApiToken } from '@/db/extension-helpers';
import { refreshReviewsForStore } from '@/lib/review-sync';
import { closeLinkedChatsForReviews } from '@/db/review-chat-link-helpers';

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
  chatStatus?: string | null; // chat_not_activated | chat_available | chat_opened | null
  ratingExcluded?: boolean;   // WB transparent rating: review excluded from rating calculation
}

interface PostRequestBody {
  storeId: string;
  parsedAt: string;         // ISO 8601 datetime
  reviews: ReviewStatusInput[];
  notFoundReviewKeys?: string[]; // reviewKeys from tasks that extension couldn't find on WB page (possibly deleted)
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

// WB status → review_status_wb ENUM (1:1 mapping with WB)
const REVIEW_STATUS_WB_MAP: Record<string, string> = {
  'Снят с публикации': 'unpublished',          // review removed from public view
  'Временно скрыт': 'temporarily_hidden',       // new WB status — temporarily hidden
  'Исключён из рейтинга': 'excluded',           // review excluded from rating (old WB feature)
};

function getReviewStatusWbFromStatuses(statuses: string[]): string | null {
  for (const status of statuses) {
    if (REVIEW_STATUS_WB_MAP[status]) return REVIEW_STATUS_WB_MAP[status];
  }
  return null;
}

// WB status → product_status_by_review ENUM (purchase/return info)
const PRODUCT_STATUS_MAP: Record<string, string> = {
  'Выкуп': 'purchased',
  'Отказ': 'refused',
  'Возврат': 'returned',
  'Запрошен возврат': 'return_requested',
};

function getProductStatusFromStatuses(statuses: string[]): string | null {
  for (const status of statuses) {
    if (PRODUCT_STATUS_MAP[status]) return PRODUCT_STATUS_MAP[status];
  }
  return null;
}

// Extension chatStatus → DB chat_status_by_review ENUM
const CHAT_STATUS_MAP: Record<string, string> = {
  'chat_not_activated': 'unavailable',
  'chat_available': 'available',
  'chat_opened': 'opened',
};

function mapChatStatus(extensionStatus: string | null | undefined): string | null {
  if (!extensionStatus) return null;
  return CHAT_STATUS_MAP[extensionStatus] || null;
}

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

    const { storeId, parsedAt, reviews, notFoundReviewKeys } = body;

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

    // ════════════════════════════════════════════════════════════════
    // 4. Batch UPSERT to review_statuses_from_extension
    //    Sprint-012: Was 100 individual INSERT...ON CONFLICT → 1 query
    // ════════════════════════════════════════════════════════════════
    const validReviews: ReviewStatusInput[] = [];
    let errors = 0;
    const errorDetails: { reviewKey: string; error: string }[] = [];

    for (const review of reviews) {
      if (!review.reviewKey || !review.productId || !review.rating || !review.reviewDate) {
        errors++;
        errorDetails.push({ reviewKey: review.reviewKey || 'unknown', error: 'Missing required fields' });
        continue;
      }
      if (review.rating < 1 || review.rating > 5) {
        errors++;
        errorDetails.push({ reviewKey: review.reviewKey, error: `Invalid rating: ${review.rating}` });
        continue;
      }
      validReviews.push(review);
    }

    let created = 0;
    let updated = 0;

    if (validReviews.length > 0) {
      // Build parameterized VALUES list (max 100 rows × 10 params = 1000 params)
      const vals: string[] = [];
      const params: any[] = [];
      let idx = 1;
      for (const r of validReviews) {
        vals.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
        params.push(
          r.reviewKey, storeId, r.productId, r.rating, r.reviewDate,
          JSON.stringify(r.statuses || []), r.canSubmitComplaint ?? true,
          r.chatStatus || null, r.ratingExcluded ?? false, parsedAt
        );
      }
      try {
        const upsertResult = await query<{ review_key: string; is_insert: boolean }>(
          `INSERT INTO review_statuses_from_extension
            (review_key, store_id, product_id, rating, review_date, statuses, can_submit_complaint, chat_status, rating_excluded, parsed_at)
           VALUES ${vals.join(', ')}
           ON CONFLICT (review_key, store_id) DO UPDATE SET
             statuses = EXCLUDED.statuses,
             can_submit_complaint = EXCLUDED.can_submit_complaint,
             chat_status = EXCLUDED.chat_status,
             rating_excluded = EXCLUDED.rating_excluded,
             parsed_at = EXCLUDED.parsed_at,
             updated_at = CURRENT_TIMESTAMP
           RETURNING review_key, (xmax = 0) as is_insert`,
          params
        );
        created = upsertResult.rows.filter(r => r.is_insert).length;
        updated = upsertResult.rows.filter(r => !r.is_insert).length;
      } catch (err: any) {
        // Fallback: individual upserts if batch fails (e.g. data type mismatch)
        console.error(`[Extension ReviewStatuses] Batch UPSERT failed, falling back:`, err.message);
        for (const r of validReviews) {
          try {
            const result = await query(
              `INSERT INTO review_statuses_from_extension
                (review_key, store_id, product_id, rating, review_date, statuses, can_submit_complaint, chat_status, rating_excluded, parsed_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
               ON CONFLICT (review_key, store_id) DO UPDATE SET
                 statuses = EXCLUDED.statuses, can_submit_complaint = EXCLUDED.can_submit_complaint,
                 chat_status = EXCLUDED.chat_status, rating_excluded = EXCLUDED.rating_excluded,
                 parsed_at = EXCLUDED.parsed_at, updated_at = CURRENT_TIMESTAMP
               RETURNING (xmax = 0) as is_insert`,
              [r.reviewKey, storeId, r.productId, r.rating, r.reviewDate,
               JSON.stringify(r.statuses || []), r.canSubmitComplaint ?? true,
               r.chatStatus || null, r.ratingExcluded ?? false, parsedAt]
            );
            if (result.rows[0]?.is_insert) created++; else updated++;
          } catch (e: any) {
            errors++;
            errorDetails.push({ reviewKey: r.reviewKey, error: e.message });
          }
        }
      }
    }

    console.log(`[Extension ReviewStatuses] Processed: created=${created}, updated=${updated}, errors=${errors}`);

    // ════════════════════════════════════════════════════════════════
    // 5. Batch sync to reviews table
    //    Sprint-012: Was ~600 individual UPDATEs → ~6-10 batch queries
    // ════════════════════════════════════════════════════════════════
    let synced = 0;
    let chatStatusSynced = 0;
    let syncErrors = 0;
    const syncErrorDetails: { reviewKey: string; error: string }[] = [];
    const unmatchedReviews: { reviewKey: string; productId: string; rating: number; reviewDate: string }[] = [];
    const resolvedReviewIds: string[] = [];

    // Pre-compute batch arrays for each sync type (JS only, no DB calls)
    interface BatchItem { pid: string; rat: number; dt: string }
    const chatBatch: (BatchItem & { status: string; reviewKey: string; originalProductId: string })[] = [];
    const reExcludedTrue: BatchItem[] = [];
    const reExcludedFalse: BatchItem[] = [];
    const rwbBatch: (BatchItem & { status: string })[] = [];
    const psBatch: (BatchItem & { status: string })[] = [];
    const complaintBatch: (BatchItem & { status: string; reviewKey: string })[] = [];

    for (const review of validReviews) {
      const pid = `${storeId}_${review.productId}`;
      const base = { pid, rat: review.rating, dt: review.reviewDate };

      const cs = mapChatStatus(review.chatStatus);
      if (cs) chatBatch.push({ ...base, status: cs, reviewKey: review.reviewKey, originalProductId: review.productId });

      if (review.ratingExcluded === true) reExcludedTrue.push(base);
      else if (review.ratingExcluded === false) reExcludedFalse.push(base);

      if (review.statuses && review.statuses.length > 0) {
        const rwb = getReviewStatusWbFromStatuses(review.statuses);
        if (rwb) rwbBatch.push({ ...base, status: rwb });
        const ps = getProductStatusFromStatuses(review.statuses);
        if (ps) psBatch.push({ ...base, status: ps });
        const cst = getComplaintStatusFromStatuses(review.statuses);
        if (cst) complaintBatch.push({ ...base, status: cst, reviewKey: review.reviewKey });
      }
    }

    // 5a. Batch chat_status_by_review sync (with downgrade protection)
    if (chatBatch.length > 0) {
      try {
        const result = await query<{ id: string }>(
          `UPDATE reviews r
           SET chat_status_by_review = batch.new_status::chat_status_by_review, updated_at = NOW()
           FROM (SELECT unnest($1::text[]) as pid, unnest($2::int[]) as rat,
                        unnest($3::timestamptz[]) as dt, unnest($4::text[]) as new_status) batch
           WHERE r.store_id = $5
             AND r.product_id = batch.pid AND r.rating = batch.rat
             AND DATE_TRUNC('minute', r.date) = DATE_TRUNC('minute', batch.dt)
             AND (r.chat_status_by_review IS NULL OR r.chat_status_by_review != 'opened' OR batch.new_status = 'opened')
           RETURNING r.id`,
          [chatBatch.map(b => b.pid), chatBatch.map(b => b.rat), chatBatch.map(b => b.dt),
           chatBatch.map(b => b.status), storeId]
        );
        chatStatusSynced = result.rows.length;

        // Detect unmatched reviews (not found in DB) — only if some weren't matched
        if (result.rows.length < chatBatch.length) {
          const checkResult = await query<{ pid: string; rat: number; dt: string }>(
            `SELECT batch.pid, batch.rat, batch.dt::text
             FROM (SELECT unnest($1::text[]) as pid, unnest($2::int[]) as rat, unnest($3::timestamptz[]) as dt) batch
             WHERE NOT EXISTS (
               SELECT 1 FROM reviews r
               WHERE r.store_id = $4 AND r.product_id = batch.pid AND r.rating = batch.rat
                 AND DATE_TRUNC('minute', r.date) = DATE_TRUNC('minute', batch.dt)
             )`,
            [chatBatch.map(b => b.pid), chatBatch.map(b => b.rat), chatBatch.map(b => b.dt), storeId]
          );
          const unmatchedKeys = new Set(checkResult.rows.map(r => `${r.pid}_${r.rat}_${r.dt}`));
          for (const b of chatBatch) {
            if (unmatchedKeys.has(`${b.pid}_${b.rat}_${b.dt}`)) {
              unmatchedReviews.push({ reviewKey: b.reviewKey, productId: b.originalProductId, rating: b.rat, reviewDate: b.dt });
            }
          }
        }
      } catch (err: any) {
        console.error(`[Extension ReviewStatuses] Batch chat_status sync error:`, err.message);
      }
    }

    // 5b. Batch rating_excluded sync
    if (reExcludedTrue.length > 0) {
      try {
        const result = await query<{ id: string }>(
          `UPDATE reviews r
           SET rating_excluded = true, updated_at = NOW()
           FROM (SELECT unnest($1::text[]) as pid, unnest($2::int[]) as rat, unnest($3::timestamptz[]) as dt) batch
           WHERE r.store_id = $4
             AND r.product_id = batch.pid AND r.rating = batch.rat
             AND DATE_TRUNC('minute', r.date) = DATE_TRUNC('minute', batch.dt)
             AND r.rating_excluded != true
           RETURNING r.id`,
          [reExcludedTrue.map(b => b.pid), reExcludedTrue.map(b => b.rat), reExcludedTrue.map(b => b.dt), storeId]
        );
        resolvedReviewIds.push(...result.rows.map(r => r.id));
      } catch (err: any) {
        console.error(`[Extension ReviewStatuses] Batch rating_excluded=true sync error:`, err.message);
      }
    }
    if (reExcludedFalse.length > 0) {
      try {
        await query(
          `UPDATE reviews r
           SET rating_excluded = false, updated_at = NOW()
           FROM (SELECT unnest($1::text[]) as pid, unnest($2::int[]) as rat, unnest($3::timestamptz[]) as dt) batch
           WHERE r.store_id = $4
             AND r.product_id = batch.pid AND r.rating = batch.rat
             AND DATE_TRUNC('minute', r.date) = DATE_TRUNC('minute', batch.dt)
             AND r.rating_excluded != false`,
          [reExcludedFalse.map(b => b.pid), reExcludedFalse.map(b => b.rat), reExcludedFalse.map(b => b.dt), storeId]
        );
      } catch (err: any) {
        console.error(`[Extension ReviewStatuses] Batch rating_excluded=false sync error:`, err.message);
      }
    }

    // 5c. Batch review_status_wb sync
    if (rwbBatch.length > 0) {
      try {
        const resolvedWbStatuses = ['excluded', 'unpublished', 'temporarily_hidden', 'deleted'];
        const result = await query<{ id: string; new_status: string }>(
          `UPDATE reviews r
           SET review_status_wb = batch.new_status::review_status_wb, updated_at = NOW()
           FROM (SELECT unnest($1::text[]) as pid, unnest($2::int[]) as rat,
                        unnest($3::timestamptz[]) as dt, unnest($4::text[]) as new_status) batch
           WHERE r.store_id = $5
             AND r.product_id = batch.pid AND r.rating = batch.rat
             AND DATE_TRUNC('minute', r.date) = DATE_TRUNC('minute', batch.dt)
             AND r.review_status_wb::text != batch.new_status
           RETURNING r.id, batch.new_status`,
          [rwbBatch.map(b => b.pid), rwbBatch.map(b => b.rat), rwbBatch.map(b => b.dt),
           rwbBatch.map(b => b.status), storeId]
        );
        for (const r of result.rows) {
          if (resolvedWbStatuses.includes(r.new_status)) resolvedReviewIds.push(r.id);
        }
      } catch (err: any) {
        console.error(`[Extension ReviewStatuses] Batch review_status_wb sync error:`, err.message);
      }
    }

    // 5c2. Batch product_status_by_review sync
    if (psBatch.length > 0) {
      try {
        await query(
          `UPDATE reviews r
           SET product_status_by_review = batch.new_status::product_status_by_review, updated_at = NOW()
           FROM (SELECT unnest($1::text[]) as pid, unnest($2::int[]) as rat,
                        unnest($3::timestamptz[]) as dt, unnest($4::text[]) as new_status) batch
           WHERE r.store_id = $5
             AND r.product_id = batch.pid AND r.rating = batch.rat
             AND DATE_TRUNC('minute', r.date) = DATE_TRUNC('minute', batch.dt)
             AND r.product_status_by_review::text != batch.new_status`,
          [psBatch.map(b => b.pid), psBatch.map(b => b.rat), psBatch.map(b => b.dt),
           psBatch.map(b => b.status), storeId]
        );
      } catch (err: any) {
        console.error(`[Extension ReviewStatuses] Batch product_status sync error:`, err.message);
      }
    }

    // 5d. Batch complaint_status sync + review_complaints update
    if (complaintBatch.length > 0) {
      // Group by complaint status (max 4: rejected, approved, pending, reconsidered)
      const groups = new Map<string, typeof complaintBatch>();
      for (const item of complaintBatch) {
        if (!groups.has(item.status)) groups.set(item.status, []);
        groups.get(item.status)!.push(item);
      }

      for (const [status, items] of Array.from(groups.entries())) {
        try {
          const syncResult = await query<{ id: string }>(
            `UPDATE reviews r
             SET complaint_status = $1::complaint_status,
                 complaint_text = NULL, has_complaint_draft = false, has_complaint = true,
                 updated_at = NOW()
             FROM (SELECT unnest($2::text[]) as pid, unnest($3::int[]) as rat, unnest($4::timestamptz[]) as dt) batch
             WHERE r.store_id = $5
               AND r.product_id = batch.pid AND r.rating = batch.rat
               AND DATE_TRUNC('minute', r.date) = DATE_TRUNC('minute', batch.dt)
               AND (r.complaint_status IN ('not_sent', 'draft') OR r.complaint_status IS NULL)
             RETURNING r.id`,
            [status, items.map((i: any) => i.pid), items.map((i: any) => i.rat), items.map((i: any) => i.dt), storeId]
          );

          if (syncResult.rows.length > 0) {
            synced += syncResult.rows.length;
            const affectedIds = syncResult.rows.map(r => r.id);

            // Batch update review_complaints (single query for all affected)
            await query(
              `UPDATE review_complaints SET status = $1, updated_at = NOW()
               WHERE review_id = ANY($2::text[]) AND status = 'draft'`,
              [status, affectedIds]
            );

            if (status === 'approved') {
              resolvedReviewIds.push(...affectedIds);
            }
            console.log(`[Extension ReviewStatuses] Batch synced ${syncResult.rows.length} reviews -> ${status}`);
          }
        } catch (err: any) {
          syncErrors += items.length;
          for (const item of items) {
            syncErrorDetails.push({ reviewKey: item.reviewKey, error: err.message });
          }
          console.error(`[Extension ReviewStatuses] Batch complaint sync error (${status}):`, err.message);
        }
      }
    }

    // 5e. Immediate auto-close chats for resolved reviews
    let chatsClosed = 0;
    if (resolvedReviewIds.length > 0) {
      chatsClosed = await closeLinkedChatsForReviews(resolvedReviewIds);
    }

    // 6. Process notFoundReviewKeys — reviews extension couldn't find on WB (possibly deleted)
    const notFoundCount = notFoundReviewKeys?.length || 0;
    const notFoundDates: number[] = [];
    if (notFoundCount > 0) {
      console.log(`[Extension ReviewStatuses] 🗑️ ${notFoundCount} reviews not found on WB page (possibly deleted)`);
      // Parse dates from reviewKey format: {nmId}_{rating}_{YYYY-MM-DDTHH:mm}
      for (const key of notFoundReviewKeys!) {
        const parts = key.split('_');
        if (parts.length >= 3) {
          const dateStr = parts.slice(2).join('_'); // everything after nmId_rating
          const ts = new Date(dateStr).getTime();
          if (!isNaN(ts)) notFoundDates.push(ts / 1000);
        }
      }
    }

    console.log(`[Extension ReviewStatuses] 🔄 Sync complete: synced=${synced}, chatStatusSynced=${chatStatusSynced}, chatsClosed=${chatsClosed}, syncErrors=${syncErrors}, unmatched=${unmatchedReviews.length}, notFound=${notFoundCount}`);

    // 7. Trigger targeted sync for unmatched OR notFound reviews (fire-and-forget)
    // - unmatched: extension sees review on WB but it's not in our DB → sync will ADD it
    // - notFound: extension doesn't see review on WB but it IS in our DB → sync will DETECT DELETION
    // Both cases are resolved by the same full sync with deletion detection.
    let syncTriggered = false;
    const allSyncDates: number[] = [
      ...unmatchedReviews.map(r => new Date(r.reviewDate).getTime() / 1000),
      ...notFoundDates,
    ];

    if (allSyncDates.length > 0) {
      const dateFrom = Math.floor(Math.min(...allSyncDates)) - 86400; // -1 day buffer
      const dateTo = Math.ceil(Math.max(...allSyncDates)) + 86400;    // +1 day buffer

      if (unmatchedReviews.length > 0) {
        const missingNmIds = Array.from(new Set(unmatchedReviews.map(r => r.productId)));
        console.log(
          `[Extension ReviewStatuses] ⚠️ ${unmatchedReviews.length} unmatched (not in DB), ` +
          `articles: ${missingNmIds.slice(0, 5).join(', ')}`
        );
      }
      if (notFoundCount > 0) {
        console.log(
          `[Extension ReviewStatuses] 🗑️ ${notFoundCount} notFound (possibly deleted from WB), ` +
          `keys: ${notFoundReviewKeys!.slice(0, 3).join(', ')}`
        );
      }

      try {
        console.log(`[Extension ReviewStatuses] 🔄 Triggering targeted sync: ${new Date(dateFrom * 1000).toISOString().slice(0, 10)} → ${new Date(dateTo * 1000).toISOString().slice(0, 10)}`);
        // Direct function call (fire-and-forget) — no HTTP, no auth needed
        refreshReviewsForStore(storeId, 'full', {
          from: new Date(dateFrom * 1000),
          to: new Date(dateTo * 1000),
        }).catch(err =>
          console.error('[Extension ReviewStatuses] Targeted sync error:', err.message)
        );
        syncTriggered = true;
      } catch (err: any) {
        console.error('[Extension ReviewStatuses] Targeted sync trigger error:', err.message);
      }
    }

    // 8. Return response
    const response: any = {
      success: true,
      data: {
        received: reviews.length,
        created,
        updated,
        errors,
        // Sync to reviews table
        synced,
        chatStatusSynced,
        chatsClosed,
        syncErrors,
        // Unmatched: extension sees on WB but not in our DB
        unmatched: unmatchedReviews.length,
        unmatchedArticles: unmatchedReviews.length > 0
          ? Array.from(new Set(unmatchedReviews.map(r => r.productId)))
          : [],
        // NotFound: extension doesn't see on WB but in our DB (possibly deleted)
        notFound: notFoundCount,
        // Sync triggered for either case
        syncTriggered,
      },
      message: 'Статусы успешно синхронизированы'
    };

    // Include error details if any
    if (errorDetails.length > 0) {
      response.data.errorDetails = errorDetails.slice(0, 10);
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
        chat_status,
        rating_excluded,
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
          chatStatus: row.chat_status,
          ratingExcluded: row.rating_excluded,
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
