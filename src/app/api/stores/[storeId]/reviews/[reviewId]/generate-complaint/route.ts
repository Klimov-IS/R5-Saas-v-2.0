import { NextRequest, NextResponse } from 'next/server';
import { getReviewById, getStoreById, getProductById } from '@/db/helpers';
import {
  getComplaintByReviewId,
  createComplaint,
  regenerateComplaint,
  COMPLAINT_CUTOFF_DATE,
} from '@/db/complaint-helpers';
import { generateReviewComplaint } from '@/ai/flows/generate-review-complaint-flow';
import { verifyApiKey } from '@/lib/server-utils';
import { selectRelevantCharacteristics, calculateTokenSavings } from '@/ai/utils/product-characteristics-filter';

/**
 * @swagger
 * /api/stores/{storeId}/reviews/{reviewId}/generate-complaint:
 *   post:
 *     summary: Сгенерировать AI жалобу на отзыв
 *     description: |
 *       Генерирует жалобу на отзыв с помощью AI и сохраняет её в таблицу review_complaints.
 *       Если жалоба уже существует и имеет статус 'draft', то перегенерирует её.
 *       Если жалоба уже отправлена (sent/pending/approved/rejected), возвращает ошибку.
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
 *                 reasonId:
 *                   type: number
 *                   description: ID категории WB (11-20)
 *                 reasonName:
 *                   type: string
 *                   description: Название категории жалобы
 *                 isRegenerated:
 *                   type: boolean
 *                   description: Была ли жалоба перегенерирована
 *                 regeneratedCount:
 *                   type: number
 *                   description: Количество регенераций
 *       '400':
 *         description: Жалоба уже отправлена, нельзя регенерировать
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

    // Check if rating is 5 (cannot generate complaint for 5-star reviews)
    if (review.rating === 5) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_RATING',
            message: 'Нельзя подать жалобу на отзыв с 5 звёздами'
          }
        },
        { status: 400 }
      );
    }

    // Check if review is too old (WB rule: no complaints for reviews before Oct 1, 2023)
    const reviewDate = new Date(review.date);
    const cutoffDate = new Date(COMPLAINT_CUTOFF_DATE);
    if (reviewDate < cutoffDate) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'REVIEW_TOO_OLD',
            message: `Нельзя подать жалобу на отзыв старше ${COMPLAINT_CUTOFF_DATE}. Правило WB.`
          }
        },
        { status: 400 }
      );
    }

    // Check if review already has a complaint status from extension sync
    // Allowed: NULL, 'not_sent', 'draft' (draft can be regenerated)
    // Blocked: 'sent', 'pending', 'approved', 'rejected', 'reconsidered'
    const reviewComplaintStatus = (review as any).complaint_status;
    if (reviewComplaintStatus &&
        reviewComplaintStatus !== 'not_sent' &&
        reviewComplaintStatus !== 'draft') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'COMPLAINT_EXISTS',
            message: `Жалоба уже подана (статус: ${reviewComplaintStatus}). Повторная генерация невозможна.`
          }
        },
        { status: 400 }
      );
    }

    // Check if complaint already exists
    const existingComplaint = await getComplaintByReviewId(reviewId);

    // If complaint exists and is not in draft status, cannot regenerate
    if (existingComplaint && existingComplaint.status !== 'draft') {
      return NextResponse.json(
        {
          error: 'Complaint already sent',
          details: `Complaint has status '${existingComplaint.status}' and cannot be regenerated. Only draft complaints can be regenerated.`
        },
        { status: 400 }
      );
    }

    // Get product details
    const product = await getProductById(review.product_id);
    const productName = product?.name || 'Товар';
    const productVendorCode = product?.vendor_code || '';

    // Filter and select relevant characteristics (optimized for token usage)
    const fullReviewText = [review.text, review.pros, review.cons]
      .filter(Boolean)
      .join(' ');

    const productCharacteristics = selectRelevantCharacteristics(
      product?.wb_api_data?.characteristics,
      fullReviewText,
      7 // Max 7 characteristics
    );

    // Log token savings for monitoring
    if (product?.wb_api_data?.characteristics) {
      const savings = calculateTokenSavings(
        product.wb_api_data.characteristics,
        productCharacteristics
      );
      console.log(`[AI OPTIMIZATION] Characteristics token savings: ${savings.savedPercent}% (${savings.saved} chars)`);
    }

    // Generate AI complaint
    const aiResult = await generateReviewComplaint({
      productName,
      productVendorCode,
      productCharacteristics,
      compensationMethod: undefined,
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

    let savedComplaint;
    let isRegenerated = false;

    if (existingComplaint) {
      // Regenerate existing draft complaint
      savedComplaint = await regenerateComplaint(
        reviewId,
        aiResult.complaintText,
        aiResult.reasonId,
        aiResult.reasonName,
        {
          promptTokens: aiResult.promptTokens,
          completionTokens: aiResult.completionTokens,
          totalTokens: aiResult.totalTokens,
          costUsd: aiResult.costUsd,
          durationMs: aiResult.durationMs,
        }
      );
      isRegenerated = true;

      console.log(`[COMPLAINT] Regenerated complaint for review ${reviewId}: count=${savedComplaint?.regenerated_count}`);
    } else {
      // Create new complaint
      savedComplaint = await createComplaint({
        review_id: reviewId,
        store_id: storeId,
        owner_id: store.owner_id,
        product_id: review.product_id,
        complaint_text: aiResult.complaintText,
        reason_id: aiResult.reasonId,
        reason_name: aiResult.reasonName,
        review_rating: review.rating,
        review_text: review.text || '',
        review_date: review.date,
        product_name: productName,
        product_vendor_code: productVendorCode,
        product_is_active: product?.is_active !== false,
        ai_model: 'deepseek-chat',
        ai_prompt_tokens: aiResult.promptTokens,
        ai_completion_tokens: aiResult.completionTokens,
        ai_total_tokens: aiResult.totalTokens,
        ai_cost_usd: aiResult.costUsd,
        generation_duration_ms: aiResult.durationMs,
      });

      console.log(`[COMPLAINT] Created new complaint for review ${reviewId}`);
    }

    return NextResponse.json(
      {
        complaintText: aiResult.complaintText,
        reasonId: aiResult.reasonId,
        reasonName: aiResult.reasonName,
        isRegenerated,
        regeneratedCount: savedComplaint?.regenerated_count || 0,
        aiMetrics: {
          promptTokens: aiResult.promptTokens,
          completionTokens: aiResult.completionTokens,
          totalTokens: aiResult.totalTokens,
          costUsd: aiResult.costUsd,
          durationMs: aiResult.durationMs,
        },
      },
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
