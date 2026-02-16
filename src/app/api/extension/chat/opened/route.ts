/**
 * POST /api/extension/chat/opened
 *
 * Called by Chrome Extension when it opens a chat from the WB reviews page.
 * Creates a review_chat_link record associating the review context with the chat URL.
 *
 * Idempotent: same (storeId, reviewKey) returns existing record.
 *
 * Auth: Bearer token (user_settings.api_key)
 *
 * @version 1.0.0
 * @date 2026-02-16
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserByApiToken } from '@/db/extension-helpers';
import { query } from '@/db/client';
import {
  createReviewChatLink,
  matchReviewByContext,
  extractChatIdFromUrl,
} from '@/db/review-chat-link-helpers';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
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

    // 2. Parse and validate request body
    const body = await request.json();
    const { storeId, reviewContext, chatUrl, openedAt } = body;

    if (!storeId || !reviewContext || !chatUrl || !openedAt) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Missing required fields: storeId, reviewContext, chatUrl, openedAt' },
        { status: 400, headers: corsHeaders }
      );
    }

    const { nmId, rating, reviewDate, reviewKey } = reviewContext;
    if (!nmId || !rating || !reviewDate || !reviewKey) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Missing required reviewContext fields: nmId, rating, reviewDate, reviewKey' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 3. Verify store access
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

    // 4. Try to match review_id from our DB
    let reviewId: string | null = null;
    try {
      reviewId = await matchReviewByContext(storeId, nmId, rating, reviewDate);
    } catch (err) {
      // Non-fatal: link works without review_id
      console.warn('[Extension Chat API] Review match failed:', err);
    }

    // 5. Try to extract chat_id from URL
    const chatId = extractChatIdFromUrl(chatUrl);

    // 6. Create or return existing link (idempotent)
    const { link, created } = await createReviewChatLink({
      store_id: storeId,
      review_key: reviewKey,
      review_nm_id: nmId,
      review_rating: rating,
      review_date: reviewDate,
      chat_url: chatUrl,
      opened_at: openedAt,
      review_id: reviewId,
      chat_id: chatId,
    });

    console.log(
      `[Extension Chat API] Chat ${created ? 'created' : 'exists'}: ` +
      `store=${storeId} reviewKey=${reviewKey} reviewId=${reviewId || 'pending'} chatId=${chatId || 'pending'}`
    );

    return NextResponse.json(
      {
        success: true,
        chatRecordId: link.id,
        message: created ? 'Chat record created' : 'Chat record already exists',
        reviewMatched: !!reviewId,
      },
      { status: created ? 201 : 200, headers: corsHeaders }
    );

  } catch (error: any) {
    console.error('[Extension Chat API] Error in chat/opened:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
