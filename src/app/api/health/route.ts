/**
 * Health Check Endpoint
 *
 * Returns server health status including cron jobs
 * No authentication required - use for monitoring/Docker health checks
 */

import { NextResponse } from 'next/server';
import { getJobsStatus } from '@/lib/cron-jobs';
import { isInitialized } from '@/lib/init-server';

const startTime = Date.now();

export async function GET() {
  try {
    const uptime = Math.floor((Date.now() - startTime) / 1000); // seconds
    const cronStatus = getJobsStatus();

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime,
      services: {
        cronJobs: {
          initialized: isInitialized(),
          totalJobs: cronStatus.totalJobs,
          runningJobs: cronStatus.runningJobs,
          details: cronStatus.allJobs
        }
      }
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
