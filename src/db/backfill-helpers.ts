/**
 * Database helpers for complaint_backfill_jobs table
 *
 * CRUD operations for Auto Backfill system
 * Manages job queue for mass complaint generation when products are activated
 *
 * @module db/backfill-helpers
 */

import { query, transaction } from './client';
import type {
  BackfillJob,
  BackfillJobStatus,
  CreateBackfillJobInput,
  BackfillBatchResult,
  BackfillStats,
  DailyLimit,
  DAILY_COMPLAINT_LIMIT,
} from '../types/backfill';

// ============================================================================
// Constants
// ============================================================================

export const DEFAULT_DAILY_LIMIT = 2000;
export const DEFAULT_MAX_RETRIES = 3;

// ============================================================================
// Job CRUD Operations
// ============================================================================

/**
 * Create a new backfill job for a product
 * Uses UPSERT to handle duplicate requests for same product
 */
export async function createBackfillJob(input: CreateBackfillJobInput): Promise<BackfillJob> {
  // First, count eligible reviews for this product
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count
     FROM reviews r
     JOIN stores s ON r.store_id = s.id
     WHERE r.product_id = $1
       AND r.rating IN (1, 2, 3)
       AND r.date >= '2023-10-01'
       AND r.is_product_active = TRUE
       AND s.status = 'active'
       AND NOT EXISTS (
         SELECT 1 FROM review_complaints c WHERE c.review_id = r.id
       )
       AND (r.complaint_status IS NULL OR r.complaint_status = 'not_sent')`,
    [input.product_id]
  );

  const totalReviews = parseInt(countResult.rows[0].count, 10);

  // If no eligible reviews, don't create a job
  if (totalReviews === 0) {
    throw new Error('No eligible reviews found for backfill');
  }

  // Create job with UPSERT (ignore if active job exists)
  const result = await query<BackfillJob>(
    `INSERT INTO complaint_backfill_jobs (
      product_id, store_id, owner_id,
      status, priority, total_reviews,
      triggered_by, metadata, max_retries
    ) VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, $8)
    ON CONFLICT (product_id) WHERE status IN ('pending', 'in_progress', 'paused')
    DO UPDATE SET
      priority = GREATEST(complaint_backfill_jobs.priority, EXCLUDED.priority),
      total_reviews = EXCLUDED.total_reviews
    RETURNING *`,
    [
      input.product_id,
      input.store_id,
      input.owner_id,
      input.priority ?? 0,
      totalReviews,
      input.triggered_by,
      JSON.stringify(input.metadata ?? {}),
      DEFAULT_MAX_RETRIES,
    ]
  );

  return result.rows[0];
}

/**
 * Get backfill job by ID
 */
export async function getBackfillJobById(jobId: string): Promise<BackfillJob | null> {
  const result = await query<BackfillJob>(
    'SELECT * FROM complaint_backfill_jobs WHERE id = $1',
    [jobId]
  );
  return result.rows[0] || null;
}

/**
 * Get active backfill job for a product
 */
export async function getActiveJobByProduct(productId: string): Promise<BackfillJob | null> {
  const result = await query<BackfillJob>(
    `SELECT * FROM complaint_backfill_jobs
     WHERE product_id = $1
       AND status IN ('pending', 'in_progress', 'paused')
     LIMIT 1`,
    [productId]
  );
  return result.rows[0] || null;
}

/**
 * Get next jobs to process (ordered by priority and creation date)
 */
export async function getNextJobsToProcess(limit: number = 10): Promise<BackfillJob[]> {
  const result = await query<BackfillJob>(
    `SELECT * FROM complaint_backfill_jobs
     WHERE status IN ('pending', 'in_progress')
     ORDER BY priority DESC, created_at ASC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

/**
 * Get all jobs for a store
 */
export async function getJobsByStore(
  storeId: string,
  options?: { status?: BackfillJobStatus; limit?: number }
): Promise<BackfillJob[]> {
  let sql = 'SELECT * FROM complaint_backfill_jobs WHERE store_id = $1';
  const params: any[] = [storeId];
  let paramIndex = 2;

  if (options?.status) {
    sql += ` AND status = $${paramIndex}`;
    params.push(options.status);
    paramIndex++;
  }

  sql += ' ORDER BY created_at DESC';

  if (options?.limit) {
    sql += ` LIMIT $${paramIndex}`;
    params.push(options.limit);
  }

  const result = await query<BackfillJob>(sql, params);
  return result.rows;
}

// ============================================================================
// Job Status Updates
// ============================================================================

/**
 * Start processing a job
 */
