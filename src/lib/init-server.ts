/**
 * Server initialization
 * This file runs once when the Next.js server starts (via instrumentation.ts)
 */

import { startDailyReviewSync, startAdaptiveDialogueSync, startDailyProductSync, startBackfillWorker } from './cron-jobs';

let initialized = false;

export function initializeServer() {
  if (initialized) {
    console.log('[INIT] ⏭️  Server already initialized, skipping...');
    return;
  }

  const startTime = Date.now();
  console.log('[INIT] 🚀 Initializing server at', new Date().toISOString());
  console.log('[INIT] Environment:', process.env.NODE_ENV || 'development');

  try {
    // Start cron jobs
    console.log('[INIT] Starting cron jobs...');
    startDailyReviewSync(); // Hourly review sync + auto-complaint generation
    startAdaptiveDialogueSync(); // Adaptive dialogue sync (15min day / 60min night)
    startDailyProductSync(); // Daily product sync (7:00 AM MSK)
    startBackfillWorker(); // Backfill worker (every 5 min)

    initialized = true;
    const duration = Date.now() - startTime;
    console.log(`[INIT] ✅ Server initialized successfully (${duration}ms)`);
  } catch (error) {
    console.error('[INIT] ❌ Failed to initialize server:', error);
    console.error('[INIT] Stack:', error instanceof Error ? error.stack : 'No stack trace');
    // Don't throw - let server start even if cron fails
    // throw error;
  }
}

/**
 * Get initialization status
 */
export function isInitialized(): boolean {
  return initialized;
}
