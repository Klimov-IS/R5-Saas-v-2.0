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
 * @version 1.0.0
 * @date 2026-03-12
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

    // 4. Count what will be affected (before update)
    const nmIdFilter = nmIds
      ? `AND p.wb_product_id = ANY($2::text[])`
      : '';
    const queryParams: any[] = [storeId];
    if (nmIds) queryParams.push(nmIds);

    const countResult = await query<{ total: string; eligible: string; rating_excluded: string }>(
      `SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE r.rating_excluded = FALSE OR r.rating_excluded IS NULL) as eligible,
        COUNT(*) FILTER (WHERE r.rating_excluded = TRUE) as rating_excluded
      FROM reviews r
      JOIN products p ON r.product_id = p.id AND p.store_id = r.store_id
      JOIN product_rules pr ON pr.product_id = p.id
      WHERE r.store_id = $1
        AND r.marketplace = 'wb'
        AND r.rating <= 3
        AND p.work_status = 'active'
        AND (pr.work_in_chats = TRUE OR pr.submit_complaints = TRUE)
        AND (
          (pr.submit_complaints = TRUE AND (
            (r.rating = 1 AND pr.complaint_rating_1 = TRUE) OR
            (r.rating = 2 AND pr.complaint_rating_2 = TRUE) OR
            (r.rating = 3 AND pr.complaint_rating_3 = TRUE)
          ))
          OR
          (pr.work_in_chats = TRUE AND (
            (r.rating = 1 AND pr.chat_rating_1 = TRUE) OR
            (r.rating = 2 AND pr.chat_rating_2 = TRUE) OR
            (r.rating = 3 AND pr.chat_rating_3 = TRUE)
          ))
        )
        ${nmIdFilter}`,
      queryParams
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

    // 5. Reset statuses
    const updateResult = await query<{ id: string }>(
      `UPDATE reviews r
      SET review_status_wb = 'unknown',
          chat_status_by_review = NULL,
          updated_at = NOW()
      FROM products p
      JOIN product_rules pr ON pr.product_id = p.id
      WHERE r.product_id = p.id
        AND r.store_id = p.store_id
        AND r.store_id = $1
        AND r.marketplace = 'wb'
        AND r.rating <= 3
        AND p.work_status = 'active'
        AND (pr.work_in_chats = TRUE OR pr.submit_complaints = TRUE)
        AND (r.rating_excluded = FALSE OR r.rating_excluded IS NULL)
        AND (
          (pr.submit_complaints = TRUE AND (
            (r.rating = 1 AND pr.complaint_rating_1 = TRUE) OR
            (r.rating = 2 AND pr.complaint_rating_2 = TRUE) OR
            (r.rating = 3 AND pr.complaint_rating_3 = TRUE)
          ))
          OR
          (pr.work_in_chats = TRUE AND (
            (r.rating = 1 AND pr.chat_rating_1 = TRUE) OR
            (r.rating = 2 AND pr.chat_rating_2 = TRUE) OR
            (r.rating = 3 AND pr.chat_rating_3 = TRUE)
          ))
        )
        ${nmIdFilter}
      RETURNING r.id`,
      queryParams
    );

    const resetCount = updateResult.rows.length;
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
