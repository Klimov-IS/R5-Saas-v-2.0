/**
 * Get status of cron jobs
 */

import { NextResponse } from 'next/server';
import { getJobsStatus } from '@/lib/cron-jobs';

export async function GET() {
  try {
    const status = getJobsStatus();
    return NextResponse.json({
      status,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json({
      error: 'Failed to get cron jobs status',
      details: error.message
    }, { status: 500 });
  }
}
