/**
 * Health Check Endpoint
 *
 * Returns server health status including:
 * - Database connectivity
 * - Cron jobs status
 * - API rate limiter
 * - System uptime
 *
 * No authentication required - use for monitoring/Docker health checks
 */

import { NextResponse } from 'next/server';
import { getJobsStatus } from '@/lib/cron-jobs';
import { isInitialized } from '@/lib/init-server';
import { query } from '@/db/client';
import { rateLimiter } from '@/lib/rate-limiter';

const startTime = Date.now();

interface ServiceStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  details?: any;
}

export async function GET() {
  const timestamp = new Date().toISOString();
  const uptime = Math.floor((Date.now() - startTime) / 1000); // seconds

  // Check individual services
  const services: Record<string, ServiceStatus> = {};

  // 1. Database connectivity check
  try {
    const dbStart = Date.now();
    const dbResult = await query('SELECT NOW() as current_time, version() as pg_version');
    const dbLatency = Date.now() - dbStart;

    services.database = {
      status: dbLatency < 1000 ? 'healthy' : 'degraded',
      message: dbLatency < 1000 ? 'Connected' : 'Slow response',
      details: {
        latency_ms: dbLatency,
        server_time: dbResult.rows[0]?.current_time,
        postgres_version: dbResult.rows[0]?.pg_version?.split(' ')[0], // Short version
      },
    };
  } catch (error: any) {
    services.database = {
      status: 'unhealthy',
      message: error.message || 'Connection failed',
    };
  }

  // 2. Cron jobs status
  try {
    const cronStatus = getJobsStatus();
    services.cronJobs = {
      status: isInitialized() ? 'healthy' : 'degraded',
      message: isInitialized() ? 'Running' : 'Not initialized',
      details: {
        totalJobs: cronStatus.totalJobs,
        runningJobs: cronStatus.runningJobs,
        jobs: cronStatus.allJobs,
      },
    };
  } catch (error: any) {
    services.cronJobs = {
      status: 'unhealthy',
      message: error.message || 'Failed to get status',
    };
  }

  // 3. Rate limiter check (simple health check)
  try {
    const testKey = '__health_check__';
    const rateLimitCheck = rateLimiter.check(testKey);
    rateLimiter.reset(testKey); // Clean up test key

    services.rateLimiter = {
      status: 'healthy',
      message: 'Operational',
      details: {
        maxRequestsPerMinute: 100,
        testCheck: rateLimitCheck.allowed ? 'passed' : 'failed',
      },
    };
  } catch (error: any) {
    services.rateLimiter = {
      status: 'unhealthy',
      message: error.message || 'Failed',
    };
  }

  // Determine overall status
  const statuses = Object.values(services).map((s) => s.status);
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy';

  if (statuses.every((s) => s === 'healthy')) {
    overallStatus = 'healthy';
  } else if (statuses.some((s) => s === 'unhealthy')) {
    overallStatus = 'unhealthy';
  } else {
    overallStatus = 'degraded';
  }

  // Determine HTTP status code
  const httpStatus = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp,
      uptime_seconds: uptime,
      uptime_human: formatUptime(uptime),
      version: '2.0.0',
      environment: process.env.NODE_ENV || 'unknown',
      services,
    },
    { status: httpStatus }
  );
}

/**
 * Format uptime in human-readable format
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}
