/**
 * Manual cron job starter
 *
 * This script manually initializes cron jobs if instrumentation hook doesn't work in production.
 * Run this with: node scripts/start-cron.js
 *
 * Or add to PM2 ecosystem as a separate process.
 */

console.log('[START-CRON] 🚀 Starting manual cron job initialization...');
console.log('[START-CRON] 📅 Timestamp:', new Date().toISOString());

// Load environment variables
require('dotenv').config({ path: '.env.production' });

console.log('[START-CRON] 🔧 Environment loaded:', {
  NODE_ENV: process.env.NODE_ENV,
  POSTGRES_HOST: process.env.POSTGRES_HOST ? '✅ Set' : '❌ Missing',
  NEXT_PUBLIC_API_KEY: process.env.NEXT_PUBLIC_API_KEY ? '✅ Set' : '❌ Missing',
});

// Import and initialize server
async function start() {
  try {
    console.log('[START-CRON] 📥 Importing init-server module...');

    // Use require instead of import for CommonJS compatibility
    const { initializeServer } = require('../src/lib/init-server.ts');

    console.log('[START-CRON] ▶️  Calling initializeServer()...');
    initializeServer();

    console.log('[START-CRON] ✅ Cron jobs started successfully!');
    console.log('[START-CRON] 🔄 Process will keep running to maintain cron schedules...');

    // Keep process alive
    setInterval(() => {
      console.log('[START-CRON] 💓 Heartbeat:', new Date().toISOString());
    }, 60000 * 5); // Every 5 minutes

  } catch (error) {
    console.error('[START-CRON] ❌ Failed to start cron jobs:', error);
    console.error('[START-CRON] 📋 Stack:', error.stack);
    process.exit(1);
  }
}

start();
