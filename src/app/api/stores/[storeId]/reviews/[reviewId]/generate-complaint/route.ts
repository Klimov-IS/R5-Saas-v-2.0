import { NextRequest, NextResponse } from 'next/server';
import { getReviewById, getStoreById, getProductById, updateReviewComplaint } from '@/db/helpers';
import { generateReviewComplaint } from '@/ai/flows/generate-review-complaint-flow';
import { verifyApiKey } from '@/lib/server-utils';

/**
 * @swagger
 * /api/stores/{storeId}/reviews/{reviewId}/generate-complaint:
 *   post:
 *     summary: Сгенерировать AI жалобу на отзыв
 *     description: Генерирует жалобу на отзыв с помощью AI и сохраняет её как черновик
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
 *         description: Успешная генерация жалобы
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 complaintText:
 *                   type: string
 *                   description: Сгенерированный текст жалобы
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
    const productCharacteristics = product?.wb_api_data?.characteristics
      ? JSON.stringify(product.wb_api_data.characteristics)
      : undefined;

    // Generate AI complaint
    const { complaintText } = await generateReviewComplaint({
      productName,
      productVendorCode,
      productCharacteristics,
      compensationMethod: undefined, // TODO: Get from product rules
      reviewAuthor: review.author,
      reviewText: review.text || '',
      reviewRating: review.rating,
      reviewPros: review.pros || undefined,
      reviewCons: review.cons || undefined,
      reviewDate: review.date,
      storeId,
      ownerId: store.owner_id,
      reviewId,
    });

    // Save as draft
    await updateReviewComplaint(reviewId, complaintText);

    return NextResponse.json(
      { complaintText },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[API ERROR] POST /api/stores/[storeId]/reviews/[reviewId]/generate-complaint:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
