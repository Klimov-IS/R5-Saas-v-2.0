/**
 * Extension Mark Complaint as Sent Endpoint
 *
 * POST /api/extension/stores/{storeId}/reviews/{reviewId}/complaint/sent
 *
 * Отмечает жалобу как отправленную после успешной подачи через расширение.
 *
 * @version 1.0.0
 * @date 2026-01-10
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db/client';
import { getUserByApiToken } from '@/db/extension-helpers';

interface MarkSentRequestBody {
  wb_complaint_id?: string; // ID жалобы в системе WB (если доступен)
  sent_at?: string; // ISO 8601 timestamp (optional)
}

/**
 * POST /api/extension/stores/{storeId}/reviews/{reviewId}/complaint/sent
 *
 * Headers:
 *   Authorization: Bearer wbrm_<token>
 *   Content-Type: application/json
 *
 * Body:
 *   {
 *     "wb_complaint_id": "12345" (optional),
 *     "sent_at": "2026-01-10T12:00:00.000Z" (optional)
 *   }
 *
 * Response 200:
 *   {
 *     "success": true,
 *     "message": "Complaint marked as sent",
 *     "review_id": "...",
 *     "new_status": "sent"
 *   }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { storeId: string; reviewId: string } }
) {
  const { storeId, reviewId } = params;

  console.log(`[Extension Mark Sent] 📤 Отметка жалобы как отправленной для отзыва ${reviewId}`);

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

    // 3. Проверка существования отзыва
    const reviewResult = await query<{
      id: string;
      complaint_status: string;
    }>(
      'SELECT id, complaint_status FROM reviews_all WHERE id = $1 AND store_id = $2',
      [reviewId, storeId]
    );

    if (!reviewResult.rows[0]) {
      return NextResponse.json(
        { error: 'Not found', message: `Review ${reviewId} not found` },
        { status: 404 }
      );
    }

    // 4. Проверка что жалоба в статусе draft
    if (reviewResult.rows[0].complaint_status !== 'draft') {
      console.warn(`[Extension Mark Sent] ⚠️ Жалоба не в статусе draft: ${reviewResult.rows[0].complaint_status}`);
      return NextResponse.json(
        {
          error: 'Bad request',
          message: `Complaint is not in draft status (current: ${reviewResult.rows[0].complaint_status})`,
        },
        { status: 400 }
      );
    }

    // 5. Парсинг body (optional)
    let body: MarkSentRequestBody = {};
    try {
      body = await request.json();
    } catch {
      // Body опциональный
    }

    // 6. Обновить статусы в reviews (Sprint-013: try both tables)
    // Сразу ставим 'pending' (на рассмотрении), так как WB показывает "Проверяем жалобу"
    const upd = await query(
      'UPDATE reviews SET complaint_status = $1, updated_at = NOW() WHERE id = $2',
      ['pending', reviewId]
    );
    if ((upd.rowCount || 0) === 0) {
      await query(
        'UPDATE reviews_archive SET complaint_status = $1, updated_at = NOW() WHERE id = $2',
        ['pending', reviewId]
      );
    }

    // 7. Обновить review_complaints
    // Сразу ставим 'pending' (на рассмотрении)
    const sentAt = body.sent_at ? new Date(body.sent_at) : new Date();

    await query(
      `UPDATE review_complaints
       SET status = $1, sent_at = $2, sent_by_user_id = $3, wb_complaint_id = $4, updated_at = NOW()
       WHERE review_id = $5`,
      ['pending', sentAt, user.id, body.wb_complaint_id || null, reviewId]
    );

    console.log(`[Extension Mark Sent] ✅ Жалоба отмечена как на рассмотрении: ${reviewId}`);

    return NextResponse.json({
      success: true,
      message: 'Complaint marked as pending (under review)',
      review_id: reviewId,
      new_status: 'pending',
      sent_at: sentAt.toISOString(),
    });

  } catch (error: any) {
    console.error(`[Extension Mark Sent] ❌ Ошибка:`, error);

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
