import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';
import { verifyApiKey } from '@/lib/server-utils';

/**
 * Refresh reviews for a store from WB Feedbacks API
 * @param storeId Store ID
 * @param mode 'full' = full sync (up to 20k reviews), 'incremental' = only new reviews since last sync
 */
async function refreshReviewsForStore(storeId: string, mode: 'full' | 'incremental') {
    console.log(`[API REVIEWS] Starting refresh for store ${storeId}, mode: ${mode}`);

    // Immediately update status to 'pending'
    await dbHelpers.updateStore(storeId, {
        last_review_update_status: 'pending',
        last_review_update_date: new Date().toISOString()
    });

    try {
        // Get store
        const store = await dbHelpers.getStoreById(storeId);
        if (!store) throw new Error(`Store ${storeId} not found.`);

        // Get WB token
        const wbToken = store.feedbacks_api_token || store.api_token;
        if (!wbToken) throw new Error('Feedbacks API token not found.');

        // Get all products and build map: wbProductId → product
        const products = await dbHelpers.getProducts(storeId);
        const productMap = new Map(products.map(p => [p.wb_product_id, p]));

        console.log(`[API REVIEWS] Found ${products.length} products for store ${storeId}`);

        let totalFetchedReviews = 0;
        let sessionLatestReviewDate = new Date(0);

        // For incremental mode, calculate dateFrom (go back 1 hour to be safe)
        const dateFrom = (mode === 'incremental' && store.last_review_update_date)
            ? Math.floor((new Date(store.last_review_update_date).getTime() / 1000) - 3600) // Unix timestamp
            : undefined;

        console.log(`[API REVIEWS] Fetching from date: ${dateFrom ? new Date(dateFrom * 1000).toISOString() : 'beginning'}`);

        // Fetch both answered and unanswered reviews
        for (const isAnswered of [false, true]) {
            let skip = 0;
            const BATCH_SIZE = 500;
            console.log(`[API REVIEWS] Fetching ${isAnswered ? 'answered' : 'unanswered'} reviews.`);

            while (true) {
                // Build query params
                const params: any = {
                    isAnswered: String(isAnswered),
                    take: String(BATCH_SIZE),
                    skip: String(skip),
                    order: 'dateDesc'
                };
                if (dateFrom) params.dateFrom = String(dateFrom);

                const url = new URL('https://feedbacks-api.wildberries.ru/api/v1/feedbacks');
                url.search = new URLSearchParams(params).toString();

                // Fetch from WB API
                const response = await fetch(url.toString(), {
                    headers: { 'Authorization': wbToken }
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`[API REVIEWS] WB API error: ${response.status} ${errorText}`);
                    throw new Error(`Ошибка API отзывов WB: ${response.status}`);
                }

                const result = await response.json();
                const feedbacks = result?.data?.feedbacks || [];
                console.log(`[API REVIEWS] Fetched ${feedbacks.length} reviews from WB (skip: ${skip}).`);

                if (feedbacks.length > 0) {
                    // Process each review
                    for (const review of feedbacks) {
                        totalFetchedReviews++;
                        const reviewDate = new Date(review.createdDate);
                        if (reviewDate > sessionLatestReviewDate) {
                            sessionLatestReviewDate = reviewDate;
                        }

                        // Map WB nmId to product
                        const nmId = String(review.productDetails?.nmId);
                        const product = productMap.get(nmId);
                        if (!product) {
                            console.log(`[API REVIEWS] Product not found for nmId ${nmId}, skipping review ${review.id}`);
                            continue;
                        }

                        // Check if review has WB complaint
                        const hasWbComplaint = !!review.supplierFeedbackValuation || !!review.supplierProductValuation;

                        // Get existing review to preserve manual complaint data
                        const existingReview = await dbHelpers.getReviewById(review.id);

                        // Prepare review payload
                        const payload: Omit<dbHelpers.Review, 'created_at' | 'updated_at'> = {
                            id: review.id,
                            product_id: product.id,
                            store_id: storeId,
                            owner_id: store.owner_id,
                            rating: review.productValuation,
                            text: review.text || review.pros || review.cons || '', // Ensure non-null text
                            pros: review.pros || '',
                            cons: review.cons || '',
                            author: review.userName || 'Anonymous',
                            date: review.createdDate,
                            answer: review.answer ? { text: review.answer.text || '', state: review.answer.state || '' } : null,
                            photo_links: review.photoLinks || null,
                            video: review.video || null,
                            supplier_feedback_valuation: review.supplierFeedbackValuation || null,
                            supplier_product_valuation: review.supplierProductValuation || null,
                            // Preserve manual complaint if it exists
                            complaint_text: existingReview?.complaint_text || null,
                            complaint_sent_date: existingReview?.complaint_sent_date || null,
                            draft_reply: existingReview?.draft_reply || null,
                        };

                        // Upsert review
                        await dbHelpers.upsertReview(payload);
                    }
                }

                // Check if we should continue fetching
                if (feedbacks.length < BATCH_SIZE) break;
                skip += BATCH_SIZE;
                if (mode === 'full' && skip >= 20000) {
                    console.log(`[API REVIEWS] Reached 20k reviews limit in full mode.`);
                    break;
                }

                // Add small delay to avoid rate limiting
                await new Promise(res => setTimeout(res, 500));
            }
        }

        console.log(`[API REVIEWS] Finished fetching. Total: ${totalFetchedReviews}. Recalculating store stats.`);

        // Count total reviews in store
        const stats = await dbHelpers.getStoreStats(storeId);

        // Determine final update date
        const finalUpdateDate = (mode === 'full' || sessionLatestReviewDate.getTime() > 0)
            ? sessionLatestReviewDate.toISOString()
            : store.last_review_update_date;

        // Update store with success status
        await dbHelpers.updateStore(storeId, {
            last_review_update_status: 'success',
            last_review_update_date: finalUpdateDate,
            total_reviews: stats.totalReviews
        });

        console.log(`[API REVIEWS] Successfully updated store ${storeId}. Total reviews in DB: ${stats.totalReviews}`);
        return `Успешно обновлено ${totalFetchedReviews} отзывов.`;

    } catch (error: any) {
        console.error(`[API REVIEWS] ERROR for store ${storeId}:`, error);

        // Update store with error status
        await dbHelpers.updateStore(storeId, {
            last_review_update_status: 'error',
            last_review_update_error: error.message || 'Unknown error'
        });

        // Re-throw the error so the API route can catch it
        throw error;
    }
}

