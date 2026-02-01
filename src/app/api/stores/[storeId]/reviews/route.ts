import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';

/**
 * @swagger
 * /api/stores/{storeId}/reviews:
 *   get:
 *     summary: Получить список всех отзывов для магазина
 *     description: Возвращает список всех отзывов по всем товарам для указанного магазина с возможностью пагинации.
 *     tags:
 *       - Отзывы
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID магазина
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Количество отзывов, которое нужно пропустить (для пагинации).
 *       - in: query
 *         name: take
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Количество отзывов, которое нужно вернуть (для пагинации).
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       '200':
 *         description: Успешный ответ
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Review'
 *       '401':
 *         description: Ошибка авторизации.
 *       '404':
 *         description: Магазин не найден.
 *       '500':
 *         description: Внутренняя ошибка сервера.
 */
export async function GET(request: NextRequest, { params }: { params: { storeId: string } }) {
    const { storeId } = params;
    const { searchParams } = new URL(request.url);

    const skip = parseInt(searchParams.get('skip') || '0', 10);
    const take = parseInt(searchParams.get('take') || '100', 10);
    const rating = searchParams.get('rating') || 'all';
    const hasAnswer = searchParams.get('hasAnswer') || 'all';
    const hasComplaint = searchParams.get('hasComplaint') || 'all';
    const productId = searchParams.get('productId') || '';
    const activeOnly = searchParams.get('activeOnly') === 'true';
    const productStatus = searchParams.get('productStatus') || 'all';
    const search = searchParams.get('search') || '';

    // New status filters
    const reviewStatusWB = searchParams.get('reviewStatusWB') || 'all';
    const productStatusByReview = searchParams.get('productStatusByReview') || 'all';
    const complaintStatus = searchParams.get('complaintStatus') || 'all';

    try {
        // Get reviews with pagination and filters
        const reviews = await dbHelpers.getReviewsByStoreWithPagination(storeId, {
            limit: take,
            offset: skip,
            rating,
            hasAnswer,
            hasComplaint,
            productId,
            activeOnly,
            productStatus,
            search,
            reviewStatusWB,
            productStatusByReview,
            complaintStatus
        });

        // Get total count with same filters
        const totalCount = await dbHelpers.getReviewsCount(storeId, {
            rating,
            hasAnswer,
            hasComplaint,
            productId,
            activeOnly,
            productStatus,
            search,
            reviewStatusWB,
            productStatusByReview,
            complaintStatus
        });

        // Format response (match old API structure with snake_case for consistency with Review type)
        const responseData = reviews.map(review => ({
            id: review.id,
            product_id: review.product_id,
            store_id: review.store_id,
            rating: review.rating,
            text: review.text,
            pros: review.pros,
            cons: review.cons,
            author: review.author,
            date: review.date,
            answer: review.answer || null,
            draft_reply: review.draft_reply || null,
            complaint_text: review.complaint_text || null,
            complaint_sent_date: review.complaint_sent_date || null,
            has_answer: !!review.answer,
            has_complaint: !!review.complaint_sent_date,
            has_complaint_draft: !!review.complaint_text && !review.complaint_sent_date,
            // New status fields
            review_status_wb: review.review_status_wb || 'unknown',
            product_status_by_review: review.product_status_by_review || 'unknown',
            chat_status_by_review: review.chat_status_by_review || 'unknown',
            complaint_status: review.complaint_status || 'not_sent',
            complaint_generated_at: review.complaint_generated_at || null,
            complaint_reason_id: review.complaint_reason_id || null,
            complaint_category: review.complaint_category || null,
            purchase_date: review.purchase_date || null,
            parsed_at: review.parsed_at || null,
            page_number: review.page_number || null,
            is_product_active: review.is_product_active !== undefined ? review.is_product_active : true,
        }));

        return NextResponse.json({
            data: responseData,
            totalCount
        }, { status: 200 });

    } catch (error: any) {
        console.error("Failed to fetch reviews via API:", error.message, error.stack);
        return NextResponse.json({
            error: 'Internal server error',
            details: error.message
        }, { status: 500 });
    }
}
