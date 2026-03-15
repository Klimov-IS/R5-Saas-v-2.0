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

    // 4. Step 1: Load stores + precompute eligible product_ids per store (~20ms)
    const [storesResult, eligibleProductsResult] = await Promise.all([
      query<{
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
      ),
      // Preload all eligible product_ids grouped by store_id
      query<{
        store_id: string;
        product_id: string;
        submit_complaints: boolean;
        work_in_chats: boolean;
      }>(
        `SELECT p.store_id, p.id as product_id,
                pr.submit_complaints, pr.work_in_chats
         FROM products p
         JOIN product_rules pr ON pr.product_id = p.id
         WHERE p.store_id IN (SELECT s.id FROM stores s WHERE s.owner_id = $1)
           AND p.work_status = 'active'
           AND (pr.submit_complaints = TRUE OR pr.work_in_chats = TRUE)`,
        [user.id]
      ),
    ]);

    // Build per-store eligible product_id arrays
    const storeEligibleProducts = new Map<string, string[]>();
    const storeChatProducts = new Map<string, string[]>();
    for (const row of eligibleProductsResult.rows) {
      if (!storeEligibleProducts.has(row.store_id)) storeEligibleProducts.set(row.store_id, []);
      storeEligibleProducts.get(row.store_id)!.push(row.product_id);
      if (row.work_in_chats) {
        if (!storeChatProducts.has(row.store_id)) storeChatProducts.set(row.store_id, []);
        storeChatProducts.get(row.store_id)!.push(row.product_id);
      }
    }

    // 5. Step 2: Run simplified EXISTS queries using product_id = ANY(...)
    const activeStoreIds = storesResult.rows.filter(s => s.is_active).map(s => s.id);
    const chatStageStoreIds = storesResult.rows
      .filter(s => s.is_active && ['chats_opened', 'monitoring'].includes(s.stage))
      .map(s => s.id);

    // Helper: wrap a query in a timeout — returns empty rows on timeout instead of blocking
    const QUERY_TIMEOUT_MS = 8000;
    function queryWithTimeout<T extends Record<string, any>>(sql: string, params: any[]) {
      return Promise.race([
        query<T>(sql, params),
        new Promise<{ rows: T[] }>((resolve) =>
          setTimeout(() => resolve({ rows: [] } as any), QUERY_TIMEOUT_MS)
        ),
      ]);
    }

    const [draftComplaintsResult, statusParsesResult, pendingChatsResult] = await Promise.all([
      // ── Q1b: stores with draft complaints ──
      queryWithTimeout<{ store_id: string }>(
        `SELECT s.id as store_id
        FROM stores s
        WHERE s.owner_id = $1
        AND EXISTS (
          SELECT 1 FROM review_complaints rc
          JOIN reviews r ON r.id = rc.review_id
          WHERE rc.store_id = s.id
            AND rc.status = 'draft'
            AND (r.complaint_status IS NULL OR r.complaint_status IN ('not_sent', 'draft'))
            AND r.review_status_wb != 'deleted'
        )`,
        [user.id]
      ),

      // ── Q2: stores with pending status parses ──
      // Uses precomputed product_ids — no product_rules JOIN
      (async () => {
        const result: { store_id: string }[] = [];
        for (const storeId of activeStoreIds) {
          const productIds = storeEligibleProducts.get(storeId);
          if (!productIds || productIds.length === 0) continue;
          const exists = await queryWithTimeout<{ exists: boolean }>(
            `SELECT EXISTS (
              SELECT 1 FROM reviews r
              WHERE r.store_id = $1
                AND r.product_id = ANY($2::text[])
                AND r.review_status_wb NOT IN ('unpublished', 'excluded', 'deleted')
                AND r.rating_excluded = FALSE
                AND r.marketplace = 'wb'
                AND (r.chat_status_by_review IS NULL OR r.chat_status_by_review = 'unknown')
                AND NOT EXISTS (
                  SELECT 1 FROM review_complaints rc
                  WHERE rc.review_id = r.id AND rc.status = 'draft'
                )
            ) as exists`,
            [storeId, productIds]
          );
          if (exists.rows[0]?.exists) result.push({ store_id: storeId });
        }
        return { rows: result };
      })(),

      // ── Q3: stores with pending chats ──
      // Uses precomputed chat product_ids — no product_rules JOIN
      (async () => {
        const result: { store_id: string }[] = [];
        for (const storeId of chatStageStoreIds) {
          const productIds = storeChatProducts.get(storeId);
          if (!productIds || productIds.length === 0) continue;
          const exists = await queryWithTimeout<{ exists: boolean }>(
            `SELECT EXISTS (
              SELECT 1 FROM reviews r
              JOIN review_complaints rc ON rc.review_id = r.id
              WHERE r.store_id = $1
                AND r.product_id = ANY($2::text[])
                AND rc.status = 'rejected'
                AND r.chat_status_by_review = 'available'
                AND r.review_status_wb IN ('visible', 'unknown')
                AND r.rating_excluded = FALSE
                AND r.marketplace = 'wb'
                AND (r.complaint_status IS NULL OR r.complaint_status NOT IN ('approved', 'pending'))
                AND NOT EXISTS (
                  SELECT 1 FROM review_chat_links rcl
                  WHERE rcl.store_id = r.store_id
                    AND rcl.review_nm_id = (SELECT wb_product_id FROM products WHERE id = r.product_id)
                    AND rcl.review_rating = r.rating
                    AND rcl.review_date BETWEEN r.date - interval '2 minutes' AND r.date + interval '2 minutes'
                )
            ) as exists`,
            [storeId, productIds]
          );
          if (exists.rows[0]?.exists) result.push({ store_id: storeId });
        }
        return { rows: result };
      })(),
    ]);

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
