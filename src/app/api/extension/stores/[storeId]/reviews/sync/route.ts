/**
 * Extension Reviews Sync Endpoint
 *
 * POST /api/extension/stores/{storeId}/reviews/sync
 *
 * Синхронизирует отзывы, спарсенные расширением, с базой данных.
 * Автоматически генерирует жалобы для негативных отзывов.
 *
 * @version 1.0.0
 * @date 2026-01-10
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db/client';
import {
  getUserByApiToken,
  upsertReviewsFromExtension,
  autoGenerateComplaintsForReviews,
  type ExtensionReview,
  type SyncMetadata,
} from '@/db/extension-helpers';

interface SyncRequestBody {
  reviews: ExtensionReview[];
  metadata?: SyncMetadata;
}

/**
 * POST /api/extension/stores/{storeId}/reviews/sync
 *
 * Headers:
 *   Authorization: Bearer wbrm_<token>
 *   Content-Type: application/json
 *
 * Body:
 *   {
 *     "reviews": [...],
 *     "metadata": { "total_parsed": 50, "pages_scanned": 3, ... }
 *   }
 *
 * Response 200:
 *   {
 *     "success": true,
 *     "synced": 50,
 *     "created": 12,
 *     "updated": 38,
 *     "complaints_generated": 8
 *   }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { storeId: string } }
) {
  const { storeId } = params;

  console.log(`[Extension Sync] 🔄 Начало синхронизации отзывов для магазина ${storeId}`);

  try {
    // 1. Аутентификация
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.warn('[Extension Sync] ❌ Отсутствует Authorization header');
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const user = await getUserByApiToken(token);

    if (!user) {
      console.warn('[Extension Sync] ❌ Неверный токен');
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
      console.warn(`[Extension Sync] ❌ Магазин ${storeId} не найден`);
      return NextResponse.json(
        { error: 'Not found', message: `Store ${storeId} not found` },
        { status: 404 }
      );
    }

    if (storeResult.rows[0].owner_id !== user.id) {
      console.warn(`[Extension Sync] ❌ Пользователь ${user.id} не имеет доступа к магазину ${storeId}`);
      return NextResponse.json(
        { error: 'Forbidden', message: 'You do not have access to this store' },
        { status: 403 }
      );
    }

    // 3. Парсинг request body
    const body: SyncRequestBody = await request.json();

    if (!body.reviews || !Array.isArray(body.reviews)) {
      console.warn('[Extension Sync] ❌ Неверный формат body: reviews должен быть массивом');
      return NextResponse.json(
        { error: 'Bad request', message: 'Request body must contain "reviews" array' },
        { status: 400 }
      );
    }

    const { reviews, metadata } = body;

    console.log(`[Extension Sync] 📋 Получено ${reviews.length} отзывов для синхронизации`);
    if (metadata) {
      console.log(`[Extension Sync] 📊 Метаданные:`, metadata);
    }

    // Валидация: проверяем что статусы на английском
    const firstReview = reviews[0];
    if (firstReview) {
      const validStatuses = ['visible', 'unpublished', 'excluded', 'unknown'];
      if (!validStatuses.includes(firstReview.review_status_wb)) {
        console.warn(`[Extension Sync] ⚠️ Статус отзыва не на английском: ${firstReview.review_status_wb}`);
        return NextResponse.json(
          {
            error: 'Bad request',
            message: `Invalid review_status_wb: "${firstReview.review_status_wb}". Must be one of: ${validStatuses.join(', ')}. Расширение должно конвертировать статусы в английский!`,
          },
          { status: 400 }
        );
      }
    }

    // 4. Upsert отзывов в БД
    console.log(`[Extension Sync] 💾 Начинаем upsert отзывов...`);
    const upsertResult = await upsertReviewsFromExtension(storeId, reviews);

    console.log(`[Extension Sync] ✅ Upsert завершён:`, {
      created: upsertResult.created,
      updated: upsertResult.updated,
      errors: upsertResult.errors,
    });

    // 5. Автогенерация жалоб для негативных отзывов
    console.log(`[Extension Sync] 🤖 Начинаем автогенерацию жалоб...`);
    const complaintsGenerated = await autoGenerateComplaintsForReviews(storeId, 50);

    console.log(`[Extension Sync] ✅ Автогенерация завершена: ${complaintsGenerated} жалоб создано`);

    // 6. Обновить last_reviews_sync_at в таблице stores
    await query(
      'UPDATE stores SET last_reviews_sync_at = NOW(), updated_at = NOW() WHERE id = $1',
      [storeId]
    );

    // 7. Вернуть успешный ответ
    const response = {
      success: true,
      synced: reviews.length,
      created: upsertResult.created,
      updated: upsertResult.updated,
      errors: upsertResult.errors,
      complaints_generated: complaintsGenerated,
      ...(upsertResult.errors > 0 && {
        error_details: upsertResult.error_details.slice(0, 10), // Первые 10 ошибок
      }),
    };

    console.log(`[Extension Sync] ✅ Синхронизация завершена успешно`, response);

    return NextResponse.json(response);

  } catch (error: any) {
    console.error(`[Extension Sync] ❌ Критическая ошибка при синхронизации:`, error);

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
