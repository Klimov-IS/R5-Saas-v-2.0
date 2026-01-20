import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';
import { verifyApiKey } from '@/lib/server-utils';
import {
    autoGenerateComplaintsInBackground,
    shouldGenerateComplaint,
} from '@/services/auto-complaint-generator';

/**
 * Generate initial date chunks for WB API with adaptive sizing
 * Strategy: Start with large chunks (90 days) working backwards from today
 * Chunks will be split dynamically if they contain >19k reviews
 */
function generateInitialDateChunks(startDate: Date, endDate: Date): Array<{ from: number; to: number; days: number }> {
    const chunks: Array<{ from: number; to: number; days: number }> = [];
    const INITIAL_CHUNK_DAYS = 90; // Start with 90-day chunks

    let currentEnd = endDate;
    const start = startDate;

    while (currentEnd > start) {
        const currentStart = new Date(currentEnd);
        currentStart.setDate(currentStart.getDate() - INITIAL_CHUNK_DAYS);

        // Don't go before the start date
        if (currentStart < start) {
            currentStart.setTime(start.getTime());
        }

        chunks.push({
            from: Math.floor(currentStart.getTime() / 1000), // Unix timestamp
            to: Math.floor(currentEnd.getTime() / 1000),
            days: Math.ceil((currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24))
        });

        currentEnd = new Date(currentStart.getTime() - 1000); // Move to 1 second before
    }

    return chunks;
}

/**
 * Split a chunk into smaller chunks for adaptive processing
 */
function splitChunk(chunk: { from: number; to: number; days: number }, parts: number): Array<{ from: number; to: number; days: number }> {
    const totalMs = (chunk.to - chunk.from) * 1000;
    const chunkSizeMs = totalMs / parts;
    const subChunks: Array<{ from: number; to: number; days: number }> = [];

    for (let i = 0; i < parts; i++) {
        const subStart = chunk.from + Math.floor((chunkSizeMs * i) / 1000);
        const subEnd = i === parts - 1 ? chunk.to : chunk.from + Math.floor((chunkSizeMs * (i + 1)) / 1000) - 1;
        const days = Math.ceil((subEnd - subStart) / (60 * 60 * 24));

        subChunks.push({ from: subStart, to: subEnd, days });
    }

    return subChunks;
}

