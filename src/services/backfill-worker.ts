/**
 * Backfill Worker Service
 *
 * Processes complaint_backfill_jobs queue for mass complaint generation.
 * Designed to be called by CRON or triggered manually.
 *
 * Key features:
 * - Batch processing with configurable size
 * - Daily limit enforcement per store
 * - Automatic pause/resume on limit
 * - Error handling with retries
 * - Progress tracking
 *
 * @module services/backfill-worker
 */

import * as backfillDb from '@/db/backfill-helpers';
import type {
  BackfillJob,
  BackfillBatchResult,
  BACKFILL_BATCH_SIZE,
  BACKFILL_BATCH_DELAY,
} from '@/types/backfill';

// ============================================================================
// Configuration
// ============================================================================

const BATCH_SIZE = 100;
const BATCH_DELAY_MS = 2000;
const MAX_BATCHES_PER_RUN = 10;

/**
 * Get API base URL from environment
 */
function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002';
}

// ============================================================================
// Types
// ============================================================================

export interface WorkerRunResult {
  jobs_processed: number;
  total_generated: number;
  total_failed: number;
  total_skipped: number;
  jobs_completed: number;
  jobs_paused: number;
  duration_ms: number;
}

export interface BatchProcessResult {
  generated: number;
  failed: number;
  skipped: number;
  is_completed: boolean;
  is_paused: boolean;
  error?: string;
}

// ============================================================================
// Main Worker Function
// ============================================================================

/**
 * Run backfill worker to process pending jobs
 *
 * This is the main entry point, designed to be called by CRON.
 * Processes one batch per active job, respecting daily limits.
 *
 * @param maxJobs - Maximum number of jobs to process per run (default: 5)
 * @returns WorkerRunResult - Statistics about the run
 *
 * @example
 * // In CRON job (runs every 5 minutes)
 * const result = await runBackfillWorker();
 * console.log(`Processed ${result.jobs_processed} jobs, generated ${result.total_generated} complaints`);
 */
export async function runBackfillWorker(maxJobs: number = 5): Promise<WorkerRunResult> {
  const startTime = Date.now();
  console.log('\n[BACKFILL-WORKER] ========================================');
  console.log('[BACKFILL-WORKER] Starting backfill worker run');
  console.log('[BACKFILL-WORKER] ========================================\n');

  const result: WorkerRunResult = {
    jobs_processed: 0,
    total_generated: 0,
    total_failed: 0,
    total_skipped: 0,
    jobs_completed: 0,
    jobs_paused: 0,
    duration_ms: 0,
  };

  try {
    // First, resume any paused jobs from previous day
    const resumedCount = await backfillDb.resumePausedJobs();
    if (resumedCount > 0) {
      console.log(`[BACKFILL-WORKER] Resumed ${resumedCount} paused jobs for new day`);
    }

    // Get next jobs to process
    const jobs = await backfillDb.getNextJobsToProcess(maxJobs);
    console.log(`[BACKFILL-WORKER] Found ${jobs.length} jobs to process`);

    if (jobs.length === 0) {
      console.log('[BACKFILL-WORKER] No pending jobs, exiting');
      result.duration_ms = Date.now() - startTime;
      return result;
    }

    // Process each job
    for (const job of jobs) {
      console.log(`\n[BACKFILL-WORKER] Processing job ${job.id} for product ${job.product_id}`);

      try {
        // Check daily limit before processing
        const remaining = await backfillDb.getRemainingDailyLimit(job.store_id);
        console.log(`[BACKFILL-WORKER] Store ${job.store_id} has ${remaining} remaining today`);

        if (remaining <= 0) {
          console.log(`[BACKFILL-WORKER] Daily limit reached for store ${job.store_id}, pausing job`);
          await backfillDb.pauseJob(job.id);
          result.jobs_paused++;
          continue;
        }

        // Start job if not already in progress
        if (job.status === 'pending') {
          await backfillDb.startJob(job.id);
        }

        // Process batches until limit or completion
        const batchResult = await processJobBatch(job, Math.min(remaining, BATCH_SIZE));

        result.jobs_processed++;
        result.total_generated += batchResult.generated;
        result.total_failed += batchResult.failed;
        result.total_skipped += batchResult.skipped;

        if (batchResult.is_completed) {
          result.jobs_completed++;
          console.log(`[BACKFILL-WORKER] Job ${job.id} completed`);
        }

        if (batchResult.is_paused) {
          result.jobs_paused++;
          console.log(`[BACKFILL-WORKER] Job ${job.id} paused (daily limit)`);
        }

        // Small delay between jobs to avoid overloading
        if (jobs.indexOf(job) < jobs.length - 1) {
          await delay(BATCH_DELAY_MS);
        }
      } catch (error: any) {
        console.error(`[BACKFILL-WORKER] Error processing job ${job.id}:`, error.message);
        await backfillDb.failJob(job.id, error.message);
        result.total_failed++;
      }
    }

    result.duration_ms = Date.now() - startTime;

    console.log('\n[BACKFILL-WORKER] ========================================');
    console.log('[BACKFILL-WORKER] Run completed:');
    console.log(`[BACKFILL-WORKER]   Jobs processed: ${result.jobs_processed}`);
    console.log(`[BACKFILL-WORKER]   Generated: ${result.total_generated}`);
    console.log(`[BACKFILL-WORKER]   Failed: ${result.total_failed}`);
    console.log(`[BACKFILL-WORKER]   Skipped: ${result.total_skipped}`);
    console.log(`[BACKFILL-WORKER]   Jobs completed: ${result.jobs_completed}`);
    console.log(`[BACKFILL-WORKER]   Jobs paused: ${result.jobs_paused}`);
    console.log(`[BACKFILL-WORKER]   Duration: ${result.duration_ms}ms`);
    console.log('[BACKFILL-WORKER] ========================================\n');

    return result;
  } catch (error: any) {
    console.error('[BACKFILL-WORKER] Fatal error:', error.message);
    result.duration_ms = Date.now() - startTime;
    throw error;
  }
}

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * Process a single batch for a job
 *
 * @param job - BackfillJob to process
 * @param batchSize - Number of reviews to process
 * @returns BatchProcessResult
 */
