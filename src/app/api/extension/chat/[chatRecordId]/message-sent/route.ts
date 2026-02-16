/**
 * POST /api/extension/chat/{chatRecordId}/message-sent
 *
 * Called by Chrome Extension after sending a starter message to the buyer.
 * Records message type (A=1-3 stars, B=4 stars), text, and status.
 *
 * Auth: Bearer token (user_settings.api_key)
 *
 * @version 1.0.0
 * @date 2026-02-16
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserByApiToken } from '@/db/extension-helpers';
import { findLinkById, updateReviewChatLink } from '@/db/review-chat-link-helpers';

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
    const { messageType, messageText, sentAt, status } = body;

    if (!sentAt || !status) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Missing required fields: sentAt, status' },
        { status: 400, headers: corsHeaders }
      );
    }

    const validStatuses = ['MESSAGE_SENT', 'MESSAGE_SKIPPED', 'MESSAGE_FAILED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Bad Request', message: `status must be one of: ${validStatuses.join(', ')}` },
        { status: 400, headers: corsHeaders }
      );
    }

    if (messageType && !['A', 'B', 'NONE'].includes(messageType)) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'messageType must be A, B, or NONE' },
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

    // 4. Map extension status to DB status
    const statusMap: Record<string, string> = {
      'MESSAGE_SENT': 'message_sent',
      'MESSAGE_SKIPPED': 'message_skipped',
      'MESSAGE_FAILED': 'message_failed',
    };

    // 5. Update the link
    const updatedLink = await updateReviewChatLink(chatRecordId, {
      status: statusMap[status],
      message_type: messageType || null,
      message_text: messageText || null,
      message_sent_at: sentAt,
    });

    console.log(
      `[Extension Chat API] Message ${status}: ` +
      `record=${chatRecordId} type=${messageType || 'none'}`
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Message status recorded',
      },
      { headers: corsHeaders }
    );

  } catch (error: any) {
    console.error('[Extension Chat API] Error in chat/message-sent:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
