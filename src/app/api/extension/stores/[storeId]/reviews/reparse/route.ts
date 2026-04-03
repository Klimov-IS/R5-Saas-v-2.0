/**
 * Reparse Reviews Endpoint for Chrome Extension
 *
 * POST /api/extension/stores/{storeId}/reviews/reparse
 *
 * Resets review_status_wb and chat_status_by_review for eligible reviews,
 * putting them back into the extension's parsing queue (GET /tasks → statusParses).
 *
 * Use case: when the extension has no tasks left, the user can press
 * "Re-parse" to re-queue all reviews for fresh status checks.
 *
 * Auth: Bearer token (user_settings.api_key)
 *
 * Body (optional):
 *   { "nmIds": ["300430599", "582539213"] }  — filter by articles, empty = all active
 *
 * IMPORTANT: review_status_wb is set to 'unknown' (NOT NULL),
 * because the tasks endpoint uses NOT IN (...) which excludes NULLs in PostgreSQL.
 *
 * Performance: Uses 2-step query strategy:
 *   Step 1: Load eligible (product_id, ratings[]) from product_rules (~10ms)
 *   Step 2: COUNT + UPDATE with unnest CTE (no 3-way JOIN)
 *
 * @version 1.1.0 — 2-step strategy, eliminates 3-way JOIN (Sprint-012)
 * @date 2026-03-19
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db/client';
import { getUserByApiToken } from '@/db/extension-helpers';

const MAX_REVIEWS_PER_CALL = 2000;

export async function POST(
  request: NextRequest,
  { params }: { params: { storeId: string } }
) {
  const { storeId } = params;
  const startTime = Date.now();

  console.log(`[Extension Reparse] 🔄 Запрос ре-парсинга для магазина ${storeId}`);

  try {
    // 1. Auth
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const user = await getUserByApiToken(token);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid token' },
        { status: 401 }
      );
    }

    // 2. Verify store access
    const storeResult = await query(
      'SELECT id, owner_id, name FROM stores WHERE id = $1',
      [storeId]
    );
    if (!storeResult.rows[0]) {
      return NextResponse.json(
        { error: 'Not found', message: `Store ${storeId} not found` },
        { status: 404 }
      );
    }
    if (storeResult.rows[0].owner_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You do not have access to this store' },
        { status: 403 }
      );
    }

    // 3. Parse optional body
    let nmIds: string[] | null = null;
    try {
      const body = await request.json();
      if (body.nmIds && Array.isArray(body.nmIds) && body.nmIds.length > 0) {
        nmIds = body.nmIds.map(String);
      }
    } catch {
      // Empty body is fine — reset all active products
    }

    // 4. Step 1: Load eligible products with their rating rules (~10ms, no heavy JOIN)
    const eligResult = await query<{
      product_id: string;
      wb_product_id: string;
      submit_complaints: boolean;
      work_in_chats: boolean;
      complaint_rating_1: boolean;
      complaint_rating_2: boolean;
      complaint_rating_3: boolean;
      chat_rating_1: boolean;
      chat_rating_2: boolean;
      chat_rating_3: boolean;
    }>(
      `SELECT p.id as product_id, p.wb_product_id,
              pr.submit_complaints, pr.work_in_chats,
              pr.complaint_rating_1, pr.complaint_rating_2, pr.complaint_rating_3,
              pr.chat_rating_1, pr.chat_rating_2, pr.chat_rating_3
       FROM products p
       JOIN product_rules pr ON pr.product_id = p.id
       WHERE p.store_id = $1 AND p.work_status = 'active'
         AND (pr.work_in_chats = TRUE OR pr.submit_complaints = TRUE)`,
      [storeId]
    );

    // Build (product_id, rating) pairs for eligible reviews
    const eligProductIds: string[] = [];
    const eligRatings: number[] = [];

    for (const row of eligResult.rows) {
      if (nmIds && !nmIds.includes(row.wb_product_id)) continue;

      const ratings = new Set<number>();
      if (row.submit_complaints) {
        if (row.complaint_rating_1) ratings.add(1);
        if (row.complaint_rating_2) ratings.add(2);
        if (row.complaint_rating_3) ratings.add(3);
      }
      if (row.work_in_chats) {
        if (row.chat_rating_1) ratings.add(1);
        if (row.chat_rating_2) ratings.add(2);
        if (row.chat_rating_3) ratings.add(3);
      }

      ratings.forEach(r => {
        eligProductIds.push(row.product_id);
        eligRatings.push(r);
      });
    }

    if (eligProductIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: { reset: 0, skipped: 0, total: 0 },
        message: 'Нет товаров для ре-парсинга',
        elapsed: Date.now() - startTime,
      });
    }

    // 5. Step 2: COUNT using unnest CTE (no 3-way JOIN at runtime)
    const countResult = await query<{ total: string; eligible: string; rating_excluded: string }>(
      `WITH eligible AS (
        SELECT product_id, rating
        FROM unnest($1::text[], $2::int[]) AS t(product_id, rating)
      )
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE r.rating_excluded = FALSE OR r.rating_excluded IS NULL) as eligible,
        COUNT(*) FILTER (WHERE r.rating_excluded = TRUE) as rating_excluded
      FROM reviews r
      JOIN eligible e ON r.product_id = e.product_id AND r.rating = e.rating
      WHERE r.store_id = $3
        AND r.marketplace = 'wb'`,
      [eligProductIds, eligRatings, storeId]
    );

    const total = parseInt(countResult.rows[0].total);
    const eligible = parseInt(countResult.rows[0].eligible);
    const ratingExcluded = parseInt(countResult.rows[0].rating_excluded);

    if (eligible === 0) {
      return NextResponse.json({
        success: true,
        data: { reset: 0, skipped: ratingExcluded, total },
        message: 'Нет отзывов для ре-парсинга',
        elapsed: Date.now() - startTime,
      });
    }

    if (eligible > MAX_REVIEWS_PER_CALL) {
      return NextResponse.json(
        {
          error: 'Too many reviews',
          message: `Слишком много отзывов (${eligible}). Максимум ${MAX_REVIEWS_PER_CALL} за один вызов. Укажите nmIds для фильтрации.`,
          total: eligible,
          limit: MAX_REVIEWS_PER_CALL,
        },
        { status: 400 }
      );
    }

    // 6. UPDATE using unnest CTE (Sprint-013: both tables)
    const reparseSql = (table: string) => `WITH eligible AS (
        SELECT product_id, rating
        FROM unnest($1::text[], $2::int[]) AS t(product_id, rating)
      )
      UPDATE ${table} r
      SET review_status_wb = 'unknown',
          chat_status_by_review = NULL,
          updated_at = NOW()
      FROM eligible e
      WHERE r.product_id = e.product_id
        AND r.rating = e.rating
        AND r.store_id = $3
        AND r.marketplace = 'wb'
        AND (r.rating_excluded = FALSE OR r.rating_excluded IS NULL)
      RETURNING r.id`;
    const reparseParams = [eligProductIds, eligRatings, storeId];
    const r1 = await query<{ id: string }>(reparseSql('reviews'), reparseParams);

    const resetCount = r1.rows.length;
    const storeName = storeResult.rows[0].name;

    console.log(`[Extension Reparse] ✅ ${storeName}: сброшено ${resetCount} отзывов, пропущено ${ratingExcluded} (rating_excluded)`);

    return NextResponse.json({
      success: true,
      data: {
        reset: resetCount,
        skipped: ratingExcluded,
        skippedReasons: ratingExcluded > 0 ? { rating_excluded: ratingExcluded } : {},
        total,
      },
      message: `${resetCount} отзывов добавлены в очередь на парсинг`,
      elapsed: Date.now() - startTime,
    });
  } catch (error: any) {
    console.error(`[Extension Reparse] ❌ Ошибка:`, error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