async function processJobBatch(
  job: BackfillJob,
  batchSize: number
): Promise<BatchProcessResult> {
  console.log(`[BACKFILL-WORKER] Processing batch of ${batchSize} for job ${job.id}`);

  const result: BatchProcessResult = {
    generated: 0,
    failed: 0,
    skipped: 0,
    is_completed: false,
    is_paused: false,
  };

  try {
    // Get reviews to process
    const reviews = await backfillDb.getReviewsForBackfill(job.id, batchSize);
    console.log(`[BACKFILL-WORKER] Found ${reviews.length} reviews to process`);

    if (reviews.length === 0) {
      // No more reviews, mark as completed
      await backfillDb.completeJob(job.id);
      result.is_completed = true;
      return result;
    }

    // Generate complaints via batch API
    const reviewIds = reviews.map(r => r.review_id);
    const apiResult = await generateComplaintsBatch(job.store_id, reviewIds);

    result.generated = apiResult.generated;
    result.failed = apiResult.failed;
    result.skipped = reviewIds.length - apiResult.generated - apiResult.failed;

    // Update job progress
    await backfillDb.updateJobProgress(job.id, {
      generated: result.generated,
      failed: result.failed,
      skipped: result.skipped,
    });

    // Increment daily limit counter
    if (result.generated > 0) {
      const newTotal = await backfillDb.incrementDailyLimit(job.store_id, result.generated);
      console.log(`[BACKFILL-WORKER] Store ${job.store_id} daily total: ${newTotal}`);

      // Check if we hit the limit
      const remaining = await backfillDb.getRemainingDailyLimit(job.store_id);
      if (remaining <= 0) {
        await backfillDb.pauseJob(job.id);
        result.is_paused = true;
      }
    }

    // Check if job is complete
    const updatedJob = await backfillDb.getBackfillJobById(job.id);
    if (updatedJob) {
      const totalProcessed = updatedJob.processed + updatedJob.skipped;
      if (totalProcessed >= updatedJob.total_reviews) {
        await backfillDb.completeJob(job.id);
        result.is_completed = true;
      }
    }

    return result;
  } catch (error: any) {
    result.error = error.message;
    console.error(`[BACKFILL-WORKER] Batch error:`, error.message);
    return result;
  }
}

/**
 * Call batch generation API
 */
async function generateComplaintsBatch(
  storeId: string,
  reviewIds: string[]
): Promise<{ generated: number; failed: number }> {
  const baseUrl = getBaseUrl();
  const endpoint = `${baseUrl}/api/extension/stores/${storeId}/reviews/generate-complaints-batch`;

  console.log(`[BACKFILL-WORKER] Calling API: ${endpoint} with ${reviewIds.length} reviews`);

  // Get API key from environment for internal calls
  const apiKey = process.env.INTERNAL_API_KEY || process.env.CRON_API_KEY;
  if (!apiKey) {
    throw new Error('INTERNAL_API_KEY or CRON_API_KEY not configured');
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ review_ids: reviewIds }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`HTTP ${response.status}: ${errorData.error || 'Unknown error'}`);
    }

    const result = await response.json();

    return {
      generated: result.generated?.length || 0,
      failed: result.failed?.length || 0,
    };
  } catch (error: any) {
    console.error(`[BACKFILL-WORKER] API call failed:`, error.message);
    throw error;
  }
}

