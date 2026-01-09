/**
 * Initialize cron jobs
 * This endpoint should be called once when the server starts
 * or can be called manually to restart cron jobs
 */

import { NextResponse } from 'next/server';
import { initializeServer } from '@/lib/init-server';

export async function GET() {
  try {
    initializeServer();
    return NextResponse.json({
      message: 'Cron jobs initialized successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json({
      error: 'Failed to initialize cron jobs',
      details: error.message
    }, { status: 500 });
  }
}