/**
 * Refresh reviews for a store from WB Feedbacks API
 * @param storeId Store ID
 * @param mode 'full' = full sync (ALL reviews using date chunking), 'incremental' = only new reviews since last sync
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
        const newReviewIds: string[] = []; // Track new reviews for auto-complaint generation

        // Determine date range strategy
        let dateChunks: Array<{ from: number; to: number; days: number }>;

        if (mode === 'incremental') {
            // Incremental: Only fetch reviews since last update (go back 1 hour to be safe)
            const fromDate = store.last_review_update_date
                ? new Date(new Date(store.last_review_update_date).getTime() - 3600 * 1000)
                : new Date(Date.now() - 7 * 24 * 3600 * 1000); // Last 7 days as fallback

            dateChunks = [{
                from: Math.floor(fromDate.getTime() / 1000),
                to: Math.floor(Date.now() / 1000),
                days: Math.ceil((Date.now() - fromDate.getTime()) / (1000 * 60 * 60 * 24))
            }];

            console.log(`[API REVIEWS] Incremental mode: fetching from ${fromDate.toISOString()}`);
        } else {
            // Full mode: Fetch ALL reviews using adaptive chunking
            // Start from January 1, 2020 (WB reviews unlikely to be older)
            const startDate = new Date('2020-01-01T00:00:00Z');
            const endDate = new Date();

            dateChunks = generateInitialDateChunks(startDate, endDate);
            console.log(`[API REVIEWS] Full mode: starting with ${dateChunks.length} initial chunks (90 days each, adaptive)`);
        }

        // Process chunks with adaptive splitting
        let processedChunks = 0;
        const totalEstimatedChunks = dateChunks.length;

        while (dateChunks.length > 0) {
            const chunk = dateChunks.shift()!;
            processedChunks++;

            const chunkStart = new Date(chunk.from * 1000);
            const chunkEnd = new Date(chunk.to * 1000);

            console.log(`[API REVIEWS] Processing chunk [${processedChunks}]: ${chunkStart.toISOString().split('T')[0]} → ${chunkEnd.toISOString().split('T')[0]} (${chunk.days} days)`);

            let chunkTotalReviews = 0;

            // Fetch both answered and unanswered reviews for this chunk
            for (const isAnswered of [false, true]) {
                let skip = 0;
                const BATCH_SIZE = 500;
                const MAX_SKIP = 20000; // WB API hard limit per date range
                let chunkReviewCount = 0;

                while (skip < MAX_SKIP) {
                    // Build query params
                    const params: any = {
                        isAnswered: String(isAnswered),
                        take: String(BATCH_SIZE),
                        skip: String(skip),
                        order: 'dateDesc',
                        dateFrom: String(chunk.from),
                        dateTo: String(chunk.to)
                    };

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
                    chunkReviewCount += feedbacks.length;

                    if (feedbacks.length > 0) {
                        // Process each review (upsert directly without fetching existing)
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

                            // Check if review is new (for auto-complaint generation)
                            const existingReview = await dbHelpers.getReviewById(review.id);
                            const isNewReview = !existingReview;

                            // Prepare review payload
                            // NOTE: upsertReview preserves complaint_text/complaint_sent_date/draft_reply automatically via ON CONFLICT DO UPDATE
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
                                complaint_text: null, // Will be preserved by ON CONFLICT if exists
                                complaint_sent_date: null, // Will be preserved by ON CONFLICT if exists
                                draft_reply: null, // Will be preserved by ON CONFLICT if exists
                            };

                            // Upsert review
                            await dbHelpers.upsertReview(payload);

                            // Track new reviews for auto-complaint generation
                            if (isNewReview) {
                                newReviewIds.push(review.id);
                            }
                        }
                    }

                    // Check if we should continue fetching
                    if (feedbacks.length < BATCH_SIZE) {
                        break; // No more reviews in this chunk
                    }

                    skip += BATCH_SIZE;

                    // Add small delay to avoid rate limiting
                    await new Promise(res => setTimeout(res, 300));
                }

                chunkTotalReviews += chunkReviewCount;
            }

            // Adaptive chunk splitting logic
            console.log(`[API REVIEWS] Chunk completed: ${chunkTotalReviews} reviews fetched`);

            if (mode === 'full' && chunkTotalReviews >= 19000 && chunk.days > 7) {
                // Chunk is too large, split it into smaller chunks
                console.log(`[API REVIEWS] ⚠️  Chunk has ${chunkTotalReviews} reviews (>19k limit). Splitting ${chunk.days}-day chunk into 3 parts...`);
                const subChunks = splitChunk(chunk, 3);

                // Add sub-chunks to the FRONT of the queue (process them next)
                dateChunks.unshift(...subChunks);

                console.log(`[API REVIEWS] Added ${subChunks.length} sub-chunks to queue (now ${dateChunks.length} chunks remaining)`);
            }

            // ⏳ Add delay between chunks to avoid WB API Rate Limit (429)
            // WB API has per-seller rate limit (~5-10 requests/min), so we add 10s delay after each chunk
            if (dateChunks.length > 0) {
                console.log(`[API REVIEWS] ⏳ Waiting 10 seconds before next chunk (Rate Limit prevention)...`);
                await new Promise(res => setTimeout(res, 10000));
            }

            // ✅ Periodic stats update: Update total_reviews counter every 5 chunks
            // This allows monitoring progress in real-time and preserves partial progress on error
            if (processedChunks % 5 === 0 && mode === 'full') {
                const currentStats = await dbHelpers.getStoreStats(storeId);
                await dbHelpers.updateStore(storeId, {
                    total_reviews: currentStats.totalReviews,
                    last_review_update_date: new Date().toISOString()
                });
                console.log(`[API REVIEWS] 📊 Progress update [${processedChunks} chunks]: ${currentStats.totalReviews} reviews in DB`);
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

        // ============================================================================
        // EVENT-DRIVEN AUTO-COMPLAINT GENERATION
        // ============================================================================

        if (newReviewIds.length > 0) {
            console.log(`[AUTO-COMPLAINT] Found ${newReviewIds.length} new reviews — checking for auto-complaint generation`);

            // Filter eligible reviews (check product_rules and business logic)
            const eligibleReviewIds: string[] = [];
            for (const reviewId of newReviewIds) {
                const review = await dbHelpers.getReviewById(reviewId);
                if (review && (await shouldGenerateComplaint(review))) {
                    eligibleReviewIds.push(reviewId);
                }
            }

            if (eligibleReviewIds.length > 0) {
                console.log(`[AUTO-COMPLAINT] ${eligibleReviewIds.length}/${newReviewIds.length} reviews eligible for complaints`);

                // Get API key for complaint generation
                const apiKey = process.env.NEXT_PUBLIC_API_KEY || store.api_token || '';

                // Trigger background generation (non-blocking — don't wait for completion)
                autoGenerateComplaintsInBackground(storeId, eligibleReviewIds, apiKey).catch((err) => {
                    console.error('[AUTO-COMPLAINT] Background generation failed (will retry on CRON):', err);
                });

                console.log(`[AUTO-COMPLAINT] Background generation triggered for ${eligibleReviewIds.length} reviews`);
            } else {
                console.log(`[AUTO-COMPLAINT] No eligible reviews for auto-complaint generation`);
            }
        } else {
            console.log(`[AUTO-COMPLAINT] No new reviews — skipping auto-complaint generation`);
        }

        return `Успешно обновлено ${totalFetchedReviews} отзывов (всего в БД: ${stats.totalReviews}).`;

    } catch (error: any) {
        console.error(`[API REVIEWS] ERROR for store ${storeId}:`, error);

        // ✅ Recalculate stats EVEN on error to preserve partial progress
        // If error happens on chunk #15, we still want to show chunks 1-14 were saved
        const currentStats = await dbHelpers.getStoreStats(storeId);

        // Update store with error status AND updated review count
        await dbHelpers.updateStore(storeId, {
            last_review_update_status: 'error',
            last_review_update_error: error.message || 'Unknown error',
            total_reviews: currentStats.totalReviews // ✅ Preserve partial sync progress!
        });

        console.log(`[API REVIEWS] ❌ Error occurred, but preserved partial progress: ${currentStats.totalReviews} reviews in DB`);

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
 *       Поддерживает два режима:
 *       - `incremental`: Только новые отзывы с момента последней синхронизации
 *       - `full`: Полная синхронизация ВСЕХ отзывов (обход лимита 20k через date chunking)
 *
 *       **Адаптивная стратегия полной синхронизации:**
 *       - Начинает с больших 90-дневных chunks (с 2020-01-01 до сегодня)
 *       - Если chunk содержит ≥19k отзывов → автоматически разбивает на 3 меньших chunk
 *       - Минимальный размер chunk: 7 дней (не разбивается дальше)
 *       - Позволяет получить магазины с 1M+ отзывами эффективно
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
 *         description: |
 *           Режим обновления:
 *           - `incremental`: Только новые отзывы (быстро)
 *           - `full`: Все отзывы через date chunking (медленно, для первичной загрузки)
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
 *                   example: "Успешно обновлено 150000 отзывов (всего в БД: 1000000)."
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
