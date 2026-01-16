/**
 * Extension Integration Helpers
 *
 * Database helpers specifically for Chrome Extension API endpoints.
 * Handles review syncing, complaint generation, and statistics for extension.
 *
 * @version 1.0.0
 * @date 2026-01-10
 */

import { query } from './client';
import { generateReviewComplaint } from '@/ai/flows/generate-review-complaint-flow';

// ============================================================================
// Types for Extension API
// ============================================================================

/**
 * Review data sent from Chrome Extension
 * ⚠️ ВАЖНО: Статусы УЖЕ на английском (расширение конвертирует!)
 */
export interface ExtensionReview {
  review_id: string;
  wb_article: string;
  seller_article: string | null;
  rating: number;
  review_date: string; // ISO 8601
  purchase_date?: string | null;
  customer_name?: string | null;
  review_text: string;
  photos_count?: number;

  // ⚠️ Статусы приходят на английском из расширения!
  review_status_wb: 'visible' | 'unpublished' | 'excluded' | 'unknown';
  product_status_by_review: 'purchased' | 'refused' | 'not_specified' | 'unknown';
  chat_status_by_review: 'available' | 'unavailable' | 'unknown';
  complaint_status: 'not_sent' | 'draft' | 'sent' | 'approved' | 'rejected' | 'pending';

  parsed_at: string;
  page_number?: number | null;
}

export interface SyncMetadata {
  total_parsed: number;
  pages_scanned: number;
  sync_mode: 'full' | 'incremental';
  sync_started_at: string;
  sync_completed_at: string;
}

export interface UpsertResult {
  created: number;
  updated: number;
  errors: number;
  error_details: Array<{ review_id: string; error: string }>;
}

// ============================================================================
// Main Functions for Extension API
// ============================================================================

/**
 * Upsert reviews from extension sync
 *
 * Inserts new reviews or updates existing ones.
 * Also creates/updates associated products automatically.
 *
 * @param storeId Store ID
 * @param reviewsList Array of reviews from extension
 * @returns UpsertResult with counts
 */
export async function upsertReviewsFromExtension(
  storeId: string,
  reviewsList: ExtensionReview[]
): Promise<UpsertResult> {
  const result: UpsertResult = {
    created: 0,
    updated: 0,
    errors: 0,
    error_details: [],
  };

  // Get store info
  const storeResult = await query(
    'SELECT id, owner_id FROM stores WHERE id = $1',
    [storeId]
  );

  if (!storeResult.rows[0]) {
    throw new Error(`Store ${storeId} not found`);
  }

  const ownerId = storeResult.rows[0].owner_id;

  // Process each review
  for (const rev of reviewsList) {
    try {
      // 1. Get or create product
      const productId = await getOrCreateProduct(
        storeId,
        ownerId,
        rev.seller_article,
        rev.wb_article
      );

      // 2. Check if review exists
      const existingReview = await query(
        'SELECT id FROM reviews WHERE id = $1',
        [rev.review_id]
      );

      const isNewReview = !existingReview.rows[0];

      // 3. Upsert review
      await query(
        `INSERT INTO reviews (
          id, product_id, store_id, owner_id, rating, text, author, date,
          review_status_wb, product_status_by_review, chat_status_by_review, complaint_status,
          purchase_date, parsed_at, page_number,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
          rating = EXCLUDED.rating,
          text = EXCLUDED.text,
          author = EXCLUDED.author,
          date = EXCLUDED.date,
          review_status_wb = EXCLUDED.review_status_wb,
          product_status_by_review = EXCLUDED.product_status_by_review,
          chat_status_by_review = EXCLUDED.chat_status_by_review,
          complaint_status = EXCLUDED.complaint_status,
          purchase_date = EXCLUDED.purchase_date,
          parsed_at = EXCLUDED.parsed_at,
          page_number = EXCLUDED.page_number,
          updated_at = NOW()`,
        [
          rev.review_id,
          productId,
          storeId,
          ownerId,
          rev.rating,
          rev.review_text || '',
          rev.customer_name || 'Аноним',
          rev.review_date,
          rev.review_status_wb,
          rev.product_status_by_review,
          rev.chat_status_by_review,
          rev.complaint_status,
          rev.purchase_date || null,
          rev.parsed_at || null,
          rev.page_number || null,
        ]
      );

      if (isNewReview) {
        result.created++;
      } else {
        result.updated++;
      }

    } catch (error: any) {
      console.error(`[Extension Helpers] Error upserting review ${rev.review_id}:`, error.message);
      result.errors++;
      result.error_details.push({
        review_id: rev.review_id,
        error: error.message,
      });
    }
  }

  // Update store total_reviews count
  const countResult = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM reviews WHERE store_id = $1',
    [storeId]
  );

  await query(
    'UPDATE stores SET total_reviews = $1, updated_at = NOW() WHERE id = $2',
    [parseInt(countResult.rows[0].count, 10), storeId]
  );

  return result;
}

