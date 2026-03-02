/**
 * GET /api/extension/stores
 *
 * Returns list of stores accessible by the current API token
 * Direct DB query (~500ms with partial index)
 *
 * Rate limiting: 100 requests per minute per token
 * CORS enabled for Chrome Extension
 *
 * @version 3.0.0
 * @date 2026-02-15
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserByApiToken } from '@/db/extension-helpers';
import { query } from '@/db/client';

// Simple in-memory rate limiter (100 req/min per token)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(token: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const limit = 100; // requests per minute
  const windowMs = 60 * 1000; // 1 minute

  const record = rateLimitMap.get(token);

  if (!record || now > record.resetAt) {
    // New window
    const resetAt = now + windowMs;
    rateLimitMap.set(token, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  // Existing window
  if (record.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }

  record.count++;
  return { allowed: true, remaining: limit - record.count, resetAt: record.resetAt };
}

// CORS headers for Chrome Extension
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Missing or invalid Authorization header' },
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.substring(7);

    // 2. Rate limiting
    const rateLimit = checkRateLimit(token);
    if (!rateLimit.allowed) {
      const resetDate = new Date(rateLimit.resetAt).toISOString();
      return NextResponse.json(
        {
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Maximum 100 requests per minute.',
          code: 'RATE_LIMIT_EXCEEDED',
          resetAt: resetDate,
        },
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': resetDate,
            'Retry-After': Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // 3. Verify token and get user
    const user = await getUserByApiToken(token);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or expired token' },
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
          }
        }
      );
    }

    // 4. Run all count queries in parallel for performance
    // Optimized: Q1 scoped to owner's stores, Q2 starts from products (uses idx_reviews_parse_pending)
    const [storesResult, statusParsesResult, pendingChatsResult] = await Promise.all([
      // ── Q1: stores + draftComplaintsCount (scoped subquery) ──
      query<{
        id: string;
        name: string;
        status: string;
        draft_complaints_count: string;
      }>(
        `SELECT
          s.id,
          s.name,
          s.status,
          COALESCE(cnt.draft_count, 0)::text as draft_complaints_count
        FROM stores s
        LEFT JOIN (
          SELECT rc.store_id, COUNT(*) as draft_count
          FROM review_complaints rc
          JOIN reviews r ON r.id = rc.review_id
          JOIN products p ON rc.product_id = p.id
          WHERE rc.status = 'draft'
            AND p.work_status = 'active'
            AND (r.complaint_status IS NULL OR r.complaint_status IN ('not_sent', 'draft'))
            AND r.review_status_wb != 'deleted'
            AND rc.store_id IN (SELECT id FROM stores WHERE owner_id = $1)
          GROUP BY rc.store_id
        ) cnt ON cnt.store_id = s.id
        WHERE s.owner_id = $1
        ORDER BY s.name ASC`,
        [user.id]
      ),

      // ── Q2: statusParses — start from products (small table), join reviews via partial index ──
      query<{ store_id: string; count: string }>(
        `SELECT r.store_id, COUNT(*)::text as count
         FROM products p
         JOIN product_rules pr ON pr.product_id = p.id
         JOIN stores s ON s.id = p.store_id AND s.owner_id = $1 AND s.status = 'active'
         JOIN reviews r ON r.product_id = p.id
           AND r.review_status_wb NOT IN ('unpublished', 'excluded', 'deleted')
           AND r.rating_excluded = FALSE
           AND r.marketplace = 'wb'
           AND (r.chat_status_by_review IS NULL OR r.chat_status_by_review = 'unknown')
           AND r.rating = ANY(ARRAY_REMOVE(ARRAY[
             CASE WHEN (pr.submit_complaints AND pr.complaint_rating_1) OR (pr.work_in_chats AND pr.chat_rating_1) THEN 1 END,
             CASE WHEN (pr.submit_complaints AND pr.complaint_rating_2) OR (pr.work_in_chats AND pr.chat_rating_2) THEN 2 END,
             CASE WHEN (pr.submit_complaints AND pr.complaint_rating_3) OR (pr.work_in_chats AND pr.chat_rating_3) THEN 3 END,
             CASE WHEN (pr.submit_complaints AND pr.complaint_rating_4) OR (pr.work_in_chats AND pr.chat_rating_4) THEN 4 END
           ], NULL))
         WHERE p.work_status = 'active'
           AND (pr.submit_complaints = TRUE OR pr.work_in_chats = TRUE)
         GROUP BY r.store_id`,
        [user.id]
      ),

      // ── Q3: pendingChats (chatOpens + chatLinks) ──
      query<{ store_id: string; count: string }>(
        `SELECT store_id, SUM(cnt)::text as count FROM (
          SELECT r.store_id, COUNT(DISTINCT r.id) as cnt
          FROM reviews r
          JOIN review_complaints rc ON rc.review_id = r.id
          JOIN products p ON r.product_id = p.id
          JOIN product_rules pr ON pr.product_id = p.id
          JOIN stores s ON s.id = r.store_id AND s.owner_id = $1 AND s.status = 'active'
          WHERE rc.status = 'rejected'
            AND pr.work_in_chats = TRUE
            AND r.chat_status_by_review = 'available'
            AND r.review_status_wb IN ('visible', 'unknown')
            AND r.rating_excluded = FALSE
            AND r.marketplace = 'wb'
            AND p.work_status = 'active'
            AND (r.complaint_status IS NULL OR r.complaint_status NOT IN ('approved', 'pending'))
            AND (
              (r.rating = 1 AND pr.chat_rating_1 = TRUE) OR
              (r.rating = 2 AND pr.chat_rating_2 = TRUE) OR
              (r.rating = 3 AND pr.chat_rating_3 = TRUE) OR
              (r.rating = 4 AND pr.chat_rating_4 = TRUE)
            )
            AND NOT EXISTS (
              SELECT 1 FROM review_chat_links rcl
              WHERE rcl.store_id = r.store_id
                AND rcl.review_nm_id = p.wb_product_id
                AND rcl.review_rating = r.rating
                AND rcl.review_date BETWEEN r.date - interval '2 minutes'
                                         AND r.date + interval '2 minutes'
            )
          GROUP BY r.store_id
          UNION ALL
          SELECT r.store_id, COUNT(*) as cnt
          FROM reviews r
          JOIN products p ON r.product_id = p.id
          JOIN product_rules pr ON pr.product_id = p.id
          JOIN stores s ON s.id = r.store_id AND s.owner_id = $1 AND s.status = 'active'
          WHERE r.chat_status_by_review = 'opened'
            AND pr.work_in_chats = TRUE
            AND r.review_status_wb != 'deleted'
            AND r.rating_excluded = FALSE
            AND r.marketplace = 'wb'
            AND p.work_status = 'active'
            AND (
              (r.rating = 1 AND pr.chat_rating_1 = TRUE) OR
              (r.rating = 2 AND pr.chat_rating_2 = TRUE) OR
              (r.rating = 3 AND pr.chat_rating_3 = TRUE) OR
              (r.rating = 4 AND pr.chat_rating_4 = TRUE)
            )
            AND NOT EXISTS (
              SELECT 1 FROM review_chat_links rcl
              WHERE rcl.store_id = r.store_id
                AND rcl.review_nm_id = p.wb_product_id
                AND rcl.review_rating = r.rating
                AND rcl.review_date BETWEEN r.date - interval '2 minutes'
                                         AND r.date + interval '2 minutes'
            )
          GROUP BY r.store_id
        ) combined
        GROUP BY store_id`,
        [user.id]
      ),
    ]);

    // Build lookup maps for counts
    const statusParsesMap = new Map<string, number>();
    for (const row of statusParsesResult.rows) {
      statusParsesMap.set(row.store_id, parseInt(row.count) || 0);
    }
    const pendingChatsMap = new Map<string, number>();
    for (const row of pendingChatsResult.rows) {
      pendingChatsMap.set(row.store_id, parseInt(row.count) || 0);
    }

    const stores = storesResult.rows.map(row => ({
      id: row.id,
      name: row.name,
      isActive: row.status === 'active',
      draftComplaintsCount: parseInt(row.draft_complaints_count) || 0,
      pendingChatsCount: pendingChatsMap.get(row.id) || 0,
      pendingStatusParsesCount: statusParsesMap.get(row.id) || 0,
    }));

    return NextResponse.json(stores, {
      headers: {
        ...corsHeaders,
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
      }
    });

  } catch (error: any) {
    console.error('[Extension API] Error fetching stores:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