/**
 * @swagger
 * /api/stores/{storeId}/reviews/update:
 *   post:
 *     summary: Запустить обновление отзывов для магазина
 *     description: |
 *       Синхронизирует отзывы из WB Feedbacks API в PostgreSQL.
 *       Поддерживает два режима: `incremental` (только новые) и `full` (полная синхронизация до 20k отзывов).
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
 *         name: mode
 *         schema:
 *           type: string
 *           enum: [incremental, full]
 *           default: incremental
 *         description: Режим обновления.
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       '200':
 *         description: Успешный ответ.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Успешно обновлено 150 отзывов."
 *       '401':
 *         description: Ошибка авторизации.
 *       '404':
 *         description: Магазин не найден.
 *       '500':
 *         description: Внутренняя ошибка сервера.
 */
export async function POST(request: NextRequest, { params }: { params: { storeId: string } }) {
    const { storeId } = params;
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') === 'full' ? 'full' : 'incremental';

    try {
        // Verify API key
        const authResult = await verifyApiKey(request);
        if (!authResult.authorized) {
            return NextResponse.json({ error: authResult.error }, { status: 401 });
        }

        // Check if store exists
        const store = await dbHelpers.getStoreById(storeId);
        if (!store) {
            return NextResponse.json({ error: 'Store not found.' }, { status: 404 });
        }

        // Run sync
        const message = await refreshReviewsForStore(storeId, mode);

        return NextResponse.json({
            message: message || `Процесс обновления отзывов для магазина ${storeId} в режиме '${mode}' успешно завершен.`
        }, { status: 200 });

    } catch (error: any) {
        console.error(`[API ERROR] /api/stores/${storeId}/reviews/update:`, error);
        return NextResponse.json({
            error: 'Internal Server Error',
            details: String(error.message || 'An unknown error occurred in the API route.')
        }, { status: 500 });
    }
}