/**
 * Auto-generate complaints for negative reviews
 *
 * Finds reviews with rating <= 3 and complaint_status = 'not_sent',
 * generates AI complaints, and saves to review_complaints table.
 *
 * @param storeId Store ID
 * @param maxGenerate Maximum number to generate (default: 50)
 * @returns Number of complaints generated
 */
export async function autoGenerateComplaintsForReviews(
  storeId: string,
  maxGenerate: number = 50
): Promise<number> {
  // Find reviews that need complaints
  const reviewsResult = await query(
    `SELECT r.id, r.text, r.rating, r.product_id, p.name as product_name
     FROM reviews r
     JOIN products p ON r.product_id = p.id
     WHERE r.store_id = $1
       AND r.rating <= 3
       AND r.complaint_status = 'not_sent'
       AND NOT EXISTS (
         SELECT 1 FROM review_complaints rc WHERE rc.review_id = r.id
       )
     ORDER BY r.date DESC
     LIMIT $2`,
    [storeId, maxGenerate]
  );

  const reviews = reviewsResult.rows;
  let generated = 0;

  // Get store and owner info for logging
  const storeInfo = await query<{ owner_id: string }>(
    'SELECT owner_id FROM stores WHERE id = $1',
    [storeId]
  );

  const ownerId = storeInfo.rows[0]?.owner_id || 'system';

  for (const review of reviews) {
    try {
      // Generate complaint using AI
      const complaintResult = await generateReviewComplaint({
        productName: review.product_name || 'Товар',
        productVendorCode: review.product_id || '',
        reviewAuthor: 'Покупатель',
        reviewText: review.text || '',
        reviewRating: review.rating,
        reviewDate: new Date().toISOString(),
        storeId,
        ownerId,
        reviewId: review.id,
      });

      // Insert into review_complaints table
      await query(
        `INSERT INTO review_complaints (
          id, review_id, reason_id, reason_name, complaint_text, status, created_at, updated_at
        ) VALUES (gen_random_uuid(), $1, $2, $3, $4, 'draft', NOW(), NOW())`,
        [
          review.id,
          complaintResult.reasonId || 11,
          complaintResult.reasonName || 'Отзыв не относится к товару',
          complaintResult.complaintText,
        ]
      );

      // Update review complaint_status
      await query(
        `UPDATE reviews SET complaint_status = 'draft', updated_at = NOW() WHERE id = $1`,
        [review.id]
      );

      generated++;

    } catch (error: any) {
      console.error(`[Extension Helpers] Error generating complaint for review ${review.id}:`, error.message);
    }
  }

  return generated;
}

/**
 * Get store statistics for extension dashboard
 *
 * Returns aggregated stats:
 * - Total reviews, by rating, avg rating
 * - Complaint stats by status
 * - Last sync info
 *
 * @param storeId Store ID
 * @returns Statistics object
 */
