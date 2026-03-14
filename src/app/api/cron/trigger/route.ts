/**
 * Manually trigger cron job initialization
 *
 * Called by scripts/start-cron.js (dedicated wb-reputation-cron process).
 * Uses forceCron: true to bypass ENABLE_CRON_IN_MAIN_APP check.
 *
 * POST — start CRON jobs (idempotent: safe to call multiple times)
 * GET  — health check: returns initialized + cronRunning status
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyApiKey } from '@/lib/server-utils';
import { initializeServer, isInitialized, isCronRunning } from '@/lib/init-server';

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyApiKey(request);
    if (!authResult.authorized) {
      return NextResponse.json({
        error: 'Unauthorized',
        message: 'Invalid or missing API key'
      }, { status: 401 });
    }

    console.log('[API CRON TRIGGER] 🔧 CRON trigger requested');

    if (isCronRunning()) {
      console.log('[API CRON TRIGGER] ⚠️  CRON jobs already running');
      return NextResponse.json({
        message: 'Cron jobs are already running',
        initialized: true,
        cronRunning: true,
        timestamp: new Date().toISOString()
      }, { status: 200 });
    }

    // Force CRON initialization regardless of ENABLE_CRON_IN_MAIN_APP
    console.log('[API CRON TRIGGER] 🚀 Starting CRON jobs (forceCron: true)...');
    initializeServer({ forceCron: true });

    const cronRunning = isCronRunning();
    console.log(`[API CRON TRIGGER] ${cronRunning ? '✅' : '❌'} CRON jobs ${cronRunning ? 'started' : 'failed to start'}`);

    return NextResponse.json({
      message: cronRunning ? 'Cron jobs started successfully' : 'Failed to start cron jobs',
      initialized: isInitialized(),
      cronRunning,
      timestamp: new Date().toISOString()
    }, { status: cronRunning ? 200 : 500 });

  } catch (error: any) {
    console.error('[API CRON TRIGGER] ❌ Error:', error);
    return NextResponse.json({
      error: 'Failed to initialize cron jobs',
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await verifyApiKey(request);
    if (!authResult.authorized) {
      return NextResponse.json({
        error: 'Unauthorized',
        message: 'Invalid or missing API key'
      }, { status: 401 });
    }

    const init = isInitialized();
    const cronRunning = isCronRunning();

    return NextResponse.json({
      initialized: init,
      cronRunning,
      message: cronRunning
        ? 'CRON jobs are running'
        : init
          ? 'Server initialized but CRON jobs NOT running'
          : 'Server NOT initialized',
      timestamp: new Date().toISOString()
    }, { status: 200 });

  } catch (error: any) {
    console.error('[API CRON TRIGGER] ❌ Error checking status:', error);
    return NextResponse.json({
      error: 'Failed to check cron status',
      details: error.message
    }, { status: 500 });
  }
}
