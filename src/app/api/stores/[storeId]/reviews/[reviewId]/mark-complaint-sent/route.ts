import { NextRequest, NextResponse } from 'next/server';
import { markReviewComplaintSent } from '@/db/helpers';
import { verifyApiKey } from '@/lib/server-utils';

/**
 * @swagger
 * /api/stores/{storeId}/reviews/{reviewId}/mark-complaint-sent:
 *   post:
 *     summary: Отметить жалобу как отправленную
 *     description: Устанавливает дату отправки жалобы
 *     tags:
 *       - Отзывы
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID магазина
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID отзыва
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       '200':
 *         description: Жалоба отмечена как отправленная
 *       '401':
 *         description: Ошибка авторизации
 *       '404':
 *         description: Отзыв не найден
 *       '500':
 *         description: Внутренняя ошибка сервера
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { storeId: string; reviewId: string } }
) {
  try {
    // Verify API key
    const authResult = await verifyApiKey(request);
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const { reviewId } = params;

    // Mark complaint as sent
    const updatedReview = await markReviewComplaintSent(reviewId);

    if (!updatedReview) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: 'Complaint marked as sent', data: updatedReview },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[API ERROR] POST /api/stores/[storeId]/reviews/[reviewId]/mark-complaint-sent:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
