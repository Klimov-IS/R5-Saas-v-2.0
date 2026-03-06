/**
 * Server initialization
 * This file runs once when the Next.js server starts (via instrumentation.ts)
 */

import { startDailyReviewSync, startAdaptiveDialogueSync, startDailyProductSync, startBackfillWorker, startGoogleSheetsSync, startClientDirectorySync, startAutoSequenceProcessor, startRollingReviewFullSync, startMiddayReviewCatchup, startChatStatusTransition, startOzonHourlyFullSync, startResolvedReviewCloser } from './cron-jobs';

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
    startAdaptiveDialogueSync(); // Adaptive dialogue sync (5min work / 15min morning-evening / 60min night)
    startDailyProductSync(); // Daily product sync (7:00 AM MSK)
    startBackfillWorker(); // Backfill worker (every 5 min)
    startGoogleSheetsSync(); // Google Sheets export (6:00 AM MSK daily)
    startClientDirectorySync(); // Client Directory export (7:30 AM MSK daily)
    startAutoSequenceProcessor(); // Auto-sequence follow-up messages (every 30 min)
    startRollingReviewFullSync(); // Rolling full review sync (3:00 MSK daily, 90-day chunks)
    startMiddayReviewCatchup(); // Midday review catchup (13:00 MSK daily, chunk 0 only)
    // startChatStatusTransition(); // DISABLED: auto-transition removed — sequences are now started manually from TG mini app
    startOzonHourlyFullSync();   // OZON hourly full scan — safety net for chats read in OZON dashboard (9:00-20:00 MSK)
    startResolvedReviewCloser(); // Auto-close chats with resolved reviews (every 30 min, :15/:45)

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
