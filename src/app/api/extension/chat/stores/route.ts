/**
 * GET /api/extension/chat/stores
 *
 * Returns list of stores with chat workflow info for Chrome Extension.
 * Shows pendingChatsCount = reviews with rejected complaints & no linked chat.
 *
 * Auth: Bearer token (user_settings.api_key)
 * Rate limit: 100 req/min per token
 *
 * @version 1.0.0
 * @date 2026-02-16
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserByApiToken } from '@/db/extension-helpers';
import { query } from '@/db/client';
import { getPendingChatsCountOptimized } from '@/db/review-chat-link-helpers';

// Simple in-memory rate limiter (100 req/min per token)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(token: string): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const limit = 100;
  const windowMs = 60 * 1000;

  const record = rateLimitMap.get(token);

  if (!record || now > record.resetAt) {
    const resetAt = now + windowMs;
    rateLimitMap.set(token, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: record.resetAt };
  }

  record.count++;
  return { allowed: true, remaining: limit - record.count, resetAt: record.resetAt };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

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
      return NextResponse.json(
        { error: 'Too Many Requests', code: 'RATE_LIMIT_EXCEEDED' },
        { status: 429, headers: { ...corsHeaders, 'Retry-After': '30' } }
      );
    }

    // 3. Verify token and get user
    const user = await getUserByApiToken(token);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or expired token' },
        { status: 401, headers: corsHeaders }
      );
    }

    // 4. Get stores with chat-enabled products
    const storesResult = await query<{
      id: string;
      name: string;
      status: string;
    }>(
      `SELECT s.id, s.name, s.status
       FROM stores s
       WHERE s.owner_id = $1
         AND s.marketplace = 'wb'
       ORDER BY s.name ASC`,
      [user.id]
    );

    // 5. Check which stores have chat-enabled products and count pending chats
    const stores = await Promise.all(
      storesResult.rows.map(async (store) => {
        // Check if any product has work_in_chats = true
        const chatEnabledResult = await query<{ count: string }>(
          `SELECT COUNT(*) as count
           FROM product_rules pr
           JOIN products p ON pr.product_id = p.id
           WHERE p.store_id = $1
             AND pr.work_in_chats = TRUE
             AND p.marketplace = 'wb'`,
          [store.id]
        );
        const chatEnabled = parseInt(chatEnabledResult.rows[0]?.count || '0', 10) > 0;

        let pendingChatsCount = 0;
        if (chatEnabled && store.status === 'active') {
          pendingChatsCount = await getPendingChatsCountOptimized(store.id);
        }

        return {
          id: store.id,
          name: store.name,
          isActive: store.status === 'active',
          chatEnabled,
          pendingChatsCount,
        };
      })
    );

    return NextResponse.json(stores, {
      headers: {
        ...corsHeaders,
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
      },
    });

  } catch (error: any) {
    console.error('[Extension Chat API] Error fetching stores:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
