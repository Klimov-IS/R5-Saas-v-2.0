/**
 * Manual cron job starter via HTTP
 *
 * This script triggers cron job initialization via the /api/cron/trigger endpoint.
 * It waits for Next.js server to be ready, then makes a POST request to initialize cron jobs.
 *
 * Run this with: node scripts/start-cron.js
 * Or add to PM2 ecosystem as a separate process.
 */

// Load environment variables
require('dotenv').config({ path: '.env.production' });

console.log('[START-CRON] 🚀 Starting manual cron job initialization...');
console.log('[START-CRON] 📅 Timestamp:', new Date().toISOString());
console.log('[START-CRON] 🔧 Environment loaded:', {
  NODE_ENV: process.env.NODE_ENV,
  API_KEY: process.env.NEXT_PUBLIC_API_KEY ? '✅ Set' : '❌ Missing',
  BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000',
});

// Wait for Next.js server to be ready
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

// Trigger cron initialization via API
async function triggerCronJobs() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const apiKey = process.env.NEXT_PUBLIC_API_KEY;

  if (!apiKey) {
    throw new Error('NEXT_PUBLIC_API_KEY is not set');
  }

  const url = `${baseUrl}/api/cron/trigger`;

  console.log(`[START-CRON] 📡 Triggering cron jobs at ${url}...`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to trigger cron jobs: ${response.status} ${text}`);
  }

  const data = await response.json();
  console.log('[START-CRON] ✅ Response:', data);

  return data;
}

// Main function
async function start() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    // Wait for Next.js server to be ready
    await waitForServer(baseUrl);

    // Give it a bit more time to fully initialize
    console.log('[START-CRON] ⏳ Waiting 3 more seconds for server to fully initialize...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Trigger cron jobs
    await triggerCronJobs();

    console.log('[START-CRON] ✅ Cron jobs initialized successfully!');
    console.log('[START-CRON] 🔄 Process will keep running for heartbeat monitoring...');

    // Keep process alive with heartbeat
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
