/**
 * OZON Review Sync
 *
 * Fetches reviews from OZON Seller API and upserts into the shared `reviews` table.
 * Uses cursor-based pagination. Requires Premium Plus subscription.
 *
 * Key differences from WB:
 * - No complaints workflow (only comments/replies)
 * - Cursor pagination (not date-based)
 * - No buyer name (author = 'Покупатель OZON')
 * - SKU-based product linking (not nmID)
 * - 1000-char comment limit
 */

import { createOzonClient } from '@/lib/ozon-api';
import * as dbHelpers from '@/db/helpers';
import { query } from '@/db/client';

/**
 * Sync OZON reviews for a store.
 * Returns summary string for logging.
 */
export async function refreshOzonReviews(storeId: string): Promise<string> {
  console.log(`[OZON-REVIEWS] Starting review sync for store ${storeId}`);

  // Mark sync as pending
  await dbHelpers.updateStore(storeId, {
    last_review_update_status: 'pending',
    last_review_update_date: new Date().toISOString(),
  });

  try {
    const store = await dbHelpers.getStoreById(storeId);
    if (!store) throw new Error(`Store ${storeId} not found`);
    if (!store.ozon_client_id || !store.ozon_api_key) {
      throw new Error('OZON credentials not configured');
    }

    const client = createOzonClient(store.ozon_client_id, store.ozon_api_key);

    // Build product map: ozon_sku → product for linking
    const products = await dbHelpers.getProducts(storeId);
    const skuToProduct = new Map<string, typeof products[0]>();
    for (const p of products) {
      if (p.ozon_sku) skuToProduct.set(p.ozon_sku, p);
      if (p.ozon_fbs_sku) skuToProduct.set(p.ozon_fbs_sku, p);
    }
    console.log(`[OZON-REVIEWS] Product SKU map: ${skuToProduct.size} entries`);

    // Pre-fetch existing OZON review IDs for incremental sync
    const existingIds = await query<{ id: string }>(
      'SELECT id FROM reviews WHERE store_id = $1 AND marketplace = $2',
      [storeId, 'ozon']
    );
    const knownReviewIds = new Set(existingIds.rows.map(r => r.id));
    console.log(`[OZON-REVIEWS] Existing OZON reviews: ${knownReviewIds.size}`);

    // Fetch reviews (cursor pagination, DESC = newest first)
    let lastId = '';
    let hasMore = true;
    let totalFetched = 0;
    let upsertedCount = 0;
    let skippedNoProduct = 0;
    let stoppedEarly = false;

    while (hasMore) {
      const page = await client.getReviewList(lastId, 100, 'ALL', 'DESC');
      let knownInPage = 0;

      for (const review of page.reviews) {
        totalFetched++;
        const reviewDbId = `ozon_${review.id}`;
        if (knownReviewIds.has(reviewDbId)) knownInPage++;

        // Find product by SKU
        const sku = String(review.sku);
        const product = skuToProduct.get(sku);

        if (!product) {
          skippedNoProduct++;
          if (skippedNoProduct <= 5) {
            console.warn(`[OZON-REVIEWS] No product for SKU ${sku}, skipping review ${review.id}`);
          }
          continue;
        }

        // Upsert review into shared reviews table
        await dbHelpers.upsertReview({
          id: reviewDbId,
          product_id: product.id,
          store_id: storeId,
          marketplace: 'ozon',
          rating: review.rating,
          text: review.text || '',
          pros: null,
          cons: null,
          author: 'Покупатель OZON',
          date: review.published_at,
          owner_id: store.owner_id,
          answer: null,
          photo_links: null,
          video: null,
          supplier_feedback_valuation: null,
          supplier_product_valuation: null,
          complaint_text: null,
          complaint_sent_date: null,
          draft_reply: null,
          ozon_review_status: review.status,
          ozon_order_status: review.order_status,
          is_rating_participant: review.is_rating_participant,
          ozon_sku: sku,
          ozon_comment_id: null,
          ozon_comments_amount: review.comments_amount,
          likes_amount: null,
          dislikes_amount: null,
        });
        upsertedCount++;
      }

      // Incremental sync: if entire page was already known → stop
      if (knownInPage === page.reviews.length && page.reviews.length > 0) {
        console.log(`[OZON-REVIEWS] Full page of ${page.reviews.length} known reviews — incremental sync complete`);
        stoppedEarly = true;
        break;
      }

      hasMore = page.hasNext && page.reviews.length > 0;
      if (hasMore) {
        lastId = page.lastId;
      }
    }

    // Update store stats
    const stats = await dbHelpers.getStoreStats(storeId);
    await dbHelpers.updateStore(storeId, {
      last_review_update_status: 'success',
      last_review_update_date: new Date().toISOString(),
      total_reviews: stats.totalReviews,
    });

    const message = `OZON reviews synced: ${upsertedCount} upserted, ${skippedNoProduct} skipped (no product), ${totalFetched} fetched${stoppedEarly ? ' (incremental)' : ' (full)'}`;
    console.log(`[OZON-REVIEWS] ${message}`);
    return message;
  } catch (error: any) {
    const errorMsg = error.message || String(error);
    console.error(`[OZON-REVIEWS] Error: ${errorMsg}`);

    // Still try to update stats on error
    try {
      const stats = await dbHelpers.getStoreStats(storeId);
      await dbHelpers.updateStore(storeId, {
        last_review_update_status: 'error',
        last_review_update_error: errorMsg.slice(0, 500),
        total_reviews: stats.totalReviews,
      });
    } catch { /* ignore */ }

    throw error;
  }
}
