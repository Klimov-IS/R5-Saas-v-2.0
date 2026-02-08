/**
 * GET /api/extension/stores
 *
 * Returns list of stores accessible by the current API token
 * Cache is pre-warmed every 5 minutes by CRON job
 *
 * Rate limiting: 100 requests per minute per token
 * CORS enabled for Chrome Extension
 *
 * @version 2.1.0
 * @date 2026-02-08
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserByApiToken } from '@/db/extension-helpers';
import { getCachedStores, refreshCacheForUser, getCacheAge } from '@/lib/stores-cache';

// Simple in-memory rate limiter (100 req/min per token)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(token: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const limit = 100; // requests per minute
  const windowMs = 60 * 1000; // 1 minute

  const record = rateLimitMap.get(token);

  if (!record || now > record.resetAt) {
    // New window
    const resetAt = now + windowMs;
    rateLimitMap.set(token, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  // Existing window
  if (record.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }

  record.count++;
  return { allowed: true, remaining: limit - record.count, resetAt: record.resetAt };
}

// CORS headers for Chrome Extension
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Missing or invalid Authorization header' },
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.substring(7);

    // 2. Rate limiting
    const rateLimit = checkRateLimit(token);
    if (!rateLimit.allowed) {
      const resetDate = new Date(rateLimit.resetAt).toISOString();
      return NextResponse.json(
        {
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Maximum 100 requests per minute.',
          code: 'RATE_LIMIT_EXCEEDED',
          resetAt: resetDate,
        },
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': resetDate,
            'Retry-After': Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString(),
          },
        }
      );
    }

    // 3. Verify token and get user
    const user = await getUserByApiToken(token);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or expired token' },
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': rateLimit.remaining.toString(),
            'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
          }
        }
      );
    }

    // 4. Check cache first (pre-warmed by CRON every 5 min)
    let stores = getCachedStores(user.id);
    let cacheStatus = 'HIT';
    const cacheAge = getCacheAge(user.id);

    if (!stores) {
      // Cache miss - refresh for this user (fallback)
      console.log(`[Extension API] Cache MISS for user ${user.id}, refreshing...`);
      stores = await refreshCacheForUser(user.id);
      cacheStatus = 'MISS';
    } else {
      console.log(`[Extension API] Cache HIT for user ${user.id}: ${stores.length} stores (age: ${cacheAge}s)`);
    }

    return NextResponse.json(stores, {
      headers: {
        ...corsHeaders,
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
        'X-Cache': cacheStatus,
        'X-Cache-Age': cacheAge?.toString() || '0',
      }
    });

  } catch (error: any) {
    console.error('[Extension API] Error fetching stores:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