export async function startJob(jobId: string): Promise<BackfillJob | null> {
  const result = await query<BackfillJob>(
    `UPDATE complaint_backfill_jobs
     SET status = 'in_progress',
         started_at = COALESCE(started_at, NOW()),
         last_processed_at = NOW()
     WHERE id = $1
       AND status IN ('pending', 'paused')
     RETURNING *`,
    [jobId]
  );
  return result.rows[0] || null;
}

/**
 * Update job progress after processing a batch
 */
export async function updateJobProgress(
  jobId: string,
  batchResult: {
    generated: number;
    failed: number;
    skipped: number;
  }
): Promise<BackfillJob | null> {
  const result = await query<BackfillJob>(
    `UPDATE complaint_backfill_jobs
     SET processed = processed + $2,
         failed = failed + $3,
         skipped = skipped + $4,
         daily_generated = daily_generated + $2,
         last_processed_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [jobId, batchResult.generated, batchResult.failed, batchResult.skipped]
  );

  const job = result.rows[0];
  if (!job) return null;

  // Check if job is completed
  const remaining = job.total_reviews - job.processed - job.skipped;
  if (remaining <= 0) {
    await completeJob(jobId);
    return getBackfillJobById(jobId);
  }

  return job;
}

/**
 * Mark job as completed
 */
export async function completeJob(jobId: string): Promise<BackfillJob | null> {
  const result = await query<BackfillJob>(
    `UPDATE complaint_backfill_jobs
     SET status = 'completed',
         completed_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [jobId]
  );
  return result.rows[0] || null;
}

/**
 * Pause job (hit daily limit)
 */
export async function pauseJob(jobId: string): Promise<BackfillJob | null> {
  const result = await query<BackfillJob>(
    `UPDATE complaint_backfill_jobs
     SET status = 'paused',
         daily_limit_date = CURRENT_DATE
     WHERE id = $1
     RETURNING *`,
    [jobId]
  );
  return result.rows[0] || null;
}

/**
 * Resume paused jobs for a new day
 * Called by CRON at midnight
 */
export async function resumePausedJobs(): Promise<number> {
  const result = await query(
    `UPDATE complaint_backfill_jobs
     SET status = 'pending',
         daily_generated = 0,
         daily_limit_date = NULL
     WHERE status = 'paused'
       AND daily_limit_date < CURRENT_DATE
     RETURNING id`
  );
  return result.rowCount ?? 0;
}

/**
 * Mark job as failed
 */
export async function failJob(jobId: string, error: string): Promise<BackfillJob | null> {
  const result = await query<BackfillJob>(
    `UPDATE complaint_backfill_jobs
     SET last_error = $2,
         retry_count = retry_count + 1,
         status = CASE
           WHEN retry_count >= max_retries - 1 THEN 'failed'
           ELSE status
         END
     WHERE id = $1
     RETURNING *`,
    [jobId, error]
  );
  return result.rows[0] || null;
}

/**
 * Cancel a job
 */
export async function cancelJob(jobId: string): Promise<BackfillJob | null> {
  const result = await query<BackfillJob>(
    `UPDATE complaint_backfill_jobs
     SET status = 'failed',
         last_error = 'Cancelled by user',
         completed_at = NOW()
     WHERE id = $1
       AND status IN ('pending', 'in_progress', 'paused')
     RETURNING *`,
    [jobId]
  );
  return result.rows[0] || null;
}

// ============================================================================
// Daily Limit Management
// ============================================================================

/**
 * Get remaining daily limit for a store
 */
export async function getRemainingDailyLimit(storeId: string): Promise<number> {
  const result = await query<{ remaining: string }>(
    `SELECT get_remaining_daily_limit($1) as remaining`,
    [storeId]
  );
  return parseInt(result.rows[0].remaining, 10);
}

/**
 * Increment daily limit counter
 * Returns new total generated today
 */
export async function incrementDailyLimit(storeId: string, count: number): Promise<number> {
  const result = await query<{ result: string }>(
    `SELECT increment_daily_limit($1, $2) as result`,
    [storeId, count]
  );
  return parseInt(result.rows[0].result, 10);
}

/**
 * Get daily limit record for a store
 */
export async function getDailyLimitRecord(
  storeId: string,
  date: string = new Date().toISOString().split('T')[0]
): Promise<DailyLimit | null> {
  const result = await query<DailyLimit>(
    `SELECT * FROM complaint_daily_limits
     WHERE store_id = $1 AND date = $2`,
    [storeId, date]
  );
  return result.rows[0] || null;
}

/**
 * Check if store has reached daily limit
 */
export async function hasReachedDailyLimit(storeId: string): Promise<boolean> {
  const remaining = await getRemainingDailyLimit(storeId);
  return remaining <= 0;
}

// ============================================================================
// Batch Fetching for Worker
// ============================================================================

/**
 * Get reviews to process for a backfill job
 * Returns reviews that don't have complaints yet
 */
