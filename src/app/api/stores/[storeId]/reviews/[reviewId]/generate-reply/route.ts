import { NextRequest, NextResponse } from 'next/server';
import { getReviewById, getStoreById, getProductById, updateReviewDraftReply } from '@/db/helpers';
import { generateReviewReply } from '@/ai/flows/generate-review-reply-flow';
import { verifyApiKey } from '@/lib/server-utils';
import { buildStoreInstructions } from '@/lib/ai-context';

/**
 * @swagger
 * /api/stores/{storeId}/reviews/{reviewId}/generate-reply:
 *   post:
 *     summary: Сгенерировать AI ответ на отзыв
 *     description: Генерирует ответ на отзыв с помощью AI и сохраняет его как черновик
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
 *         description: Успешная генерация ответа
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 draftReply:
 *                   type: string
 *                   description: Сгенерированный текст ответа
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

    const { storeId, reviewId } = params;

    // Get review
    const review = await getReviewById(reviewId);
    if (!review) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      );
    }

    // Get store
    const store = await getStoreById(storeId);
    if (!store) {
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 404 }
      );
    }

    // Get product details
    const product = await getProductById(review.product_id);
    const productName = product?.name || 'Товар';
    const productVendorCode = product?.vendor_code || '';
    const productCharacteristics = product?.characteristics
      ? JSON.stringify(product.characteristics)
      : undefined;

    // Generate AI reply
    const { replyText } = await generateReviewReply({
      storeName: store.name,
      reviewText: review.text,
      reviewPros: review.pros || undefined,
      reviewCons: review.cons || undefined,
      reviewRating: review.rating,
      reviewAuthor: review.author,
      productName,
      productVendorCode,
      productCharacteristics,
      storeId,
      ownerId: store.owner_id,
      reviewId,
      storeInstructions: await buildStoreInstructions(storeId, store.ai_instructions),
    });

    // Save as draft
    await updateReviewDraftReply(reviewId, replyText);

    return NextResponse.json(
      { draftReply: replyText },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[API ERROR] POST /api/stores/[storeId]/reviews/[reviewId]/generate-reply:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
