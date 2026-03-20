/**
 * GET /api/extension/stores
 *
 * Returns list of stores accessible by the current API token.
 * Uses single-query strategy for task counts (was: N+1 loop over 62 stores).
 * In-memory cache with 30s TTL to avoid re-computation.
 *
 * Rate limiting: 100 requests per minute per token
 * CORS enabled for Chrome Extension
 *
 * @version 4.2.0 — Sprint-012: queryWithTimeout, removed NOT EXISTS from Q2
 * @date 2026-03-20
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserByApiToken } from '@/db/extension-helpers';
import { query } from '@/db/client';

/** Run query with timeout — returns empty rows on timeout (graceful degradation for badges) */
function queryWithTimeout<T extends Record<string, any>>(
  sql: string,
  params: any[],
  timeoutMs: number,
  label: string
): Promise<{ rows: T[]; timedOut?: boolean }> {
  return Promise.race([
    query<T>(sql, params).then(r => ({ rows: r.rows, timedOut: false })),
    new Promise<{ rows: T[]; timedOut: boolean }>((resolve) =>
      setTimeout(() => {
        console.warn(`[Extension /stores] ${label} timed out after ${timeoutMs}ms — returning empty`);
        resolve({ rows: [] as T[], timedOut: true });
      }, timeoutMs)
    ),
  ]);
}

// In-memory cache for stores response (TTL 30s, keyed by userId)
const storesCache = new Map<string, { data: any; expiresAt: number }>();
const STORES_CACHE_TTL_MS = 30_000;

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

    // 4. Check cache (30s TTL)
    const cached = storesCache.get(user.id);
    if (cached && Date.now() < cached.expiresAt) {
      return NextResponse.json(cached.data, {
        headers: {
          ...corsHeaders,
          'Cache-Control': 'private, max-age=30',
          'X-Cache': 'HIT',
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
        }
      });
    }

    // 5. Step 1a: Load stores (~10ms)
    const storesResult = await query<{
      id: string;
      name: string;
      is_active: boolean;
      stage: string;
    }>(
      `SELECT s.id, s.name, s.is_active, s.stage
       FROM stores s
       WHERE s.owner_id = $1
       ORDER BY s.name ASC`,
      [user.id]
    );

    // 5. Compute store ID sets for queries
    const activeStoreIds = storesResult.rows.filter(s => s.is_active).map(s => s.id);
    const chatStageStoreIds = storesResult.rows
      .filter(s => s.is_active && ['chats_opened', 'monitoring'].includes(s.stage))
      .map(s => s.id);

    // 6. Three parallel boolean queries with 8s timeout (graceful degradation).
    // On cold buffer cache (6.25GB reviews table, 4GB RAM), queries can take 60s+.
    // queryWithTimeout returns empty rows on timeout — badge shows 0 instead of 500.
    // rating < 5 filter excludes 88.8% of reviews (5★ never used in work).
    const step2Start = Date.now();
    const [draftComplaintsResult, statusParsesResult, pendingChatsResult] = await Promise.all([
      // ── Q1b: stores with draft complaints (fast, small table) ──
      activeStoreIds.length > 0
        ? query<{ store_id: string }>(
            `SELECT DISTINCT rc.store_id
             FROM review_complaints rc
             WHERE rc.store_id = ANY($1::text[])
               AND rc.status = 'draft'`,
            [activeStoreIds]
          )
        : Promise.resolve({ rows: [] as { store_id: string }[] }),

      // ── Q2: stores with pending status parses (8s timeout) ──
      // NOT EXISTS removed: minor false positive acceptable for boolean badge.
      // idx_reviews_status_parse_r14 covers this query (rating<5 partial).
      activeStoreIds.length > 0
        ? queryWithTimeout<{ store_id: string }>(
            `SELECT DISTINCT r.store_id
             FROM reviews r
             WHERE r.store_id = ANY($1::text[])
               AND r.review_status_wb NOT IN ('unpublished', 'excluded', 'deleted')
               AND r.rating_excluded = FALSE
               AND r.marketplace = 'wb'
               AND r.rating < 5
               AND (r.chat_status_by_review IS NULL OR r.chat_status_by_review = 'unknown')`,
            [activeStoreIds],
            8000,
            'Q2-statusParses'
          )
        : Promise.resolve({ rows: [] as { store_id: string }[] }),

      // ── Q3: stores with pending chats (8s timeout) ──
      // Starts from review_complaints (small), JOINs to reviews/products.
      chatStageStoreIds.length > 0
        ? queryWithTimeout<{ store_id: string }>(
            `SELECT DISTINCT r.store_id
             FROM reviews r
             JOIN review_complaints rc ON rc.review_id = r.id
             JOIN products p ON r.product_id = p.id
             WHERE r.store_id = ANY($1::text[])
               AND rc.status = 'rejected'
               AND r.chat_status_by_review = 'available'
               AND r.review_status_wb IN ('visible', 'unknown')
               AND r.rating_excluded = FALSE
               AND r.marketplace = 'wb'
               AND r.rating < 5
               AND (r.complaint_status IS NULL OR r.complaint_status NOT IN ('approved', 'pending'))
               AND NOT EXISTS (
                 SELECT 1 FROM review_chat_links rcl
                 WHERE rcl.store_id = r.store_id
                   AND rcl.review_nm_id = p.wb_product_id
                   AND rcl.review_rating = r.rating
                   AND rcl.review_date BETWEEN r.date - interval '2 minutes' AND r.date + interval '2 minutes'
               )`,
            [chatStageStoreIds],
            8000,
            'Q3-pendingChats'
          )
        : Promise.resolve({ rows: [] as { store_id: string }[] }),
    ]);

    console.log(`[Extension /stores] Step2: ${Date.now() - step2Start}ms (Q1b=${draftComplaintsResult.rows.length}, Q2=${statusParsesResult.rows.length}, Q3=${pendingChatsResult.rows.length})`);

    // Build lookup sets (boolean: store has tasks in this direction)
    const draftComplaintsSet = new Set(draftComplaintsResult.rows.map(r => r.store_id));
    const statusParsesSet = new Set(statusParsesResult.rows.map(r => r.store_id));
    const pendingChatsSet = new Set(pendingChatsResult.rows.map(r => r.store_id));

    const stores = storesResult.rows.map(row => ({
      id: row.id,
      name: row.name,
      isActive: row.is_active,
      draftComplaintsCount: draftComplaintsSet.has(row.id) ? 1 : 0,
      pendingChatsCount: pendingChatsSet.has(row.id) ? 1 : 0,
      pendingStatusParsesCount: statusParsesSet.has(row.id) ? 1 : 0,
    }));

    // Cache result for 30s
    storesCache.set(user.id, { data: stores, expiresAt: Date.now() + STORES_CACHE_TTL_MS });

    return NextResponse.json(stores, {
      headers: {
        ...corsHeaders,
        'Cache-Control': 'private, max-age=30',
        'X-Cache': 'MISS',
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
