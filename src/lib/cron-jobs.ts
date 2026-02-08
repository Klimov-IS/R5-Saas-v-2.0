/**
 * Cron Jobs for automated tasks
 *
 * Jobs:
 * 1. Hourly review sync + auto-complaint generation (every hour in prod, every 5 min in test)
 * 2. Adaptive dialogue sync (15min day / 60min night based on MSK timezone)
 * 3. Daily product sync (7:00 AM MSK in prod, every 10 min in test)
 */

import cron from 'node-cron';
import * as dbHelpers from '@/db/helpers';
import { runBackfillWorker } from '@/services/backfill-worker';

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
 * Hourly review sync job with auto-complaint generation
 * Runs every hour to keep review data fresh and auto-generate complaints
 * for negative reviews (1-3 stars) based on product_rules
 */
export function startDailyReviewSync() {
  // For production: '0 * * * *' (every hour on the hour)
  // For testing: every 5 minutes (full sync cycle takes ~4 minutes)
  const cronSchedule = process.env.NODE_ENV === 'production'
    ? '0 * * * *'  // Every hour
    : '*/5 * * * *'; // Every 5 minutes for testing

  console.log(`[CRON] Scheduling hourly review sync: ${cronSchedule}`);
  console.log(`[CRON] Mode: ${process.env.NODE_ENV === 'production' ? 'PRODUCTION (every hour)' : 'TESTING (every 5 min)'}`);

  const job = cron.schedule(cronSchedule, async () => {
    const jobName = 'hourly-review-sync';

    // Prevent concurrent runs
    if (runningJobs[jobName]) {
      console.log(`[CRON] ⚠️  Job ${jobName} is already running, skipping this trigger`);
      return;
    }

    runningJobs[jobName] = true;
    const startTime = Date.now();

    try {
      console.log('\n========================================');
      console.log(`[CRON] 🚀 Starting hourly review sync at ${new Date().toISOString()}`);
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
      console.log(`[CRON] ✅ Hourly review sync + complaint generation completed`);
      console.log(`[CRON] Duration: ${duration}s`);
      console.log(`[CRON] Stores synced: ${successCount}/${stores.length}`);
      console.log(`[CRON] Errors: ${errorCount}`);
      console.log(`[CRON] Complaints generated: ${totalComplaintsGenerated} total`);
      console.log(`[CRON]   - Templates: ${totalTemplated} (zero cost)`);
      console.log(`[CRON]   - AI generated: ${aiGenerated}`);
      console.log(`[CRON]   - Failed: ${totalComplaintsFailed}`);
      console.log('========================================\n');

    } catch (error: any) {
      console.error('[CRON] ❌ Fatal error in hourly review sync:', error);
    } finally {
      runningJobs[jobName] = false;
    }
  }, {
    timezone: 'UTC'
  });

  job.start();
  console.log('[CRON] ✅ Hourly review sync job started successfully');

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
    // Get reviews without complaints (max 50 per store, rating 1-4)
    const reviewIds = await dbHelpers.getReviewsWithoutComplaints(storeId, 4, 50);

    if (reviewIds.length === 0) {
      console.log(`[CRON] ✅ No backlog — event-driven coverage is working for ${storeName}`);
      return { generated: 0, failed: 0, templated: 0 };
    }

    console.log(`[CRON] ⚠️  FALLBACK: Found ${reviewIds.length} reviews without complaints for ${storeName} (missed by event-driven)`);

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
 * Sync products for a single store
 */
async function syncStoreProducts(storeId: string, storeName: string): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002';

  console.log(`[CRON] Syncing products for: ${storeName}`);

  try {
    const response = await fetch(`${baseUrl}/api/stores/${storeId}/products/update`, {
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
    console.log(`[CRON] ✅ ${storeName}: ${result.message}`);
  } catch (error: any) {
    console.error(`[CRON] ❌ Failed to sync products for ${storeName}:`, error.message);
    throw error;
  }
}

/**
 * Daily product sync job - runs once per day at 7:00 AM MSK
 * MSK = UTC+3
 * 7:00 AM MSK = 4:00 AM UTC
 */
export function startDailyProductSync() {
  // For production: '0 4 * * *' (4:00 AM UTC = 7:00 AM MSK)
  // For testing: every 10 minutes
  const cronSchedule = process.env.NODE_ENV === 'production'
    ? '0 4 * * *'  // 7:00 AM MSK daily
    : '*/10 * * * *'; // Every 10 minutes for testing

  console.log(`[CRON] Scheduling daily product sync: ${cronSchedule}`);
  console.log(`[CRON] Mode: ${process.env.NODE_ENV === 'production' ? 'PRODUCTION (7:00 AM MSK daily)' : 'TESTING (every 10 min)'}`);

  const job = cron.schedule(cronSchedule, async () => {
    const jobName = 'daily-product-sync';

    // Prevent concurrent runs
    if (runningJobs[jobName]) {
      console.log(`[CRON] ⚠️  Job ${jobName} is already running, skipping this trigger`);
      return;
    }

    runningJobs[jobName] = true;
    const startTime = Date.now();

    try {
      console.log('\n========================================');
      console.log(`[CRON] 🚀 Starting daily product sync at ${new Date().toISOString()}`);
      console.log('========================================\n');

      // Get all stores
      const stores = await dbHelpers.getAllStores();
      console.log(`[CRON] Found ${stores.length} stores to sync`);

      let successCount = 0;
      let errorCount = 0;

      // Sync each store sequentially (to avoid rate limiting)
      for (const store of stores) {
        try {
          await syncStoreProducts(store.id, store.name);
          successCount++;

          // Wait 3 seconds between stores to avoid rate limiting (product sync is heavier)
          await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (error: any) {
          errorCount++;
          console.error(`[CRON] Error syncing store ${store.name}:`, error.message);
        }
      }

      const duration = Math.round((Date.now() - startTime) / 1000);

      console.log('\n========================================');
      console.log(`[CRON] ✅ Daily product sync completed`);
      console.log(`[CRON] Duration: ${duration}s`);
      console.log(`[CRON] Stores synced: ${successCount}/${stores.length}`);
      console.log(`[CRON] Errors: ${errorCount}`);
      console.log('========================================\n');

    } catch (error: any) {
      console.error('[CRON] ❌ Fatal error in daily product sync:', error);
    } finally {
      runningJobs[jobName] = false;
    }
  }, {
    timezone: 'UTC'
  });

  job.start();
  console.log('[CRON] ✅ Daily product sync job started successfully');

  return job;
}

/**
 * Sync dialogues for a single store
 */
async function syncStoreDialogues(storeId: string, storeName: string): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue';
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002';

  console.log(`[CRON] Syncing dialogues for: ${storeName}`);

  try {
    const response = await fetch(`${baseUrl}/api/stores/${storeId}/dialogues/update`, {
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
    console.log(`[CRON] ✅ ${storeName}: ${result.message}`);
  } catch (error: any) {
    console.error(`[CRON] ❌ Failed to sync dialogues for ${storeName}:`, error.message);
    throw error;
  }
}

/**
 * Adaptive dialogue sync - 15min day / 60min night
 * Runs every 15 minutes during day (06:00-21:00 MSK)
 * Runs every 60 minutes during night (21:00-06:00 MSK)
 * MSK = UTC+3
 */
export function startAdaptiveDialogueSync() {
  // Calculate current interval based on MSK time
  const getInterval = () => {
    const now = new Date();
    const mskHour = (now.getUTCHours() + 3) % 24; // Convert UTC to MSK (UTC+3)

    // Day: 06:00-21:00 MSK → every 15 minutes
    // Night: 21:00-06:00 MSK → every 60 minutes
    return (mskHour >= 6 && mskHour < 21) ? 15 : 60;
  };

  const runSync = async () => {
    const jobName = 'adaptive-dialogue-sync';

    // Prevent concurrent runs
    if (runningJobs[jobName]) {
      console.log(`[CRON] ⚠️  Dialogue sync already running, skipping this trigger`);
      return;
    }

    runningJobs[jobName] = true;
    const startTime = Date.now();
    const interval = getInterval();

    try {
      console.log('\n========================================');
      console.log(`[CRON] 🔄 Starting adaptive dialogue sync at ${new Date().toISOString()}`);
      console.log(`[CRON] Current interval: ${interval} minutes`);
      console.log('========================================\n');

      // Get all stores
      const stores = await dbHelpers.getAllStores();
      console.log(`[CRON] Found ${stores.length} stores to sync`);

      let successCount = 0;
      let errorCount = 0;

      // Sync each store sequentially (to avoid rate limiting)
      for (const store of stores) {
        try {
          await syncStoreDialogues(store.id, store.name);
          successCount++;

          // Wait 2 seconds between stores to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error: any) {
          errorCount++;
          console.error(`[CRON] Error syncing store ${store.name}:`, error.message);
        }
      }

      const duration = Math.round((Date.now() - startTime) / 1000);

      console.log('\n========================================');
      console.log(`[CRON] ✅ Dialogue sync completed`);
      console.log(`[CRON] Duration: ${duration}s`);
      console.log(`[CRON] Stores synced: ${successCount}/${stores.length}`);
      console.log(`[CRON] Errors: ${errorCount}`);
      console.log('========================================\n');

      // Schedule next run with recalculated interval
      const nextInterval = getInterval();
      const nextRunMs = nextInterval * 60 * 1000;
      const nextRunTime = new Date(Date.now() + nextRunMs).toISOString();

      console.log(`[CRON] Next dialogue sync in ${nextInterval} minutes (at ${nextRunTime})\n`);
      setTimeout(runSync, nextRunMs);

    } catch (error: any) {
      console.error('[CRON] ❌ Fatal error in dialogue sync:', error);
      // Retry in 15 minutes on fatal error
      console.log('[CRON] Retrying in 15 minutes...');
      setTimeout(runSync, 15 * 60 * 1000);
    } finally {
      runningJobs[jobName] = false;
    }
  };

  // Start first sync 5 seconds after server start
  console.log('[CRON] 🚀 Starting adaptive dialogue sync job...');
  console.log('[CRON] Mode: 15min (day) / 60min (night) based on MSK timezone');
  setTimeout(runSync, 5000); // 5 second delay to let server fully initialize
  console.log('[CRON] ✅ Adaptive dialogue sync scheduled (first run in 5 seconds)');
}

/**
 * Backfill worker job - processes backfill queue
 * Runs every 5 minutes to process pending backfill jobs
 * Handles mass complaint generation for activated products
 */
export function startBackfillWorker() {
  // Every 5 minutes in all environments
  const cronSchedule = '*/5 * * * *';

  console.log(`[CRON] Scheduling backfill worker: ${cronSchedule}`);

  const job = cron.schedule(cronSchedule, async () => {
    const jobName = 'backfill-worker';

    // Prevent concurrent runs
    if (runningJobs[jobName]) {
      console.log(`[CRON] ⚠️  Job ${jobName} is already running, skipping this trigger`);
      return;
    }

    runningJobs[jobName] = true;

    try {
      const result = await runBackfillWorker(5); // Process up to 5 jobs per run

      if (result.jobs_processed > 0) {
        console.log(`[CRON] Backfill worker: processed ${result.jobs_processed} jobs, generated ${result.total_generated} complaints`);
      }
    } catch (error: any) {
      console.error('[CRON] ❌ Backfill worker error:', error.message);
    } finally {
      runningJobs[jobName] = false;
    }
  }, {
    timezone: 'UTC'
  });

  job.start();
  console.log('[CRON] ✅ Backfill worker job started successfully');

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
    allJobs: Array.from(tasks.entries()).map(([key]) => ({
      name: key,
      running: runningJobs[key] || false,
    })),
  };
}
