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
  // For testing: every 2 minutes
  const cronSchedule = process.env.NODE_ENV === 'production'
    ? '0 5 * * *'  // 8:00 AM MSK daily
    : '*/2 * * * *'; // Every 2 minutes for testing

  console.log(`[CRON] Scheduling daily review sync: ${cronSchedule}`);
  console.log(`[CRON] Mode: ${process.env.NODE_ENV === 'production' ? 'PRODUCTION (8:00 AM MSK)' : 'TESTING (every 2 min)'}`);

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

      // Sync each store sequentially (to avoid rate limiting)
      for (const store of stores) {
        try {
          await syncStoreReviews(store.id, store.name);
          successCount++;

          // Wait 2 seconds between stores to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          errorCount++;
          console.error(`[CRON] Error syncing store ${store.name}:`, error);
        }
      }

      const duration = Math.round((Date.now() - startTime) / 1000);

      console.log('\n========================================');
      console.log(`[CRON] ✅ Daily review sync completed`);
      console.log(`[CRON] Duration: ${duration}s`);
      console.log(`[CRON] Success: ${successCount}/${stores.length} stores`);
      console.log(`[CRON] Errors: ${errorCount}`);
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
