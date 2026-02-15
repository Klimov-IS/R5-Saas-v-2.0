/**
 * Auto-Complaint Generation Service
 *
 * Handles automatic complaint generation with:
 * - Event-driven generation (instant, 99% coverage)
 * - Background processing (non-blocking)
 * - Business rules validation
 * - Rate limiting and error handling
 *
 * Triggers:
 * 1. New review synced from WB API
 * 2. Store activated (is_active: false → true)
 * 3. Product activated (is_active: false → true)
 * 4. Product rules enabled (submit_complaints: false → true)
 *
 * @module services/auto-complaint-generator
 */

import * as dbHelpers from '@/db/helpers';
import { COMPLAINT_CUTOFF_DATE } from '@/db/complaint-helpers';

// ============================================================================
// Types
// ============================================================================

export interface GenerationResult {
  total: number;
  generated: number;
  failed: number;
  skipped: number;
  duration_ms: number;
}

export interface Review {
  id: string;
  rating: number;
  store_id: string;
  product_id: string;
  date?: string;
  complaint_status?: string;
}

export interface ProductRule {
  submit_complaints: boolean;
  complaint_rating_1: boolean;
  complaint_rating_2: boolean;
  complaint_rating_3: boolean;
  complaint_rating_4: boolean;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Maximum reviews to process in event-driven mode
 * Larger batches are deferred to CRON to avoid API overload
 */
const MAX_EVENT_DRIVEN_BATCH = 100;

/**
 * Get API base URL from environment
 */
function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002';
}

// ============================================================================
// Main Generation Function
// ============================================================================

/**
 * Generate complaints for review IDs in background (non-blocking)
 *
 * This function is safe to call without await — it will run in background
 * and log results without blocking the caller.
 *
 * @param storeId - Store ID
 * @param reviewIds - Array of review IDs to generate complaints for
 * @param apiKey - API key for authentication
 * @returns Promise<GenerationResult> - Statistics about generation
 *
 * @example
 * // Fire and forget (non-blocking)
 * autoGenerateComplaintsInBackground(storeId, reviewIds, apiKey)
 *   .catch(err => console.error('Failed:', err));
 *
 * // Or await if you need results
 * const result = await autoGenerateComplaintsInBackground(storeId, reviewIds, apiKey);
 * console.log(`Generated ${result.generated} complaints`);
 */
