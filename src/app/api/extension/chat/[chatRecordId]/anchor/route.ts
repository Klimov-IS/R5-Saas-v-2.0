/**
 * POST /api/extension/chat/{chatRecordId}/anchor
 *
 * Called by Chrome Extension after parsing the WB system message in the chat.
 * The system message contains product info that confirms the review↔chat link.
 *
 * Auth: Bearer token (user_settings.api_key)
 *
 * @version 1.0.0
 * @date 2026-02-16
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserByApiToken } from '@/db/extension-helpers';
import {
  findLinkById,
  updateReviewChatLink,
  matchReviewByContext,
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

export async function POST(
  request: NextRequest,
  { params }: { params: { chatRecordId: string } }
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

    // 2. Parse request body
    const body = await request.json();
    const { systemMessageText, parsedNmId, parsedProductTitle, anchorFoundAt, status } = body;

    if (!anchorFoundAt || !status) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Missing required fields: anchorFoundAt, status' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!['ANCHOR_FOUND', 'ANCHOR_NOT_FOUND'].includes(status)) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'status must be ANCHOR_FOUND or ANCHOR_NOT_FOUND' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 3. Find existing link record
    const { chatRecordId } = params;
    const link = await findLinkById(chatRecordId);

    if (!link) {
      return NextResponse.json(
        { error: 'Not Found', message: 'Chat record not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    // 4. Build update payload
    const newStatus = status === 'ANCHOR_FOUND' ? 'anchor_found' : 'anchor_not_found';

    const updatePayload: Record<string, any> = {
      status: newStatus,
      anchor_found_at: anchorFoundAt,
    };

    if (systemMessageText) {
      updatePayload.system_message_text = systemMessageText;
    }
    if (parsedNmId !== undefined) {
      updatePayload.parsed_nm_id = parsedNmId;
    }
    if (parsedProductTitle !== undefined) {
      updatePayload.parsed_product_title = parsedProductTitle;
    }

    // 5. If anchor found and review_id is still null, try to match again with parsed nmId
    let reviewChatLinked = !!link.review_id;
    if (status === 'ANCHOR_FOUND' && !link.review_id && parsedNmId) {
      try {
        const reviewId = await matchReviewByContext(
          link.store_id,
          parsedNmId,
          link.review_rating,
          link.review_date
        );
        if (reviewId) {
          updatePayload.review_id = reviewId;
          reviewChatLinked = true;
        }
      } catch (err) {
        console.warn('[Extension Chat API] Review re-match failed:', err);
      }
    }

    // 6. Update the link
    const updatedLink = await updateReviewChatLink(chatRecordId, updatePayload);

    console.log(
      `[Extension Chat API] Anchor ${status}: ` +
      `record=${chatRecordId} parsedNmId=${parsedNmId || 'none'} reviewLinked=${reviewChatLinked}`
    );

    return NextResponse.json(
      {
        success: true,
        reviewChatLinked,
        message: status === 'ANCHOR_FOUND'
          ? 'Review-chat association confirmed'
          : 'Anchor not found, link saved without confirmation',
      },
      { headers: corsHeaders }
    );

  } catch (error: any) {
    console.error('[Extension Chat API] Error in chat/anchor:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
