/**
 * Review Sync Logic — shared between API route and internal callers
 *
 * Extracted from /api/stores/[storeId]/reviews/update/route.ts
 * so that targeted sync can be called directly (without HTTP + auth).
 *
 * @module review-sync
 */

import * as dbHelpers from '@/db/helpers';
import { query } from '@/db/client';
import {
    autoGenerateComplaintsInBackground,
    shouldGenerateComplaint,
} from '@/services/auto-complaint-generator';
import { refreshOzonReviews } from '@/lib/ozon-review-sync';
import { closeLinkedChatsForReviews } from '@/db/review-chat-link-helpers';

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
 * @param dateRange Optional date range for targeted/rolling sync
 * @returns Status message string
 */
export async function refreshReviewsForStore(storeId: string, mode: 'full' | 'incremental', dateRange?: { from: Date; to: Date }): Promise<string> {
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

        // OZON stores: use OZON review sync
        if (store.marketplace === 'ozon') {
            const message = await refreshOzonReviews(storeId);
            return message || `OZON reviews synced for store ${storeId}`;
        }

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
        const seenReviewIds = new Set<string>(); // Track all review IDs from WB API (for deletion detection)
        const resurrectedIds: string[] = []; // Track reviews restored from 'deleted' status

        // Determine date range strategy
        let dateChunks: Array<{ from: number; to: number; days: number }>;

        if (mode === 'incremental') {
            // Incremental: Only fetch reviews since last update (go back 3 hours to catch WB API indexing delays)
            const fromDate = store.last_review_update_date
                ? new Date(new Date(store.last_review_update_date).getTime() - 3 * 3600 * 1000)
                : new Date(Date.now() - 7 * 24 * 3600 * 1000); // Last 7 days as fallback

            dateChunks = [{
                from: Math.floor(fromDate.getTime() / 1000),
                to: Math.floor(Date.now() / 1000),
                days: Math.ceil((Date.now() - fromDate.getTime()) / (1000 * 60 * 60 * 24))
            }];

            console.log(`[API REVIEWS] Incremental mode: fetching from ${fromDate.toISOString()}`);
        } else {
            // Full mode: Fetch ALL reviews using adaptive chunking
            // Use custom dateRange if provided (for rolling sync), otherwise default to 2020-01-01
            const startDate = dateRange?.from || new Date('2020-01-01T00:00:00Z');
            const endDate = dateRange?.to || new Date();

            dateChunks = generateInitialDateChunks(startDate, endDate);
            console.log(`[API REVIEWS] Full mode: ${dateRange ? 'rolling chunk' : 'full history'} — ${dateChunks.length} initial chunks (90 days each, adaptive)`);
            console.log(`[API REVIEWS] Date range: ${startDate.toISOString().split('T')[0]} → ${endDate.toISOString().split('T')[0]}`);
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
                                marketplace: 'wb',
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

                            // Track resurrection: review was deleted but WB API returned it again
                            const isResurrected = existingReview?.review_status_wb === 'deleted';

                            // Upsert review (auto-resets deleted → visible via CASE in SQL)
                            await dbHelpers.upsertReview(payload);
                            seenReviewIds.add(review.id);

                            if (isResurrected) {
                                resurrectedIds.push(review.id);
                            }

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

        // ============================================================================
        // DELETED REVIEW DETECTION (full sync mode only)
        // Compare reviews in DB vs reviews from WB API → mark missing as deleted
        // ============================================================================
        if (mode === 'full' && seenReviewIds.size > 0) {
            try {
                // Determine date range for DB comparison
                const rangeStart = dateRange?.from || new Date('2020-01-01T00:00:00Z');
                const rangeEnd = dateRange?.to || new Date();

                // Step 1: Get all non-deleted review IDs in DB for this store + date range
                const dbReviewsResult = await query<{ id: string }>(
                    `SELECT id FROM reviews
                     WHERE store_id = $1
                       AND date >= $2
                       AND date <= $3
                       AND review_status_wb != 'deleted'`,
                    [storeId, rangeStart.toISOString(), rangeEnd.toISOString()]
                );

                const dbReviewIds = new Set(dbReviewsResult.rows.map(r => r.id));

                // Step 2: Find reviews in DB but NOT returned by WB API
                const missingIds: string[] = [];
                for (const dbId of dbReviewIds) {
                    if (!seenReviewIds.has(dbId)) {
                        missingIds.push(dbId);
                    }
                }

                // Step 3: Safeguard — if >30% "deleted", likely API issue
                const deletionRatio = dbReviewIds.size > 0 ? missingIds.length / dbReviewIds.size : 0;

                if (missingIds.length === 0) {
                    console.log(`[DELETED DETECTION] No deleted reviews detected for store ${storeId}`);
                } else if (deletionRatio > 0.30) {
                    console.warn(`[DELETED DETECTION] ⚠️ SAFEGUARD: ${missingIds.length}/${dbReviewIds.size} (${(deletionRatio * 100).toFixed(1)}%) reviews appear deleted. Threshold exceeded (30%). SKIPPING.`);
                } else {
                    console.log(`[DELETED DETECTION] Found ${missingIds.length}/${dbReviewIds.size} potentially deleted reviews for store ${storeId}`);

                    // Step 4: Mark as deleted
                    const markResult = await query<{ id: string }>(
                        `UPDATE reviews
                         SET review_status_wb = 'deleted',
                             deleted_from_wb_at = NOW(),
                             updated_at = NOW()
                         WHERE id = ANY($1)
                           AND store_id = $2
                           AND review_status_wb IN ('unknown', 'visible')
                         RETURNING id`,
                        [missingIds, storeId]
                    );

                    const markedCount = markResult.rowCount ?? 0;
                    console.log(`[DELETED DETECTION] Marked ${markedCount} reviews as deleted`);

                    // Step 5: Auto-cancel draft complaints on deleted reviews
                    if (markedCount > 0) {
                        const markedIds = markResult.rows.map(r => r.id);

                        // Update review_complaints: draft → not_applicable
                        const complaintResult = await query<{ review_id: string }>(
                            `UPDATE review_complaints
                             SET status = 'not_applicable', updated_at = NOW()
                             WHERE review_id = ANY($1) AND status = 'draft'
                             RETURNING review_id`,
                            [markedIds]
                        );

                        // Update reviews.complaint_status for cancelled complaints (Sprint-013: both tables)
                        if ((complaintResult.rowCount ?? 0) > 0) {
                            const cancelledReviewIds = complaintResult.rows.map(r => r.review_id);
                            await query(
                                `UPDATE reviews
                                 SET complaint_status = 'not_applicable',
                                     has_complaint_draft = FALSE,
                                     updated_at = NOW()
                                 WHERE id = ANY($1)`,
                                [cancelledReviewIds]
                            );
                            console.log(`[DELETED DETECTION] Auto-cancelled ${complaintResult.rowCount} draft complaints on deleted reviews`);
                        }

                        // Step 5b: Immediately close linked chats for deleted reviews
                        const deletedChatsClosed = await closeLinkedChatsForReviews(markedIds, 'review_resolved');
                        if (deletedChatsClosed > 0) {
                            console.log(`[DELETED DETECTION] Auto-closed ${deletedChatsClosed} linked chats for deleted reviews`);
                        }
                    }
                }
            } catch (detectionError: any) {
                console.error(`[DELETED DETECTION] Error during deletion detection (non-fatal):`, detectionError.message);
                // Non-fatal — don't fail the sync
            }
        }

        // Log and restore resurrected reviews (deleted → visible via upsert CASE)
        if (resurrectedIds.length > 0) {
            console.log(`[RESURRECTION] Restored ${resurrectedIds.length} previously deleted reviews for store ${storeId}`);

            try {
                // Restore not_applicable complaints back to draft
                const restoredComplaints = await query<{ review_id: string }>(
                    `UPDATE review_complaints
                     SET status = 'draft', updated_at = NOW()
                     WHERE review_id = ANY($1) AND status = 'not_applicable'
                     RETURNING review_id`,
                    [resurrectedIds]
                );

                if ((restoredComplaints.rowCount ?? 0) > 0) {
                    const restoredReviewIds = restoredComplaints.rows.map(r => r.review_id);
                    await query(
                        `UPDATE reviews
                         SET complaint_status = 'draft',
                             has_complaint_draft = TRUE,
                             updated_at = NOW()
                         WHERE id = ANY($1)`,
                        [restoredReviewIds]
                    );
                    console.log(`[RESURRECTION] Restored ${restoredComplaints.rowCount} complaints from not_applicable back to draft`);
                }
            } catch (resError: any) {
                console.error(`[RESURRECTION] Error restoring complaints (non-fatal):`, resError.message);
            }
        }

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
                const store2 = await dbHelpers.getStoreById(storeId);
                const apiKey = process.env.NEXT_PUBLIC_API_KEY || store2?.api_token || '';

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

        // Re-throw the error so callers can handle it
        throw error;
    }
}
