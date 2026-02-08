/**
 * GET /api/admin/backfill - Get backfill status and statistics
 * POST /api/admin/backfill - Trigger manual backfill for a product
 *
 * Admin-only endpoints for monitoring and managing the backfill queue
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBackfillStatus, createManualBackfillJob, cancelBackfillJob } from '@/services/backfill-worker';
import * as backfillDb from '@/db/backfill-helpers';

/**
 * GET /api/admin/backfill
 *
 * Returns:
 * - Overall statistics (pending, in_progress, completed, etc.)
 * - Active jobs list with progress
 * - Daily limit status per store
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('store_id');
    const jobId = searchParams.get('job_id');

    // Get specific job status
    if (jobId) {
      const jobStatus = await backfillDb.getJobStatusView(jobId);
      if (!jobStatus) {
        return NextResponse.json({ error: 'Job not found' }, { status: 404 });
      }
      return NextResponse.json({ job: jobStatus });
    }

    // Get overall backfill status
    const { stats, activeJobs } = await getBackfillStatus();

    // Filter by store if requested
    const filteredJobs = storeId
      ? activeJobs.filter(job => job.store_id === storeId)
      : activeJobs;

    return NextResponse.json({
      stats,
      active_jobs: filteredJobs,
      active_jobs_count: filteredJobs.length,
    });
  } catch (error: any) {
    console.error('[API BACKFILL] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/backfill
 *
 * Body:
 * - action: 'create' | 'cancel' | 'run_worker'
 * - product_id: string (for create)
 * - store_id: string (for create)
 * - owner_id: string (for create)
 * - job_id: string (for cancel)
 * - priority: number (optional, for create)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, product_id, store_id, owner_id, job_id, priority } = body;

    switch (action) {
      case 'create': {
        if (!product_id || !store_id || !owner_id) {
          return NextResponse.json(
            { error: 'Missing required fields: product_id, store_id, owner_id' },
            { status: 400 }
          );
        }

        const job = await createManualBackfillJob(product_id, store_id, owner_id, priority || 10);
        return NextResponse.json({
          success: true,
          job: {
            id: job.id,
            product_id: job.product_id,
            store_id: job.store_id,
            total_reviews: job.total_reviews,
            status: job.status,
            triggered_by: job.triggered_by,
          },
        });
      }

      case 'cancel': {
        if (!job_id) {
          return NextResponse.json(
            { error: 'Missing required field: job_id' },
            { status: 400 }
          );
        }

        const cancelledJob = await cancelBackfillJob(job_id);
        if (!cancelledJob) {
          return NextResponse.json(
            { error: 'Job not found or cannot be cancelled' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          job: {
            id: cancelledJob.id,
            status: cancelledJob.status,
          },
        });
      }

      case 'run_worker': {
        // Import dynamically to avoid circular dependency
        const { runBackfillWorker } = await import('@/services/backfill-worker');
        const result = await runBackfillWorker(body.max_jobs || 5);

        return NextResponse.json({
          success: true,
          result,
        });
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Must be one of: create, cancel, run_worker' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('[API BACKFILL] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
