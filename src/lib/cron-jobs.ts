/**
 * Cron Jobs for automated tasks
 *
 * Jobs:
 * 1. Daily review sync at 8:00 AM MSK
 * 2. AI complaint generation after sync
 */

import cron from 'node-cron';
import * as dbHelpers from '@/db/helpers';

// Track running jobs
const runningJobs: { [jobName: string]: boolean } = {};

/**
 * Sync reviews for a single store
 */
async function syncStoreReviews(storeId: string, storeName: string): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002';

  console.log(`[CRON] Starting review sync for store: ${storeName} (${storeId})`);

  try {
    const response = await fetch(`${baseUrl}/api/stores/${storeId}/reviews/update?mode=incremental`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`HTTP ${response.status}: ${errorData.error || errorData.details || 'Unknown error'}`);
    }

    const result = await response.json();
    console.log(`[CRON] ✅ Successfully synced reviews for ${storeName}: ${result.message}`);
  } catch (error: any) {
    console.error(`[CRON] ❌ Failed to sync reviews for ${storeName}:`, error.message);
    throw error;
  }
}

/**
 * Daily review sync job - runs at 8:00 AM MSK
 * MSK = UTC+3
 * 8:00 AM MSK = 5:00 AM UTC
 */
export function startDailyReviewSync() {
  // For production: '0 5 * * *' (5:00 AM UTC = 8:00 AM MSK)
  // For testing: every 5 minutes (full sync cycle takes ~4 minutes)
  const cronSchedule = process.env.NODE_ENV === 'production'
    ? '0 5 * * *'  // 8:00 AM MSK daily
    : '*/5 * * * *'; // Every 5 minutes for testing

  console.log(`[CRON] Scheduling daily review sync: ${cronSchedule}`);
  console.log(`[CRON] Mode: ${process.env.NODE_ENV === 'production' ? 'PRODUCTION (8:00 AM MSK)' : 'TESTING (every 5 min)'}`);

  const job = cron.schedule(cronSchedule, async () => {
    const jobName = 'daily-review-sync';

    // Prevent concurrent runs
    if (runningJobs[jobName]) {
      console.log(`[CRON] ⚠️  Job ${jobName} is already running, skipping this trigger`);
      return;
    }

    runningJobs[jobName] = true;
    const startTime = Date.now();

    try {
      console.log('\n========================================');
      console.log(`[CRON] 🚀 Starting daily review sync at ${new Date().toISOString()}`);
      console.log('========================================\n');

      // Get all stores
      const stores = await dbHelpers.getAllStores();
      console.log(`[CRON] Found ${stores.length} stores to sync`);

      let successCount = 0;
      let errorCount = 0;
      let totalComplaintsGenerated = 0;
      let totalTemplated = 0;
      let totalComplaintsFailed = 0;

      // Sync each store sequentially (to avoid rate limiting)
      for (const store of stores) {
        try {
          await syncStoreReviews(store.id, store.name);
          successCount++;

          // Auto-generate complaints immediately for active products (100% automation)
          console.log(`[CRON] Starting auto-complaint generation for ${store.name}...`);
          const complaintStats = await generateComplaintsForStore(store.id, store.name);
          totalComplaintsGenerated += complaintStats.generated;
          totalTemplated += complaintStats.templated;
          totalComplaintsFailed += complaintStats.failed;

          // Wait 2 seconds between stores to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          errorCount++;
          console.error(`[CRON] Error syncing store ${store.name}:`, error);
        }
      }

      const duration = Math.round((Date.now() - startTime) / 1000);
      const aiGenerated = totalComplaintsGenerated - totalTemplated;

      console.log('\n========================================');
      console.log(`[CRON] ✅ Daily review sync + complaint generation completed`);
      console.log(`[CRON] Duration: ${duration}s`);
      console.log(`[CRON] Stores synced: ${successCount}/${stores.length}`);
      console.log(`[CRON] Errors: ${errorCount}`);
      console.log(`[CRON] Complaints generated: ${totalComplaintsGenerated} total`);
      console.log(`[CRON]   - Templates: ${totalTemplated} (zero cost)`);
      console.log(`[CRON]   - AI generated: ${aiGenerated}`);
      console.log(`[CRON]   - Failed: ${totalComplaintsFailed}`);
      console.log('========================================\n');

    } catch (error: any) {
      console.error('[CRON] ❌ Fatal error in daily review sync:', error);
    } finally {
      runningJobs[jobName] = false;
    }
  }, {
    timezone: 'UTC'
  });

  job.start();
  console.log('[CRON] ✅ Daily review sync job started successfully');

  return job;
}

/**
 * Generate complaints for reviews without complaints
 */
