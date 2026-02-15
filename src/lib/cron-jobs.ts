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

import { syncProductRulesToSheets, isGoogleSheetsConfigured } from '@/services/google-sheets-sync';
import { DEFAULT_STOP_MESSAGE, DEFAULT_STOP_MESSAGE_4STAR, getNextSlotTime } from '@/lib/auto-sequence-templates';

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
      const failedStores: typeof stores = [];

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
          failedStores.push(store);
          console.error(`[CRON] Error syncing store ${store.name}:`, error);
        }
      }

      // Retry failed stores once (handles transient WB API rate limits / timeouts)
      if (failedStores.length > 0) {
        console.log(`[CRON] ♻️  Retrying ${failedStores.length} failed stores...`);
        for (const store of failedStores) {
          try {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Extra delay before retry
            await syncStoreReviews(store.id, store.name);
            successCount++;
            errorCount--;

            // Also generate complaints for retried stores
            const complaintStats = await generateComplaintsForStore(store.id, store.name);
            totalComplaintsGenerated += complaintStats.generated;
            totalTemplated += complaintStats.templated;
            totalComplaintsFailed += complaintStats.failed;

            console.log(`[CRON] ♻️  Retry succeeded for ${store.name}`);
          } catch (retryError: any) {
            console.error(`[CRON] ♻️  Retry also failed for ${store.name}: ${retryError.message}`);
          }
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
    const reviewIds = await dbHelpers.getReviewsWithoutComplaints(storeId, 4, 200);

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
  // Calculate current interval based on MSK time (3-tier schedule)
  const getInterval = () => {
    const now = new Date();
    const mskHour = (now.getUTCHours() + 3) % 24; // Convert UTC to MSK (UTC+3)

    // Work hours: 09:00-18:00 MSK → every 5 minutes (high frequency)
    // Morning/evening: 06:00-09:00 and 18:00-21:00 MSK → every 15 minutes
    // Night: 21:00-06:00 MSK → every 60 minutes
    if (mskHour >= 9 && mskHour < 18) return 5;
    if (mskHour >= 6 && mskHour < 21) return 15;
    return 60;
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
  console.log('[CRON] Mode: 5min (work 09-18) / 15min (morning/evening) / 60min (night) MSK');
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

// Stores cache removed (2026-02-15): direct DB query is fast enough (<500ms with partial index)

/**
 * Daily Google Sheets sync job
 * Exports all active product rules to Google Sheets for management visibility
 * Runs daily at 6:00 AM MSK (3:00 AM UTC)
 */
export function startGoogleSheetsSync() {
  // Check if configured
  if (!isGoogleSheetsConfigured()) {
    console.log('[CRON] ⚠️ Google Sheets sync not configured (missing env variables), skipping...');
    return null;
  }

  // 6:00 AM MSK = 3:00 AM UTC
  const cronSchedule = process.env.NODE_ENV === 'production'
    ? '0 3 * * *'  // 6:00 AM MSK daily
    : '*/30 * * * *'; // Every 30 minutes for testing

  console.log(`[CRON] Scheduling Google Sheets sync: ${cronSchedule}`);
  console.log(`[CRON] Mode: ${process.env.NODE_ENV === 'production' ? 'PRODUCTION (6:00 AM MSK daily)' : 'TESTING (every 30 min)'}`);

  const job = cron.schedule(cronSchedule, async () => {
    const jobName = 'google-sheets-sync';

    // Prevent concurrent runs
    if (runningJobs[jobName]) {
      console.log(`[CRON] ⚠️ Job ${jobName} is already running, skipping this trigger`);
      return;
    }

    runningJobs[jobName] = true;

    try {
      console.log('\n========================================');
      console.log(`[CRON] 📊 Starting Google Sheets sync at ${new Date().toISOString()}`);
      console.log('========================================\n');

      const result = await syncProductRulesToSheets();

      console.log('\n========================================');
      console.log(`[CRON] ${result.success ? '✅' : '❌'} Google Sheets sync ${result.success ? 'completed' : 'failed'}`);
      console.log(`[CRON] Duration: ${result.duration_ms}ms`);
      console.log(`[CRON] Stores: ${result.storesProcessed}, Products: ${result.productsProcessed}`);
      console.log(`[CRON] Rows written: ${result.rowsWritten}`);
      if (result.error) {
        console.log(`[CRON] Error: ${result.error}`);
      }
      console.log('========================================\n');

    } catch (error: any) {
      console.error('[CRON] ❌ Fatal error in Google Sheets sync:', error);
    } finally {
      runningJobs[jobName] = false;
    }
  }, {
    timezone: 'UTC'
  });

  job.start();
  console.log('[CRON] ✅ Google Sheets sync job started successfully');

  return job;
}

/**
 * Auto-sequence processor
 * Sends scheduled follow-up messages for chats in 'awaiting_reply' status.
 * 1 message/day, up to 14 days. Stops if client replies.
 */
export function startAutoSequenceProcessor() {
  const runProcessor = async () => {
    const jobName = 'auto-sequence-processor';

    if (runningJobs[jobName]) {
      console.log(`[CRON] ⚠️  Auto-sequence processor already running, skipping`);
      return;
    }

    runningJobs[jobName] = true;
    const startTime = Date.now();

    try {
      // Only send messages during daytime (8:00-22:00 MSK)
      const now = new Date();
      const mskHour = (now.getUTCHours() + 3) % 24;
      if (mskHour < 8 || mskHour >= 22) {
        return; // Nighttime, skip silently
      }

      const pendingSequences = await dbHelpers.getPendingSequences(100);

      if (pendingSequences.length === 0) {
        return;
      }

      const dryRun = process.env.AUTO_SEQUENCE_DRY_RUN === 'true';
      console.log(`[CRON] 📨 Auto-sequence: processing ${pendingSequences.length} pending sequences${dryRun ? ' [DRY RUN]' : ''}`);

      let sent = 0;
      let stopped = 0;
      let skipped = 0;
      let errors = 0;

      for (const seq of pendingSequences) {
        try {
          // Check stop condition 1: did client reply since sequence started?
          const messages = await dbHelpers.getChatMessages(seq.chat_id);
          const clientReplied = messages.some(
            m => m.sender === 'client' && new Date(m.timestamp) > new Date(seq.started_at)
          );

          if (clientReplied) {
            if (!dryRun) await dbHelpers.stopSequence(seq.id, 'client_replied');
            stopped++;
            console.log(`[CRON] 🛑 Sequence ${seq.id}: stopped (client replied)${dryRun ? ' [DRY RUN]' : ''}`);
            continue;
          }

          // Check stop condition 2: chat status still valid?
          const chat = await dbHelpers.getChatById(seq.chat_id);
          if (!chat || (chat.status !== 'awaiting_reply' && chat.status !== 'in_progress' && chat.status !== 'inbox')) {
            if (!dryRun) await dbHelpers.stopSequence(seq.id, 'status_changed');
            stopped++;
            console.log(`[CRON] 🛑 Sequence ${seq.id}: stopped (chat status=${chat?.status || 'not found'})${dryRun ? ' [DRY RUN]' : ''}`);
            continue;
          }

          // Check skip condition: seller already sent a message today?
          const todayStart = new Date();
          todayStart.setUTCHours(0, 0, 0, 0);
          const sellerSentToday = messages.some(
            m => m.sender === 'seller' && new Date(m.timestamp) >= todayStart
          );

          if (sellerSentToday) {
            // Reschedule to a random slot tomorrow without advancing step
            const nextSlot = getNextSlotTime();
            if (!dryRun) await dbHelpers.rescheduleSequence(seq.id, nextSlot);
            skipped++;
            console.log(`[CRON] ⏭️  Sequence ${seq.id}: skipped (seller already sent today), rescheduled to tomorrow${dryRun ? ' [DRY RUN]' : ''}`);
            continue;
          }

          // Load settings for stop message and templates
          const settings = await dbHelpers.getUserSettings();

          // Check max steps — send СТОП message and close chat
          if (seq.current_step >= seq.max_steps) {
            // Choose stop message based on sequence type (negatives vs 4-star)
            const is4Star = seq.sequence_type === 'no_reply_followup_4star';
            const stopMessage = is4Star
              ? (settings?.no_reply_stop_message2 || DEFAULT_STOP_MESSAGE_4STAR)
              : (settings?.no_reply_stop_message || DEFAULT_STOP_MESSAGE);

            if (dryRun) {
              console.log(`[CRON] 🧪 DRY RUN: would send STOP message to chat ${seq.chat_id} and close it`);
            } else {
              try {
                const { sendChatMessage: sendStopMsg } = await import('@/lib/wb-chat-api');
                await sendStopMsg(seq.store_id, seq.chat_id, stopMessage);

                // Record stop message in chat_messages
                const stopMsgId = `auto_stop_${seq.id}`;
                await dbHelpers.createChatMessage({
                  id: stopMsgId,
                  chat_id: seq.chat_id,
                  store_id: seq.store_id,
                  owner_id: seq.owner_id,
                  sender: 'seller',
                  text: stopMessage,
                  timestamp: new Date().toISOString(),
                  is_auto_reply: true,
                });

                // Update chat last message + close
                await dbHelpers.updateChat(seq.chat_id, {
                  last_message_text: stopMessage,
                  last_message_sender: 'seller',
                  last_message_date: new Date().toISOString(),
                  status: 'closed' as dbHelpers.ChatStatus,
                  status_updated_at: new Date().toISOString(),
                  completion_reason: 'no_reply' as dbHelpers.CompletionReason,
                });

                console.log(`[CRON] 🛑 Sequence ${seq.id}: completed → stop message sent + chat closed`);
              } catch (stopErr: any) {
                console.error(`[CRON] Failed to send stop message for sequence ${seq.id}:`, stopErr.message);
              }

              await dbHelpers.completeSequence(seq.id);
            }
            stopped++;
            continue;
          }

          // Get message template
          const msgTemplates = seq.messages as { day: number; text: string }[];
          const template = msgTemplates[seq.current_step];

          if (!template) {
            if (!dryRun) await dbHelpers.completeSequence(seq.id);
            stopped++;
            continue;
          }

          // DRY RUN: log what would be sent
          if (dryRun) {
            console.log(`[CRON] 🧪 DRY RUN: would send step ${seq.current_step + 1}/${seq.max_steps} to chat ${seq.chat_id}`);
            console.log(`[CRON] 🧪 DRY RUN: "${template.text.substring(0, 100)}..."`);
            sent++;
            continue;
          }

          // Send message via WB Chat API
          const { sendChatMessage } = await import('@/lib/wb-chat-api');
          await sendChatMessage(seq.store_id, seq.chat_id, template.text);

          // Record sent message in chat_messages
          const msgId = `auto_${seq.id}_${seq.current_step}`;
          await dbHelpers.createChatMessage({
            id: msgId,
            chat_id: seq.chat_id,
            store_id: seq.store_id,
            owner_id: seq.owner_id,
            sender: 'seller',
            text: template.text,
            timestamp: new Date().toISOString(),
            is_auto_reply: true,
          });

          // Update chat's last message info
          await dbHelpers.updateChat(seq.chat_id, {
            last_message_text: template.text,
            last_message_sender: 'seller',
            last_message_date: new Date().toISOString(),
          });

          // Advance sequence
          await dbHelpers.advanceSequence(seq.id);

          sent++;
          console.log(`[CRON] ✉️  Sequence ${seq.id}: sent step ${seq.current_step + 1}/${seq.max_steps}`);

          // Rate limit: 3 seconds between sends
          await new Promise(resolve => setTimeout(resolve, 3000));

        } catch (error: any) {
          errors++;
          console.error(`[CRON] ❌ Sequence ${seq.id}: error - ${error.message}`);
        }
      }

      if (sent > 0 || stopped > 0 || skipped > 0 || errors > 0) {
        const duration = Math.round((Date.now() - startTime) / 1000);
        console.log(`[CRON] 📨 Auto-sequence: ${sent} sent, ${stopped} stopped, ${skipped} skipped, ${errors} errors (${duration}s)${dryRun ? ' [DRY RUN]' : ''}`);
      }

    } catch (error: any) {
      console.error('[CRON] ❌ Fatal error in auto-sequence processor:', error);
    } finally {
      runningJobs[jobName] = false;
    }
  };

  // Run every 30 minutes
  const job = cron.schedule('*/30 * * * *', runProcessor, {
    timezone: 'UTC'
  });

  job.start();
  console.log('[CRON] ✅ Auto-sequence processor started (every 30 min)');

  return job;
}

/**
 * Nightly full sync of reviews — runs daily at 22:00 MSK (19:00 UTC)
 * Processes ALL 12 chunks (3 years of history) every night with parallel store processing.
 * Concurrency: 5 stores simultaneously, 5-min timeout per store.
 *
 * Chunk layout (each 90 days):
 * 0: 0-90 days ago (most recent)
 * 1: 91-180 days ago
 * ...
 * 11: 991-1080 days ago
 */
export function startRollingReviewFullSync() {
  // 19:00 UTC = 22:00 MSK, every day (including Sunday)
  const cronSchedule = process.env.NODE_ENV === 'production'
    ? '0 19 * * *'
    : '*/30 * * * *'; // Every 30 min for testing

  console.log(`[CRON] Scheduling nightly full review sync: ${cronSchedule}`);
  console.log(`[CRON] Mode: ${process.env.NODE_ENV === 'production' ? 'PRODUCTION (22:00 MSK, all 12 chunks, concurrency=5)' : 'TESTING (every 30 min)'}`);

  const job = cron.schedule(cronSchedule, async () => {
    const jobName = 'rolling-review-full-sync';

    if (runningJobs[jobName]) {
      console.log(`[CRON] ⚠️  Job ${jobName} is already running, skipping this trigger`);
      return;
    }

    runningJobs[jobName] = true;
    const startTime = Date.now();

    try {
      const now = new Date();
      const CHUNK_DAYS = 90;
      const TOTAL_CHUNKS = 12;
      const CONCURRENCY = 5;
      const STORE_TIMEOUT_MS = 5 * 60 * 1000; // 5 min per store

      // Process ALL chunks every night (full 3-year coverage)
      const chunksToProcess = Array.from({ length: TOTAL_CHUNKS }, (_, i) => i);

      const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue';
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002';

      // Only WB stores (OZON review sync not supported yet)
      const stores = await dbHelpers.getAllStores('wb');

      console.log('\n========================================');
      console.log(`[CRON] 🔄 Starting nightly full review sync at ${now.toISOString()}`);
      console.log(`[CRON] Processing ALL ${TOTAL_CHUNKS} chunks (0-${TOTAL_CHUNKS - 1}), concurrency=${CONCURRENCY}`);
      console.log(`[CRON] Found ${stores.length} WB stores`);
      console.log('========================================\n');

      let totalSuccess = 0;
      let totalErrors = 0;

      for (const chunkIndex of chunksToProcess) {
        const chunkStartTime = Date.now();
        const daysAgoStart = chunkIndex * CHUNK_DAYS;
        const daysAgoEnd = daysAgoStart + CHUNK_DAYS;

        const dateTo = new Date();
        dateTo.setDate(dateTo.getDate() - daysAgoStart);
        dateTo.setHours(23, 59, 59, 999);

        const dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - daysAgoEnd);
        dateFrom.setHours(0, 0, 0, 0);

        const dateFromUnix = Math.floor(dateFrom.getTime() / 1000);
        const dateToUnix = Math.floor(dateTo.getTime() / 1000);

        console.log(`[CRON] --- Chunk ${chunkIndex}/${TOTAL_CHUNKS - 1}: ${dateFrom.toISOString().split('T')[0]} → ${dateTo.toISOString().split('T')[0]} ---`);

        let successCount = 0;
        let errorCount = 0;

        // Parallel store processing with concurrency pool
        let storeIdx = 0;

        async function processNextStore() {
          while (storeIdx < stores.length) {
            const currentIdx = storeIdx++;
            const store = stores[currentIdx];

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), STORE_TIMEOUT_MS);

            try {
              const response = await fetch(
                `${baseUrl}/api/stores/${store.id}/reviews/update?mode=full&dateFrom=${dateFromUnix}&dateTo=${dateToUnix}`,
                {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                  },
                  signal: controller.signal,
                }
              );

              if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`HTTP ${response.status}: ${errorData.error || 'Unknown error'}`);
              }

              const result = await response.json();
              console.log(`[CRON] ✅ ${store.name} (chunk ${chunkIndex}): ${result.message}`);
              successCount++;
            } catch (error: any) {
              errorCount++;
              const reason = error.name === 'AbortError' ? 'timeout (5min)' : error.message;
              console.error(`[CRON] ❌ ${store.name} (chunk ${chunkIndex}): ${reason}`);
            } finally {
              clearTimeout(timeout);
            }
          }
        }

        // Launch CONCURRENCY workers in parallel
        await Promise.all(
          Array.from({ length: Math.min(CONCURRENCY, stores.length) }, () => processNextStore())
        );

        totalSuccess += successCount;
        totalErrors += errorCount;
        const chunkDuration = Math.round((Date.now() - chunkStartTime) / 1000);
        console.log(`[CRON] Chunk ${chunkIndex} done in ${chunkDuration}s: ${successCount}/${stores.length} success, ${errorCount} errors`);
      }

      const duration = Math.round((Date.now() - startTime) / 1000);
      const durationMin = Math.round(duration / 60);

      console.log('\n========================================');
      console.log(`[CRON] ✅ Nightly full review sync completed`);
      console.log(`[CRON] Chunks: all ${TOTAL_CHUNKS} (0-${TOTAL_CHUNKS - 1})`);
      console.log(`[CRON] Duration: ${duration}s (~${durationMin} min)`);
      console.log(`[CRON] Total: ${totalSuccess} success, ${totalErrors} errors`);
      console.log('========================================\n');

    } catch (error: any) {
      console.error('[CRON] ❌ Fatal error in nightly full review sync:', error);
    } finally {
      runningJobs[jobName] = false;
    }
  }, {
    timezone: 'UTC'
  });

  job.start();
  console.log('[CRON] ✅ Nightly full review sync job started successfully');

  return job;
}

