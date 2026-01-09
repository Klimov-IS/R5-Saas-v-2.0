/**
 * Server initialization
 * This file runs once when the Next.js server starts
 */

import { startDailyReviewSync } from './cron-jobs';

let initialized = false;

export function initializeServer() {
  if (initialized) {
    console.log('[INIT] Server already initialized, skipping...');
    return;
  }

  console.log('[INIT] 🚀 Initializing server...');

  try {
    // Start cron jobs
    startDailyReviewSync();

    initialized = true;
    console.log('[INIT] ✅ Server initialized successfully');
  } catch (error) {
    console.error('[INIT] ❌ Failed to initialize server:', error);
    throw error;
  }
}
