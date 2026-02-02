/**
 * Extension Complaints Queue Endpoint
 *
 * GET /api/extension/stores/{storeId}/complaints
 *
 * Возвращает отзывы с готовыми жалобами (complaint_status = 'draft')
 * для массовой подачи через расширение.
 *
 * @version 1.0.0
 * @date 2026-01-10
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db/client';
import { getUserByApiToken } from '@/db/extension-helpers';

/**
 * GET /api/extension/stores/{storeId}/complaints
 *
 * Query Parameters:
 *   - filter: 'draft' | 'all' (default: 'draft')
 *   - limit: number (default: 100, max: 500)
 *   - rating: '1,2,3' (comma-separated, default: '1,2,3')
 *
 * Headers:
 *   Authorization: Bearer wbrm_<token>
 *
 * Response 200:
 *   {
 *     "complaints": [ ... ],
 *     "total": 32,
 *     "stats": { ... }
 *   }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { storeId: string } }
) {
  const { storeId } = params;
  const { searchParams } = new URL(request.url);

  // Query parameters
  const filter = searchParams.get('filter') || 'draft';
  const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
  const ratingParam = searchParams.get('rating') || '1,2,3';
  const ratings = ratingParam.split(',').map((r) => parseInt(r.trim())).filter((r) => r >= 1 && r <= 5);

  console.log(`[Extension Complaints] 📋 Запрос жалоб для магазина ${storeId}`, {
    filter,
    limit,
    ratings,
  });

  try {
    // 1. Аутентификация
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

    // 2. Проверка прав доступа к магазину
    const storeResult = await query(
      'SELECT id, owner_id FROM stores WHERE id = $1',
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

    // 3. Запрос жалоб с JOIN
    console.log(`[Extension Complaints] 🔍 Поиск жалоб в БД...`);

    // IMPORTANT: Filter by BOTH rc.status AND r.complaint_status
    // rc.status='draft' means AI generated complaint text
    // r.complaint_status must be 'not_sent' or 'draft' (not already submitted to WB)
    // Exclude: 'rejected', 'approved', 'pending', 'reconsidered', 'sent'
    const complaintsResult = await query(
      `SELECT
        r.id,
        p.wb_product_id as product_id,
        r.rating,
        r.text,
        r.author,
        r.date as created_at,
        rc.reason_id,
        rc.reason_name,
        rc.complaint_text
      FROM reviews r
      JOIN review_complaints rc ON r.id = rc.review_id
      JOIN products p ON r.product_id = p.id
      WHERE r.store_id = $1
        AND rc.status = 'draft'
        AND r.rating = ANY($2)
        AND p.work_status = 'active'
        AND (r.complaint_status IS NULL OR r.complaint_status IN ('not_sent', 'draft'))
      ORDER BY p.wb_product_id, r.date DESC
      LIMIT $3`,
      [storeId, ratings, limit]
    );

    const complaintsData = complaintsResult.rows;

    console.log(`[Extension Complaints] ✅ Найдено ${complaintsData.length} жалоб`);

    // 4. Статистика по рейтингам (только активные продукты + валидный статус жалобы)
    const byRatingResult = await query<{ rating: number; count: string }>(
      `SELECT r.rating, COUNT(*) as count
       FROM reviews r
       JOIN review_complaints rc ON r.id = rc.review_id
       JOIN products p ON r.product_id = p.id
       WHERE r.store_id = $1
         AND rc.status = 'draft'
         AND p.work_status = 'active'
         AND (r.complaint_status IS NULL OR r.complaint_status IN ('not_sent', 'draft'))
       GROUP BY r.rating`,
      [storeId]
    );

    const ratingStats: Record<string, number> = {};
    byRatingResult.rows.forEach(({ rating, count }) => {
      ratingStats[rating.toString()] = parseInt(count, 10);
    });

    // 5. Статистика по артикулам (только активные продукты + валидный статус жалобы)
    const byArticleResult = await query<{ wb_product_id: string; count: string }>(
      `SELECT p.wb_product_id, COUNT(*) as count
       FROM reviews r
       JOIN review_complaints rc ON r.id = rc.review_id
       JOIN products p ON r.product_id = p.id
       WHERE r.store_id = $1
         AND rc.status = 'draft'
         AND p.work_status = 'active'
         AND (r.complaint_status IS NULL OR r.complaint_status IN ('not_sent', 'draft'))
       GROUP BY p.wb_product_id
       ORDER BY count DESC
       LIMIT 20`,
      [storeId]
    );

    const articleStats: Record<string, number> = {};
    byArticleResult.rows.forEach(({ wb_product_id, count }) => {
      if (wb_product_id) {
        articleStats[wb_product_id] = parseInt(count, 10);
      }
    });

    // 6. Форматирование ответа
    const response = {
      complaints: complaintsData.map((c) => ({
        id: c.id,
        productId: c.product_id,
        rating: c.rating,
        text: c.text,
        authorName: c.author,
        createdAt: c.created_at,
        complaintText: {
          reasonId: c.reason_id,
          reasonName: c.reason_name,
          complaintText: c.complaint_text,
        },
      })),
      total: complaintsData.length,
      stats: {
        by_rating: ratingStats,
        by_article: articleStats,
      },
    };

    console.log(`[Extension Complaints] ✅ Ответ готов:`, {
      complaints_count: response.complaints.length,
      total: response.total,
    });

    return NextResponse.json(response);

  } catch (error: any) {
    console.error(`[Extension Complaints] ❌ Ошибка при получении жалоб:`, error);

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message || 'Unknown error',
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