async function generateComplaintsForStore(storeId: string, storeName: string): Promise<{ generated: number; failed: number; templated: number }> {
  const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002';

  console.log(`[CRON] Checking reviews without complaints for: ${storeName} (${storeId})`);

  try {
    // Get reviews without complaints (max 50 per store, rating 1-3)
    const reviewIds = await dbHelpers.getReviewsWithoutComplaints(storeId, 3, 50);

    if (reviewIds.length === 0) {
      console.log(`[CRON] No reviews need complaints for ${storeName}`);
      return { generated: 0, failed: 0, templated: 0 };
    }

    console.log(`[CRON] Found ${reviewIds.length} reviews needing complaints for ${storeName}`);

    // Call batch generation API
    const response = await fetch(`${baseUrl}/api/extension/stores/${storeId}/reviews/generate-complaints-batch`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ review_ids: reviewIds }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`HTTP ${response.status}: ${errorData.error || 'Unknown error'}`);
    }

    const result = await response.json();

    // Count template usage from logs (approximate)
    const templatedCount = result.generated.filter((g: any) => g.cost_usd === 0).length;

    console.log(`[CRON] ✅ Generated complaints for ${storeName}: ${result.generated.length} total (${templatedCount} templates, ${result.generated.length - templatedCount} AI), ${result.failed.length} failed`);

    return {
      generated: result.generated.length,
      failed: result.failed.length,
      templated: templatedCount,
    };
  } catch (error: any) {
    console.error(`[CRON] ❌ Failed to generate complaints for ${storeName}:`, error.message);
    return { generated: 0, failed: 0, templated: 0 };
  }
}

/**
 * Daily complaint generation job - runs at 9:00 AM MSK (1 hour after review sync)
 * MSK = UTC+3
 * 9:00 AM MSK = 6:00 AM UTC
 */
export function startDailyComplaintGeneration() {
  // For production: '0 6 * * *' (6:00 AM UTC = 9:00 AM MSK)
  // For testing: every 10 minutes
  const cronSchedule = process.env.NODE_ENV === 'production'
    ? '0 6 * * *'  // 9:00 AM MSK daily (1 hour after review sync)
    : '*/10 * * * *'; // Every 10 minutes for testing

  console.log(`[CRON] Scheduling daily complaint generation: ${cronSchedule}`);
  console.log(`[CRON] Mode: ${process.env.NODE_ENV === 'production' ? 'PRODUCTION (9:00 AM MSK)' : 'TESTING (every 10 min)'}`);

  const job = cron.schedule(cronSchedule, async () => {
    const jobName = 'daily-complaint-generation';

    // Prevent concurrent runs
    if (runningJobs[jobName]) {
      console.log(`[CRON] ⚠️  Job ${jobName} is already running, skipping this trigger`);
      return;
    }

    runningJobs[jobName] = true;
    const startTime = Date.now();

    try {
      console.log('\n========================================');
      console.log(`[CRON] 🚀 Starting daily complaint generation at ${new Date().toISOString()}`);
      console.log('========================================\n');

      // Get all active stores
      const stores = await dbHelpers.getAllStores();
      console.log(`[CRON] Found ${stores.length} stores to process`);

      let totalGenerated = 0;
      let totalFailed = 0;
      let totalTemplated = 0;
      let storesProcessed = 0;

      // Process each store sequentially
      for (const store of stores) {
        try {
          const stats = await generateComplaintsForStore(store.id, store.name);
          totalGenerated += stats.generated;
          totalFailed += stats.failed;
          totalTemplated += stats.templated;
          if (stats.generated > 0) storesProcessed++;

          // Wait 2 seconds between stores to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          console.error(`[CRON] Error processing store ${store.name}:`, error);
        }
      }

      const duration = Math.round((Date.now() - startTime) / 1000);
      const aiGenerated = totalGenerated - totalTemplated;

      console.log('\n========================================');
      console.log(`[CRON] ✅ Daily complaint generation completed`);
      console.log(`[CRON] Duration: ${duration}s`);
      console.log(`[CRON] Stores processed: ${storesProcessed}/${stores.length}`);
      console.log(`[CRON] Total generated: ${totalGenerated} complaints`);
      console.log(`[CRON]   - Templates: ${totalTemplated} (zero cost)`);
      console.log(`[CRON]   - AI generated: ${aiGenerated}`);
      console.log(`[CRON] Failed: ${totalFailed}`);
      console.log('========================================\n');

    } catch (error: any) {
      console.error('[CRON] ❌ Fatal error in daily complaint generation:', error);
    } finally {
      runningJobs[jobName] = false;
    }
  }, {
    timezone: 'UTC'
  });

  job.start();
  console.log('[CRON] ✅ Daily complaint generation job started successfully');

  return job;
}

/**
 * Stop all cron jobs
 */
export function stopAllJobs() {
  console.log('[CRON] Stopping all cron jobs...');
  cron.getTasks().forEach((task) => {
    task.stop();
  });
  console.log('[CRON] All cron jobs stopped');
}

/**
 * Get status of all jobs
 */
export function getJobsStatus() {
  const tasks = cron.getTasks();
  return {
    totalJobs: tasks.size,
    runningJobs: Object.keys(runningJobs).filter(key => runningJobs[key]),
    allJobs: Array.from(tasks.entries()).map(([key, task]) => ({
      name: key,
      running: task.options.scheduled || false,
    })),
  };
}