export async function getReviewsForBackfill(
  jobId: string,
  batchSize: number = 100
): Promise<Array<{
  review_id: string;
  store_id: string;
  owner_id: string;
  product_id: string;
  rating: number;
  text: string;
  pros: string | null;
  cons: string | null;
  date: string;
  product_name: string | null;
  product_vendor_code: string | null;
}>> {
  // Get job info first
  const job = await getBackfillJobById(jobId);
  if (!job) {
    throw new Error('Job not found');
  }

  // Get reviews for this product that need complaints
  const result = await query<any>(
    `SELECT
      r.id as review_id,
      r.store_id,
      r.owner_id,
      r.product_id,
      r.rating,
      r.text,
      r.pros,
      r.cons,
      r.date,
      p.name as product_name,
      p.vendor_code as product_vendor_code
    FROM reviews r
    JOIN products p ON r.product_id = p.id
    JOIN stores s ON r.store_id = s.id
    WHERE r.product_id = $1
      AND r.rating IN (1, 2, 3)
      AND r.date >= '2023-10-01'
      AND r.is_product_active = TRUE
      AND s.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM review_complaints c WHERE c.review_id = r.id
      )
      AND (r.complaint_status IS NULL OR r.complaint_status = 'not_sent')
    ORDER BY r.date DESC
    LIMIT $2`,
    [job.product_id, batchSize]
  );

  return result.rows;
}

// ============================================================================
// Statistics & Monitoring
// ============================================================================

/**
 * Get overall backfill statistics
 */
export async function getBackfillStats(): Promise<BackfillStats> {
  const result = await query<{
    total_jobs: string;
    pending: string;
    in_progress: string;
    completed: string;
    paused: string;
    failed: string;
    total_reviews_queued: string;
    total_processed: string;
    total_failed: string;
    stores_with_active_jobs: string;
  }>(
    `SELECT
      COUNT(*) as total_jobs,
      COUNT(*) FILTER (WHERE status = 'pending') as pending,
      COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
      COUNT(*) FILTER (WHERE status = 'completed') as completed,
      COUNT(*) FILTER (WHERE status = 'paused') as paused,
      COUNT(*) FILTER (WHERE status = 'failed') as failed,
      COALESCE(SUM(total_reviews), 0) as total_reviews_queued,
      COALESCE(SUM(processed), 0) as total_processed,
      COALESCE(SUM(failed), 0) as total_failed,
      COUNT(DISTINCT store_id) FILTER (WHERE status IN ('pending', 'in_progress', 'paused')) as stores_with_active_jobs
    FROM complaint_backfill_jobs`
  );

  const row = result.rows[0];
  return {
    total_jobs: parseInt(row.total_jobs, 10),
    pending: parseInt(row.pending, 10),
    in_progress: parseInt(row.in_progress, 10),
    completed: parseInt(row.completed, 10),
    paused: parseInt(row.paused, 10),
    failed: parseInt(row.failed, 10),
    total_reviews_queued: parseInt(row.total_reviews_queued, 10),
    total_processed: parseInt(row.total_processed, 10),
    total_failed: parseInt(row.total_failed, 10),
    stores_with_active_jobs: parseInt(row.stores_with_active_jobs, 10),
  };
}

/**
 * Get job status with calculated fields (from view)
 */
export async function getJobStatusView(jobId: string): Promise<any | null> {
  const result = await query<any>(
    `SELECT * FROM v_backfill_status WHERE id = $1`,
    [jobId]
  );
  return result.rows[0] || null;
}

/**
 * Get all active jobs from status view
 */
export async function getActiveJobsStatusView(storeId?: string): Promise<any[]> {
  let sql = `SELECT * FROM v_backfill_status WHERE status IN ('pending', 'in_progress', 'paused')`;
  const params: any[] = [];

  if (storeId) {
    sql += ' AND store_id = $1';
    params.push(storeId);
  }

  sql += ' ORDER BY priority DESC, created_at ASC';

  const result = await query<any>(sql, params);
  return result.rows;
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Clean up old completed/failed jobs
 * Keeps jobs for specified number of days
 */
export async function cleanupOldJobs(keepDays: number = 30): Promise<number> {
  const result = await query(
    `DELETE FROM complaint_backfill_jobs
     WHERE status IN ('completed', 'failed')
       AND completed_at < NOW() - INTERVAL '${keepDays} days'
     RETURNING id`
  );
  return result.rowCount ?? 0;
}

/**
 * Clean up old daily limit records
 */
export async function cleanupOldDailyLimits(keepDays: number = 7): Promise<number> {
  const result = await query(
    `DELETE FROM complaint_daily_limits
     WHERE date < CURRENT_DATE - INTERVAL '${keepDays} days'
     RETURNING store_id`
  );
  return result.rowCount ?? 0;
}
