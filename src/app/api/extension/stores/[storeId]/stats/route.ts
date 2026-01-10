/**
 * Extension Store Statistics Endpoint
 *
 * GET /api/extension/stores/{storeId}/stats
 *
 * Возвращает статистику магазина для отображения в расширении.
 *
 * @version 1.0.0
 * @date 2026-01-10
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserByApiToken, getStoreReviewsStats } from '@/db/extension-helpers';
import { query } from '@/db/client';

/**
 * GET /api/extension/stores/{storeId}/stats
 *
 * Headers:
 *   Authorization: Bearer wbrm_<token>
 *
 * Response 200:
 *   {
 *     "reviews": {
 *       "total": 150,
 *       "by_rating": { "1": 5, "2": 10, "3": 20, "4": 50, "5": 65 },
 *       "negative": 15,
 *       "avg_rating": 4.2
 *     },
 *     "complaints": {
 *       "total": 15,
 *       "not_sent": 0,
 *       "draft": 5,
 *       "sent": 7,
 *       "approved": 2,
 *       "rejected": 1,
 *       "pending": 0,
 *       "approval_rate": 0.67
 *     },
 *     "sync": {
 *       "last_sync_at": "2026-01-10T12:00:00.000Z",
 *       "last_sync_mode": "incremental"
 *     }
 *   }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { storeId: string } }
) {
  const { storeId } = params;

  console.log(`[Extension Stats] 📊 Запрос статистики для магазина ${storeId}`);

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

    // 3. Получить статистику
    console.log(`[Extension Stats] 🔍 Загружаем статистику из БД...`);
    const stats = await getStoreReviewsStats(storeId);

    console.log(`[Extension Stats] ✅ Статистика готова:`, {
      total_reviews: stats.reviews.total,
      complaints_total: stats.complaints.total,
    });

    return NextResponse.json(stats);

  } catch (error: any) {
    console.error(`[Extension Stats] ❌ Ошибка при получении статистики:`, error);

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
