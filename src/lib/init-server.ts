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

  // 🚨 CRITICAL FIX (2026-03-13): CRON jobs MUST run in separate process only!
  //
  // Problem: ecosystem.config.js runs main app with `instances: 2` (cluster mode)
  // → instrumentation.ts calls initializeServer() in EACH instance
  // → 2 main app instances + 1 wb-reputation-cron process = 3× duplicate sends!
  //
  // Solution: ONLY run cron jobs if ENABLE_CRON_IN_MAIN_APP=true (for local dev)
  // Production uses dedicated wb-reputation-cron process (scripts/start-cron.js)

  const enableCronInMainApp = process.env.ENABLE_CRON_IN_MAIN_APP === 'true';

  if (!enableCronInMainApp) {
    console.log('[INIT] ⚠️  CRON jobs DISABLED in main app (use wb-reputation-cron process)');
    console.log('[INIT] 💡 To enable in main app (local dev only): set ENABLE_CRON_IN_MAIN_APP=true');
    initialized = true;
    return;
  }

  try {
    // Start cron jobs (only if explicitly enabled)
    console.log('[INIT] ⚠️  Starting cron jobs IN MAIN APP (should only happen in local dev!)');
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
