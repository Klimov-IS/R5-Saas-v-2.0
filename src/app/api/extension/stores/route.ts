/**
 * GET /api/extension/stores
 *
 * Returns list of stores accessible by the current API token
 * Includes isActive field based on store status
 *
 * Rate limiting: 100 requests per minute per token
 * CORS enabled for Chrome Extension
 *
 * @version 2.0.0
 * @date 2026-01-28
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db/client';
import { getUserByApiToken } from '@/db/extension-helpers';

interface Store {
  id: string;
  name: string;
  owner_id: string;
  status: string;
  draft_complaints_count: string;
}

// Simple in-memory rate limiter (100 req/min per token)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

// Cache for stores response (1 hour TTL)
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
interface CacheEntry {
  data: any[];
  cachedAt: number;
}
const storesCache = new Map<string, CacheEntry>();

function getCachedStores(userId: string): any[] | null {
  const entry = storesCache.get(userId);
  if (!entry) return null;

  const now = Date.now();
  if (now - entry.cachedAt > CACHE_TTL_MS) {
    storesCache.delete(userId);
    return null;
  }

  return entry.data;
}

function setCachedStores(userId: string, data: any[]): void {
  storesCache.set(userId, { data, cachedAt: Date.now() });
}

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

    // 4. Check cache first
    const cachedStores = getCachedStores(user.id);
    if (cachedStores) {
      console.log(`[Extension API] Cache HIT for user ${user.id}: ${cachedStores.length} stores`);
      return NextResponse.json(cachedStores, {
        headers: {
          ...corsHeaders,
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': rateLimit.remaining.toString(),
          'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
          'X-Cache': 'HIT',
        }
      });
    }

    // 5. Get all stores for this user with draft complaints count (only for active products)
    const result = await query<Store>(
      `
      SELECT
        s.id,
        s.name,
        s.owner_id,
        s.status,
        COALESCE(
          (SELECT COUNT(*)
           FROM reviews r
           JOIN review_complaints rc ON r.id = rc.review_id
           JOIN products p ON r.product_id = p.id
           WHERE r.store_id = s.id
             AND rc.status = 'draft'
             AND p.work_status = 'active'
          ), 0
        )::text as draft_complaints_count
      FROM stores s
      WHERE s.owner_id = $1
      ORDER BY s.name ASC
      `,
      [user.id]
    );

    console.log(`[Extension API] Cache MISS for user ${user.id}: ${result.rows.length} stores (queried DB)`);

    // 6. Format response with isActive field and draft complaints count
    const stores = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      isActive: row.status === 'active', // true if status = 'active', false otherwise
      draftComplaintsCount: parseInt(row.draft_complaints_count) || 0,
    }));

    // 7. Cache the result
    setCachedStores(user.id, stores);

    return NextResponse.json(stores, {
      headers: {
        ...corsHeaders,
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
        'X-Cache': 'MISS',
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
