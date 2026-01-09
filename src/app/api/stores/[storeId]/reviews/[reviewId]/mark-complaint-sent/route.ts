import { NextRequest, NextResponse } from 'next/server';
import { markComplaintAsSent, getComplaintByReviewId } from '@/db/complaint-helpers';
import { verifyApiKey } from '@/lib/server-utils';

/**
 * @swagger
 * /api/stores/{storeId}/reviews/{reviewId}/mark-complaint-sent:
 *   post:
 *     summary: Отметить жалобу как отправленную
 *     description: |
 *       Отмечает жалобу как отправленную на WB.
 *       После этого жалоба становится immutable (нельзя редактировать/регенерировать).
 *       Статус меняется с 'draft' на 'sent'.
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 complaint:
 *                   type: object
 *                   description: Updated complaint data
 *       '400':
 *         description: Жалоба не в статусе draft или уже отправлена
 *       '401':
 *         description: Ошибка авторизации
 *       '404':
 *         description: Жалоба не найдена
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

    // Check if complaint exists
    const existingComplaint = await getComplaintByReviewId(reviewId);

    if (!existingComplaint) {
      return NextResponse.json(
        { error: 'Complaint not found for this review' },
        { status: 404 }
      );
    }

    // Check if complaint is in draft status
    if (existingComplaint.status !== 'draft') {
      return NextResponse.json(
        {
          error: 'Complaint already sent',
          details: `Complaint has status '${existingComplaint.status}' and cannot be marked as sent again.`
        },
        { status: 400 }
      );
    }

    // Mark complaint as sent
    const updatedComplaint = await markComplaintAsSent(reviewId, {
      sent_by_user_id: authResult.userId || 'system',
    });

    console.log(`[COMPLAINT] Marked as sent: review=${reviewId}, complaint=${updatedComplaint?.id}`);

    return NextResponse.json(
      {
        message: 'Complaint marked as sent successfully',
        complaint: updatedComplaint,
      },
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