/**
 * Midday review catchup — runs daily at 13:00 MSK (10:00 UTC)
 * Processes only chunk 0 (last 90 days) as a second pass to catch
 * reviews missed by the incremental sync due to WB API indexing delays.
 * Uses upsert so no duplicates are created.
 */
export function startMiddayReviewCatchup() {
  // 10:00 UTC = 13:00 MSK, every day
  const cronSchedule = process.env.NODE_ENV === 'production'
    ? '0 10 * * *'
    : '*/45 * * * *'; // Every 45 min for testing

  console.log(`[CRON] Scheduling midday review catchup: ${cronSchedule}`);
  console.log(`[CRON] Mode: ${process.env.NODE_ENV === 'production' ? 'PRODUCTION (13:00 MSK daily, chunk 0 only)' : 'TESTING (every 45 min)'}`);

  const job = cron.schedule(cronSchedule, async () => {
    const jobName = 'midday-review-catchup';

    if (runningJobs[jobName]) {
      console.log(`[CRON] ⚠️  Job ${jobName} is already running, skipping this trigger`);
      return;
    }

    runningJobs[jobName] = true;
    const startTime = Date.now();

    try {
      const CHUNK_DAYS = 90;
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue';
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002';

      const stores = await dbHelpers.getAllStores();

      console.log('\n========================================');
      console.log(`[CRON] 🔄 Starting midday review catchup at ${new Date().toISOString()}`);
      console.log(`[CRON] Processing chunk 0 (last ${CHUNK_DAYS} days) for ${stores.length} stores`);
      console.log('========================================\n');

      // Chunk 0: last 90 days
      const dateTo = new Date();
      dateTo.setHours(23, 59, 59, 999);

      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - CHUNK_DAYS);
      dateFrom.setHours(0, 0, 0, 0);

      const dateFromUnix = Math.floor(dateFrom.getTime() / 1000);
      const dateToUnix = Math.floor(dateTo.getTime() / 1000);

      console.log(`[CRON] Date range: ${dateFrom.toISOString().split('T')[0]} → ${dateTo.toISOString().split('T')[0]}`);

      let successCount = 0;
      let errorCount = 0;

      for (const store of stores) {
        try {
          const response = await fetch(
            `${baseUrl}/api/stores/${store.id}/reviews/update?mode=full&dateFrom=${dateFromUnix}&dateTo=${dateToUnix}`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`HTTP ${response.status}: ${errorData.error || 'Unknown error'}`);
          }

          const result = await response.json();
          console.log(`[CRON] ✅ ${store.name} (midday catchup): ${result.message}`);
          successCount++;

          await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (error: any) {
          errorCount++;
          console.error(`[CRON] ❌ ${store.name} (midday catchup): ${error.message}`);
        }
      }

      const duration = Math.round((Date.now() - startTime) / 1000);

      console.log('\n========================================');
      console.log(`[CRON] ✅ Midday review catchup completed`);
      console.log(`[CRON] Duration: ${duration}s`);
      console.log(`[CRON] Stores: ${successCount}/${stores.length} success, ${errorCount} errors`);
      console.log('========================================\n');

    } catch (error: any) {
      console.error('[CRON] ❌ Fatal error in midday review catchup:', error);
    } finally {
      runningJobs[jobName] = false;
    }
  }, {
    timezone: 'UTC'
  });

  job.start();
  console.log('[CRON] ✅ Midday review catchup job started successfully');

  return job;
}

/**
 * Chat status transition: in_progress → awaiting_reply after 2 days
 * Runs every 30 minutes. Moves chats where:
 *   - status = 'in_progress'
 *   - last_message_sender = 'seller'
 *   - last_message_date < NOW() - 2 days
 */
export function startChatStatusTransition() {
  const job = cron.schedule('*/30 * * * *', async () => {
    const jobName = 'chat-status-transition';

    if (runningJobs[jobName]) {
      return;
    }

    runningJobs[jobName] = true;

    try {
      const result = await dbHelpers.transitionStaleInProgressChats(2);

      if (result > 0) {
        console.log(`[CRON] 📋 Chat status transition: ${result} chats moved in_progress → awaiting_reply (>2 days)`);
      }
    } catch (error: any) {
      console.error('[CRON] ❌ Chat status transition error:', error.message);
    } finally {
      runningJobs[jobName] = false;
    }
  }, {
    timezone: 'UTC'
  });

  job.start();
  console.log('[CRON] ✅ Chat status transition job started (every 30 min)');

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