export async function getStoreReviewsStats(storeId: string) {
  // Reviews stats
  const reviewsStatsResult = await query<{
    total: string;
    rating_1: string;
    rating_2: string;
    rating_3: string;
    rating_4: string;
    rating_5: string;
    avg_rating: string;
  }>(
    `SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE rating = 1) as rating_1,
      COUNT(*) FILTER (WHERE rating = 2) as rating_2,
      COUNT(*) FILTER (WHERE rating = 3) as rating_3,
      COUNT(*) FILTER (WHERE rating = 4) as rating_4,
      COUNT(*) FILTER (WHERE rating = 5) as rating_5,
      COALESCE(AVG(rating), 0) as avg_rating
    FROM reviews
    WHERE store_id = $1`,
    [storeId]
  );

  const reviewsStats = reviewsStatsResult.rows[0];

  // Complaints stats
  const complaintsStatsResult = await query<{
    total: string;
    not_sent: string;
    draft: string;
    sent: string;
    approved: string;
    rejected: string;
    pending: string;
  }>(
    `SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'not_sent') as not_sent,
      COUNT(*) FILTER (WHERE status = 'draft') as draft,
      COUNT(*) FILTER (WHERE status = 'sent') as sent,
      COUNT(*) FILTER (WHERE status = 'approved') as approved,
      COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
      COUNT(*) FILTER (WHERE status = 'pending') as pending
    FROM review_complaints rc
    JOIN reviews r ON rc.review_id = r.id
    WHERE r.store_id = $1`,
    [storeId]
  );

  const complaintsStats = complaintsStatsResult.rows[0] || {
    total: '0',
    not_sent: '0',
    draft: '0',
    sent: '0',
    approved: '0',
    rejected: '0',
    pending: '0',
  };

  // Calculate approval rate
  const totalSent = parseInt(complaintsStats.sent, 10) +
                    parseInt(complaintsStats.approved, 10) +
                    parseInt(complaintsStats.rejected, 10);
  const approved = parseInt(complaintsStats.approved, 10);
  const approvalRate = totalSent > 0 ? approved / totalSent : 0;

  // Last sync info
  const storeResult = await query<{
    last_reviews_sync_at: string | null;
  }>(
    'SELECT last_reviews_sync_at FROM stores WHERE id = $1',
    [storeId]
  );

  return {
    reviews: {
      total: parseInt(reviewsStats.total, 10),
      by_rating: {
        '1': parseInt(reviewsStats.rating_1, 10),
        '2': parseInt(reviewsStats.rating_2, 10),
        '3': parseInt(reviewsStats.rating_3, 10),
        '4': parseInt(reviewsStats.rating_4, 10),
        '5': parseInt(reviewsStats.rating_5, 10),
      },
      negative: parseInt(reviewsStats.rating_1, 10) +
                parseInt(reviewsStats.rating_2, 10) +
                parseInt(reviewsStats.rating_3, 10),
      avg_rating: parseFloat(reviewsStats.avg_rating),
    },
    complaints: {
      total: parseInt(complaintsStats.total, 10),
      not_sent: parseInt(complaintsStats.not_sent, 10),
      draft: parseInt(complaintsStats.draft, 10),
      sent: parseInt(complaintsStats.sent, 10),
      approved: parseInt(complaintsStats.approved, 10),
      rejected: parseInt(complaintsStats.rejected, 10),
      pending: parseInt(complaintsStats.pending, 10),
      approval_rate: approvalRate,
    },
    sync: {
      last_sync_at: storeResult.rows[0]?.last_reviews_sync_at || null,
      last_sync_mode: 'incremental', // Default assumption
    },
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get or create product by article
 *
 * @param storeId Store ID
 * @param ownerId Owner ID
 * @param sellerArticle Seller article (vendor code)
 * @param wbArticle WB article (nmId)
 * @returns Product ID
 */
async function getOrCreateProduct(
  storeId: string,
  ownerId: string,
  sellerArticle: string | null,
  wbArticle: string
): Promise<string> {
  // Try to find existing product by WB article
  const existingProduct = await query(
    'SELECT id FROM products WHERE wb_product_id = $1 AND store_id = $2',
    [wbArticle, storeId]
  );

  if (existingProduct.rows[0]) {
    return existingProduct.rows[0].id;
  }

  // Create new product
  const productId = `product_${wbArticle}_${Date.now()}`;

  await query(
    `INSERT INTO products (
      id, name, wb_product_id, vendor_code, store_id, owner_id,
      review_count, is_active, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, 0, true, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING`,
    [
      productId,
      `Товар ${wbArticle}`, // Temporary name
      wbArticle,
      sellerArticle || wbArticle,
      storeId,
      ownerId,
    ]
  );

  return productId;
}

/**
 * Get user by API token
 *
 * @param token API token (starts with "wbrm_")
 * @returns User info or null
 */
export async function getUserByApiToken(token: string) {
  const result = await query<{
    id: string;
    email: string;
  }>(
    `SELECT u.id, u.email
     FROM users u
     JOIN user_settings us ON u.id = us.id
     WHERE us.api_key = $1`,
    [token]
  );

  return result.rows[0] || null;
}

/**
 * Get user's stores by user ID
 *
 * @param userId User ID
 * @returns Array of store objects with id, name, and stats
 */
export async function getUserStores(userId: string): Promise<Array<{
  id: string;
  name: string;
  total_reviews: number;
}>> {
  const result = await query<{
    id: string;
    name: string;
    total_reviews: number;
  }>(
    'SELECT id, name, total_reviews FROM stores WHERE owner_id = $1 ORDER BY name ASC',
    [userId]
  );

  return result.rows;
}
