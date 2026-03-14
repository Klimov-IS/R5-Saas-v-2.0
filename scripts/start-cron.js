/**
 * CRON process manager — triggers and monitors CRON jobs in the main Next.js app.
 *
 * Architecture:
 * - Main app (fork, 1 instance) does NOT start CRON at startup
 * - This script (fork, 1 instance) triggers CRON via POST /api/cron/trigger
 * - Every 5 minutes, healthCheck verifies CRON is still running
 * - If main app restarts (losing in-memory CRON state), healthCheck re-triggers
 * - After 3+ consecutive failures, sends Telegram alert to admin
 *
 * Run: node scripts/start-cron.js
 * PM2: managed by ecosystem.config.js
 */

require('dotenv').config({ path: '.env.production' });

const HEALTH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
let consecutiveFailures = 0;
const MAX_FAILURES_BEFORE_EXIT = 10;
const ALERT_EVERY_N_FAILURES = 3; // Send TG alert every 3 consecutive failures

console.log('[START-CRON] 🚀 CRON process manager starting...');
console.log('[START-CRON] 📅 Timestamp:', new Date().toISOString());
console.log('[START-CRON] 🔧 Environment:', {
  NODE_ENV: process.env.NODE_ENV,
  API_KEY: process.env.NEXT_PUBLIC_API_KEY ? '✅ Set' : '❌ Missing',
  BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
});

/**
 * Send alert to admin Telegram chat when critical failures occur.
 */
async function sendAdminAlert(text) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!botToken || !adminChatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: adminChatId, text, parse_mode: 'HTML' }),
    });
    console.log('[START-CRON] Admin alert sent to Telegram');
  } catch (err) {
    console.error('[START-CRON] Failed to send admin alert:', err.message);
  }
}

async function waitForServer(url, maxAttempts = 30, delayMs = 2000) {
  console.log(`[START-CRON] ⏳ Waiting for Next.js server at ${url}...`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok || response.status === 404) {
        console.log(`[START-CRON] ✅ Server is ready (attempt ${attempt}/${maxAttempts})`);
        return true;
      }
    } catch (error) {
      // Server not ready yet
    }

    if (attempt < maxAttempts) {
      console.log(`[START-CRON] ⏳ Waiting... (attempt ${attempt}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  throw new Error('Server did not become ready in time');
}

async function triggerCronJobs() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const apiKey = process.env.NEXT_PUBLIC_API_KEY;

  if (!apiKey) {
    throw new Error('NEXT_PUBLIC_API_KEY is not set');
  }

  const url = `${baseUrl}/api/cron/trigger`;
  console.log(`[START-CRON] 📡 POST ${url}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();
  console.log('[START-CRON] Response:', JSON.stringify(data));

  if (!response.ok && !data.cronRunning) {
    throw new Error(`Trigger failed: ${response.status} ${JSON.stringify(data)}`);
  }

  return data;
}

/**
 * Health check: GET /api/cron/trigger → check cronRunning.
 * If CRON died (e.g. main app restarted), re-trigger it.
 */
async function healthCheck() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const apiKey = process.env.NEXT_PUBLIC_API_KEY;

  try {
    const response = await fetch(`${baseUrl}/api/cron/trigger`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      throw new Error(`Health check HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.cronRunning) {
      consecutiveFailures = 0;
      console.log('[START-CRON] 💓 Health OK: CRON running |', new Date().toISOString());
    } else {
      console.log('[START-CRON] ⚠️  CRON not running! Re-triggering...');
      await triggerCronJobs();
      consecutiveFailures = 0;
      console.log('[START-CRON] ✅ CRON re-triggered successfully');
    }
  } catch (error) {
    consecutiveFailures++;
    console.error(`[START-CRON] ❌ Health check failed (${consecutiveFailures}/${MAX_FAILURES_BEFORE_EXIT}):`, error.message);

    if (consecutiveFailures >= ALERT_EVERY_N_FAILURES && consecutiveFailures % ALERT_EVERY_N_FAILURES === 0) {
      sendAdminAlert(
        `<b>R5 CRON Alert</b>\n\nHealth check failed <b>${consecutiveFailures}</b> times in a row!\nError: ${error.message}\n\nMax before exit: ${MAX_FAILURES_BEFORE_EXIT}`
      );
    }

    if (consecutiveFailures >= MAX_FAILURES_BEFORE_EXIT) {
      await sendAdminAlert(
        `<b>R5 CRON CRITICAL</b>\n\n${MAX_FAILURES_BEFORE_EXIT} consecutive failures — CRON manager exiting.\nPM2 will restart, but manual check recommended.`
      );
      console.error('[START-CRON] 💀 Too many consecutive failures, exiting (PM2 will restart)');
      process.exit(1);
    }
  }
}

async function start() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    await waitForServer(baseUrl);

    console.log('[START-CRON] ⏳ Waiting 3s for server to fully initialize...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    await triggerCronJobs();

    console.log('[START-CRON] ✅ CRON jobs triggered!');
    console.log(`[START-CRON] 🔄 Health check every ${HEALTH_CHECK_INTERVAL / 1000}s`);

    // Health check with auto-retrigger instead of empty heartbeat
    setInterval(healthCheck, HEALTH_CHECK_INTERVAL);

  } catch (error) {
    console.error('[START-CRON] ❌ Failed to start:', error);
    console.error('[START-CRON] Stack:', error.stack);
    process.exit(1);
  }
}

start();