export async function autoGenerateComplaintsInBackground(
  storeId: string,
  reviewIds: string[],
  apiKey: string
): Promise<GenerationResult> {
  const startTime = Date.now();

  console.log(`[AUTO-COMPLAINT] Starting background generation for ${reviewIds.length} reviews`);

  // Optimization: If too many reviews, defer to CRON to avoid API overload
  if (reviewIds.length > MAX_EVENT_DRIVEN_BATCH) {
    console.log(
      `[AUTO-COMPLAINT] ⚠️  Large batch (${reviewIds.length}) detected — deferring to CRON fallback`
    );
    console.log(
      `[AUTO-COMPLAINT] CRON will process these reviews within 1 hour (production) or 5 min (test)`
    );

    return {
      total: reviewIds.length,
      generated: 0,
      failed: 0,
      skipped: reviewIds.length,
      duration_ms: Date.now() - startTime,
    };
  }

  try {
    const baseUrl = getBaseUrl();
    const endpoint = `${baseUrl}/api/extension/stores/${storeId}/reviews/generate-complaints-batch`;

    console.log(`[AUTO-COMPLAINT] Calling batch generation API: ${endpoint}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ review_ids: reviewIds }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`HTTP ${response.status}: ${errorData.error || 'Unknown error'}`);
    }

    const result = await response.json();

    const stats: GenerationResult = {
      total: reviewIds.length,
      generated: result.generated?.length || 0,
      failed: result.failed?.length || 0,
      skipped: 0,
      duration_ms: Date.now() - startTime,
    };

    console.log(
      `[AUTO-COMPLAINT] ✅ Completed: ${stats.generated} generated, ${stats.failed} failed in ${stats.duration_ms}ms`
    );

    if (stats.failed > 0) {
      console.log(`[AUTO-COMPLAINT] ⚠️  ${stats.failed} failures will be retried by CRON fallback`);
    }

    return stats;
  } catch (error: any) {
    console.error(`[AUTO-COMPLAINT] ❌ Failed to generate complaints:`, error.message);
    console.log(`[AUTO-COMPLAINT] CRON fallback will pick up these reviews within 1 hour`);

    // Don't throw — CRON will pick up missed complaints later
    return {
      total: reviewIds.length,
      generated: 0,
      failed: reviewIds.length,
      skipped: 0,
      duration_ms: Date.now() - startTime,
    };
  }
}

// ============================================================================
// Business Rules Validation
// ============================================================================

/**
 * Check if review should have complaint generated
 *
 * Validates ALL business rules:
 * 1. Rating is 1-4 (not 5 stars)
 * 2. Store is active
 * 3. Product is active
 * 4. Product rules allow complaints (submit_complaints = true)
 * 5. Specific rating is enabled in product rules
 * 6. Complaint doesn't already exist (idempotency)
 *
 * @param review - Review to check
 * @returns Promise<boolean> - true if complaint should be generated
 *
 * @example
 * const review = await dbHelpers.getReviewById(reviewId);
 * if (await shouldGenerateComplaint(review)) {
 *   await autoGenerateComplaintsInBackground(storeId, [reviewId], apiKey);
 * }
 */
export async function shouldGenerateComplaint(review: Review): Promise<boolean> {
  // 1. Check rating is 1-4 (not 5 stars)
  if (review.rating < 1 || review.rating > 4) {
    return false;
  }

  // 1.0. Skip deleted reviews (can't submit complaints for removed reviews)
  if (review.review_status_wb === 'deleted') {
    console.log(`[AutoComplaint] Skip: review ${review.id} is deleted from WB`);
    return false;
  }

  // 1.1. Check review date is not older than cutoff (WB rule: Oct 1, 2023)
  if (review.date) {
    const reviewDate = new Date(review.date);
    const cutoffDate = new Date(COMPLAINT_CUTOFF_DATE);
    if (reviewDate < cutoffDate) {
      console.log(`[AutoComplaint] Skip: review ${review.id} is older than ${COMPLAINT_CUTOFF_DATE}`);
      return false;
    }
  }

  // 1.5. Check complaint_status - skip if already has any complaint status
  // Allowed: NULL or 'not_sent'
  // Blocked: 'draft', 'sent', 'pending', 'approved', 'rejected', 'reconsidered'
  if (review.complaint_status &&
      review.complaint_status !== 'not_sent') {
    console.log(`[AutoComplaint] Skip: review ${review.id} already has complaint_status=${review.complaint_status}`);
    return false;
  }

  // 2. Check store is active
  const store = await dbHelpers.getStoreById(review.store_id);
  if (!store?.is_active) {
    return false;
  }

  // 3. Check product is active
  const product = await dbHelpers.getProductById(review.product_id);
  if (!product?.is_active) {
    return false;
  }

  // 4. Check product_rules allow complaints
  const productRule = await dbHelpers.getProductRule(review.product_id);
  if (!productRule?.submit_complaints) {
    return false;
  }

  // 5. Check specific rating is enabled in rules
  const ratingKey = `complaint_rating_${review.rating}` as keyof ProductRule;
  if (!productRule[ratingKey]) {
    return false;
  }

  // 6. Check complaint doesn't already exist (idempotency)
  const existingComplaint = await dbHelpers.getComplaintByReviewId(review.id);
  if (existingComplaint) {
    return false;
  }

  return true;
}

/**
 * Check if review should have complaint generated with explicit rules
 *
 * Same as shouldGenerateComplaint, but uses provided product rules instead
 * of fetching from database. Used when product_rules just changed.
 *
 * @param review - Review to check
 * @param productRule - Product rules to validate against
 * @returns Promise<boolean> - true if complaint should be generated
 *
 * @example
 * // After updating product rules
 * const newRules = await dbHelpers.updateProductRule(productId, { submit_complaints: true });
 * const reviews = await dbHelpers.getReviewsForProduct(productId);
 * for (const review of reviews) {
 *   if (await shouldGenerateComplaintWithRules(review, newRules)) {
 *     eligibleReviewIds.push(review.id);
 *   }
 * }
 */
export async function shouldGenerateComplaintWithRules(
  review: Review,
  productRule: ProductRule | null
): Promise<boolean> {
  // 1. Check rating is 1-4
  if (review.rating < 1 || review.rating > 4) {
    return false;
  }

  // 1.1. Check review date is not older than cutoff (WB rule: Oct 1, 2023)
  if (review.date) {
    const reviewDate = new Date(review.date);
    const cutoffDate = new Date(COMPLAINT_CUTOFF_DATE);
    if (reviewDate < cutoffDate) {
      console.log(`[AutoComplaint] Skip: review ${review.id} is older than ${COMPLAINT_CUTOFF_DATE}`);
      return false;
    }
  }

  // 1.5. Check complaint_status - skip if already has any complaint status
  if (review.complaint_status &&
      review.complaint_status !== 'not_sent') {
    console.log(`[AutoComplaint] Skip: review ${review.id} already has complaint_status=${review.complaint_status}`);
    return false;
  }

  // 2. Check store is active
  const store = await dbHelpers.getStoreById(review.store_id);
  if (!store?.is_active) {
    return false;
  }

  // 3. Check product is active
  const product = await dbHelpers.getProductById(review.product_id);
  if (!product?.is_active) {
    return false;
  }

  // 4. Check product_rules allow complaints
  if (!productRule?.submit_complaints) {
    return false;
  }

  // 5. Check specific rating is enabled
  const ratingKey = `complaint_rating_${review.rating}` as keyof ProductRule;
  if (!productRule[ratingKey]) {
    return false;
  }

  // 6. Check complaint doesn't already exist
  const existingComplaint = await dbHelpers.getComplaintByReviewId(review.id);
  if (existingComplaint) {
    return false;
  }

  return true;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Filter reviews to find which are eligible for complaint generation
 *
 * @param reviewIds - Array of review IDs to check
 * @returns Promise<string[]> - Array of eligible review IDs
 *
 * @example
 * const newReviewIds = ['id1', 'id2', 'id3'];
 * const eligibleIds = await filterEligibleReviews(newReviewIds);
 * console.log(`${eligibleIds.length} / ${newReviewIds.length} reviews are eligible`);
 */
export async function filterEligibleReviews(reviewIds: string[]): Promise<string[]> {
  const eligible: string[] = [];

  for (const reviewId of reviewIds) {
    const review = await dbHelpers.getReviewById(reviewId);

    if (review && (await shouldGenerateComplaint(review))) {
      eligible.push(reviewId);
    }
  }

  return eligible;
}

/**
 * Check if product_rules changed in a way that enables new complaints
 *
 * @param oldRules - Previous product rules (or null if creating)
 * @param newRules - New product rules
 * @returns boolean - true if rules changed to enable more complaints
 *
 * @example
 * const oldRules = await dbHelpers.getProductRule(productId);
 * const newRules = { ...oldRules, complaint_rating_1: true };
 * if (productRulesChanged(oldRules, newRules)) {
 *   // Trigger backlog generation
 * }
 */
export function productRulesChanged(
  oldRules: ProductRule | null,
  newRules: ProductRule
): boolean {
  // If creating new rules, it's always a change
  if (!oldRules) return true;

  // Check if submit_complaints was enabled
  if (oldRules.submit_complaints !== newRules.submit_complaints) {
    return true;
  }

  // Check if any rating was enabled
  if (
    oldRules.complaint_rating_1 !== newRules.complaint_rating_1 ||
    oldRules.complaint_rating_2 !== newRules.complaint_rating_2 ||
    oldRules.complaint_rating_3 !== newRules.complaint_rating_3 ||
    oldRules.complaint_rating_4 !== newRules.complaint_rating_4
  ) {
    return true;
  }

  return false;
}

// ============================================================================
// Logging Utilities
// ============================================================================

/**
 * Log event-driven generation start
 */
export function logGenerationStart(trigger: string, count: number): void {
  console.log(`\n========================================`);
  console.log(`[AUTO-COMPLAINT] 🚀 ${trigger}`);
  console.log(`[AUTO-COMPLAINT] Found ${count} reviews for complaint generation`);
  console.log(`========================================\n`);
}

/**
 * Log event-driven generation result
 */
export function logGenerationResult(trigger: string, result: GenerationResult): void {
  console.log(`\n========================================`);
  console.log(`[AUTO-COMPLAINT] ✅ ${trigger} completed`);
  console.log(`[AUTO-COMPLAINT] Total: ${result.total}`);
  console.log(`[AUTO-COMPLAINT] Generated: ${result.generated}`);
  console.log(`[AUTO-COMPLAINT] Failed: ${result.failed}`);
  console.log(`[AUTO-COMPLAINT] Skipped: ${result.skipped}`);
  console.log(`[AUTO-COMPLAINT] Duration: ${result.duration_ms}ms`);
  console.log(`========================================\n`);
}
