/**
 * Manually trigger cron job initialization
 * Useful if instrumentation hook doesn't work in production
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyApiKey } from '@/lib/server-utils';
import { initializeServer, isInitialized } from '@/lib/init-server';

export async function POST(request: NextRequest) {
  try {
    // Verify API key
    const authResult = await verifyApiKey(request);
    if (!authResult.authorized) {
      return NextResponse.json({
        error: 'Unauthorized',
        message: 'Invalid or missing API key'
      }, { status: 401 });
    }

    console.log('[API CRON TRIGGER] 🔧 Manual cron initialization requested');

    // Check if already initialized
    if (isInitialized()) {
      console.log('[API CRON TRIGGER] ⚠️  Cron jobs already initialized');
      return NextResponse.json({
        message: 'Cron jobs are already initialized',
        initialized: true,
        timestamp: new Date().toISOString()
      }, { status: 200 });
    }

    // Initialize cron jobs
    console.log('[API CRON TRIGGER] 🚀 Initializing cron jobs...');
    initializeServer();

    console.log('[API CRON TRIGGER] ✅ Cron jobs initialized successfully');

    return NextResponse.json({
      message: 'Cron jobs initialized successfully',
      initialized: true,
      timestamp: new Date().toISOString()
    }, { status: 200 });

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
    // Verify API key
    const authResult = await verifyApiKey(request);
    if (!authResult.authorized) {
      return NextResponse.json({
        error: 'Unauthorized',
        message: 'Invalid or missing API key'
      }, { status: 401 });
    }

    const initialized = isInitialized();

    return NextResponse.json({
      initialized,
      message: initialized
        ? 'Cron jobs are initialized and running'
        : 'Cron jobs are NOT initialized',
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