// ============================================================================
// Job Creation Triggers
// ============================================================================

/**
 * Create backfill job when product is activated
 *
 * Called by product activation handler.
 * Creates a job to generate complaints for all eligible reviews.
 *
 * @param productId - Product ID
 * @param storeId - Store ID
 * @param ownerId - Owner ID
 * @returns Created job or null if no eligible reviews
 */
export async function onProductActivated(
  productId: string,
  storeId: string,
  ownerId: string
): Promise<BackfillJob | null> {
  console.log(`[BACKFILL] Product activated: ${productId}`);

  try {
    const job = await backfillDb.createBackfillJob({
      product_id: productId,
      store_id: storeId,
      owner_id: ownerId,
      triggered_by: 'product_activation',
      priority: 0, // Normal priority
    });

    console.log(`[BACKFILL] Created job ${job.id} for ${job.total_reviews} reviews`);
    return job;
  } catch (error: any) {
    if (error.message === 'No eligible reviews found for backfill') {
      console.log(`[BACKFILL] No eligible reviews for product ${productId}`);
      return null;
    }
    throw error;
  }
}

/**
 * Create backfill jobs for all products when store is activated
 *
 * @param storeId - Store ID
 * @param ownerId - Owner ID
 * @param productIds - Array of product IDs in the store
 * @returns Number of jobs created
 */
export async function onStoreActivated(
  storeId: string,
  ownerId: string,
  productIds: string[]
): Promise<number> {
  console.log(`[BACKFILL] Store activated: ${storeId} with ${productIds.length} products`);

  let created = 0;
  for (const productId of productIds) {
    try {
      const job = await backfillDb.createBackfillJob({
        product_id: productId,
        store_id: storeId,
        owner_id: ownerId,
        triggered_by: 'store_activation',
        priority: 1, // Higher priority for store activation
      });
      created++;
      console.log(`[BACKFILL] Created job ${job.id} for product ${productId}`);
    } catch (error: any) {
      if (error.message !== 'No eligible reviews found for backfill') {
        console.error(`[BACKFILL] Error creating job for ${productId}:`, error.message);
      }
    }
  }

  console.log(`[BACKFILL] Created ${created} jobs for store ${storeId}`);
  return created;
}

/**
 * Create backfill job when product rules change
 *
 * @param productId - Product ID
 * @param storeId - Store ID
 * @param ownerId - Owner ID
 * @returns Created job or null
 */
export async function onRulesChanged(
  productId: string,
  storeId: string,
  ownerId: string
): Promise<BackfillJob | null> {
  console.log(`[BACKFILL] Rules changed for product: ${productId}`);

  try {
    const job = await backfillDb.createBackfillJob({
      product_id: productId,
      store_id: storeId,
      owner_id: ownerId,
      triggered_by: 'rules_change',
      priority: 0,
    });

    console.log(`[BACKFILL] Created job ${job.id} for ${job.total_reviews} reviews`);
    return job;
  } catch (error: any) {
    if (error.message === 'No eligible reviews found for backfill') {
      console.log(`[BACKFILL] No eligible reviews for product ${productId}`);
      return null;
    }
    throw error;
  }
}

/**
 * Create manual backfill job (admin action)
 *
 * @param productId - Product ID
 * @param storeId - Store ID
 * @param ownerId - Owner ID
 * @param priority - Priority (higher = more urgent)
 * @returns Created job
 */
export async function createManualBackfillJob(
  productId: string,
  storeId: string,
  ownerId: string,
  priority: number = 10
): Promise<BackfillJob> {
  console.log(`[BACKFILL] Manual job requested for product: ${productId}`);

  const job = await backfillDb.createBackfillJob({
    product_id: productId,
    store_id: storeId,
    owner_id: ownerId,
    triggered_by: 'manual',
    priority,
    metadata: { requested_at: new Date().toISOString() },
  });

  console.log(`[BACKFILL] Created manual job ${job.id} for ${job.total_reviews} reviews`);
  return job;
}

// ============================================================================
// Utilities
// ============================================================================

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get backfill status for monitoring
 */
export async function getBackfillStatus(): Promise<{
  stats: Awaited<ReturnType<typeof backfillDb.getBackfillStats>>;
  activeJobs: Awaited<ReturnType<typeof backfillDb.getActiveJobsStatusView>>;
}> {
  const [stats, activeJobs] = await Promise.all([
    backfillDb.getBackfillStats(),
    backfillDb.getActiveJobsStatusView(),
  ]);

  return { stats, activeJobs };
}

/**
 * Cancel a backfill job
 */
export async function cancelBackfillJob(jobId: string): Promise<BackfillJob | null> {
  return backfillDb.cancelJob(jobId);
}
