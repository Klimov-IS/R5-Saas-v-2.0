/**
 * Get detailed status of cron jobs
 * Requires API authentication
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getJobsStatus } from '@/lib/cron-jobs';
import { isInitialized } from '@/lib/init-server';
import { verifyApiKey } from '@/lib/server-utils';

export async function GET(request: NextRequest) {
  try {
    // Verify API key
    const authResult = await verifyApiKey(request);
    if (!authResult.valid) {
      return NextResponse.json({
        error: 'Unauthorized',
        message: 'Invalid or missing API key'
      }, { status: 401 });
    }

    const cronStatus = getJobsStatus();
    const initialized = isInitialized();

    return NextResponse.json({
      initialized,
      environment: process.env.NODE_ENV || 'development',
      cronJobs: {
        totalJobs: cronStatus.totalJobs,
        runningJobs: cronStatus.runningJobs,
        jobs: cronStatus.allJobs.map(job => ({
          name: job.name,
          running: job.running,
          // Note: schedule and next run time would require cron library access
          // This is a simplified version
        }))
      },
      timestamp: new Date().toISOString()
    }, { status: 200 });
  } catch (error: any) {
    console.error('[CRON STATUS] Error:', error);
    return NextResponse.json({
      error: 'Failed to get cron jobs status',
      details: error.message
    }, { status: 500 });
  }
}
