/**
 * GET /api/extension/chat/stores/{storeId}/rules
 *
 * Returns chat workflow rules for a specific store.
 * Extension uses these to decide which reviews to open chats for.
 *
 * Auth: Bearer token (user_settings.api_key)
 *
 * @version 1.0.0
 * @date 2026-02-16
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserByApiToken } from '@/db/extension-helpers';
import { query } from '@/db/client';
import { getChatRulesForStore } from '@/db/review-chat-link-helpers';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { storeId: string } }
) {
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
    const user = await getUserByApiToken(token);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or expired token' },
        { status: 401, headers: corsHeaders }
      );
    }

    // 2. Verify store access
    const { storeId } = params;
    const storeCheck = await query<{ owner_id: string }>(
      'SELECT owner_id FROM stores WHERE id = $1',
      [storeId]
    );

    if (!storeCheck.rows[0]) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Store not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    if (storeCheck.rows[0].owner_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'No access to this store' },
        { status: 403, headers: corsHeaders }
      );
    }

    // 3. Get chat rules for store
    const items = await getChatRulesForStore(storeId);

    return NextResponse.json(
      {
        storeId,
        globalLimits: {
          maxChatsPerRun: 50,
          cooldownBetweenChatsMs: 3000,
        },
        items,
      },
      { headers: corsHeaders }
    );

  } catch (error: any) {
    console.error('[Extension Chat API] Error fetching rules:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
