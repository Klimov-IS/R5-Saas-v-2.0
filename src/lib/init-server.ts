/**
 * Server initialization
 * This file runs once when the Next.js server starts (via instrumentation.ts)
 *
 * Two separate flags:
 * - initialized: server startup completed (instrumentation.ts ran)
 * - cronJobsStarted: CRON schedulers are actually running
 *
 * In production:
 * 1. instrumentation.ts → initializeServer() → sets initialized=true, CRON stays off
 * 2. start-cron.js → POST /api/cron/trigger → initializeServer({ forceCron: true }) → starts CRON
 */

import { startDailyReviewSync, startAdaptiveDialogueSync, startDailyProductSync, startBackfillWorker, startGoogleSheetsSync, startClientDirectorySync, startAutoSequenceProcessor, startRollingReviewFullSync, startMiddayReviewCatchup, startChatStatusTransition, startOzonHourlyFullSync, startResolvedReviewCloser } from './cron-jobs';

let initialized = false;
let cronJobsStarted = false;

interface InitOptions {
  /** Force-start CRON jobs regardless of ENABLE_CRON_IN_MAIN_APP (used by /api/cron/trigger) */
  forceCron?: boolean;
}

export function initializeServer(options?: InitOptions) {
  const { forceCron = false } = options || {};

  // If already initialized AND (not forcing cron OR cron already running) — skip
  if (initialized && (!forceCron || cronJobsStarted)) {
    console.log('[INIT] ⏭️  Server already initialized' + (cronJobsStarted ? ' (CRON running)' : ' (CRON not running)'));
    return;
  }

  const startTime = Date.now();

  if (!initialized) {
    console.log('[INIT] 🚀 Initializing server at', new Date().toISOString());
    console.log('[INIT] Environment:', process.env.NODE_ENV || 'development');
    initialized = true;
  }

  // 🚨 CRITICAL FIX (2026-03-13): CRON jobs MUST run in separate process only!
  //
  // Problem: ecosystem.config.js runs main app with `instances: 2` (cluster mode)
  // → instrumentation.ts calls initializeServer() in EACH instance
  // → 2 main app instances + 1 wb-reputation-cron process = 3× duplicate sends!
  //
  // Solution:
  // - instrumentation.ts calls initializeServer() → CRON stays off
  // - start-cron.js calls /api/cron/trigger → initializeServer({ forceCron: true }) → starts CRON
  // - For local dev: set ENABLE_CRON_IN_MAIN_APP=true

  const enableCron = forceCron || process.env.ENABLE_CRON_IN_MAIN_APP === 'true';

  if (!enableCron) {
    console.log('[INIT] ⚠️  CRON jobs DISABLED in main app (waiting for /api/cron/trigger)');
    console.log('[INIT] 💡 To enable in main app (local dev only): set ENABLE_CRON_IN_MAIN_APP=true');
    return;
  }

  if (cronJobsStarted) {
    console.log('[INIT] ⏭️  CRON jobs already running, skipping');
    return;
  }

  try {
    const source = forceCron ? 'via /api/cron/trigger (dedicated process)' : 'IN MAIN APP (local dev)';
    console.log(`[INIT] 🚀 Starting CRON jobs ${source}`);

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

    cronJobsStarted = true;
    const duration = Date.now() - startTime;
    console.log(`[INIT] ✅ CRON jobs started successfully (${duration}ms)`);
  } catch (error) {
    console.error('[INIT] ❌ Failed to start CRON jobs:', error);
    console.error('[INIT] Stack:', error instanceof Error ? error.stack : 'No stack trace');
  }
}

/**
 * Server startup completed (instrumentation.ts ran)
 */
export function isInitialized(): boolean {
  return initialized;
}

/**
 * CRON schedulers are actually running
 */
export function isCronRunning(): boolean {
  return cronJobsStarted;
}
