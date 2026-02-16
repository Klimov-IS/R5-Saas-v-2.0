/**
 * POST /api/extension/chat/{chatRecordId}/error
 *
 * Called by Chrome Extension when an error occurs at any stage of the chat workflow.
 * Records error code, message, and stage for diagnostics.
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
    const { errorCode, errorMessage, stage, occurredAt } = body;

    if (!errorCode || !errorMessage || !stage || !occurredAt) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Missing required fields: errorCode, errorMessage, stage, occurredAt' },
        { status: 400, headers: corsHeaders }
      );
    }

    const validStages = ['chat_open', 'anchor_parsing', 'message_send'];
    if (!validStages.includes(stage)) {
      return NextResponse.json(
        { error: 'Bad Request', message: `stage must be one of: ${validStages.join(', ')}` },
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

    // 4. Update the link with error info
    await updateReviewChatLink(chatRecordId, {
      status: 'error',
      error_code: errorCode,
      error_message: errorMessage,
      error_stage: stage,
    });

    console.error(
      `[Extension Chat API] Error reported: ` +
      `record=${chatRecordId} code=${errorCode} stage=${stage} message=${errorMessage}`
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Error recorded',
      },
      { headers: corsHeaders }
    );

  } catch (error: any) {
    console.error('[Extension Chat API] Error in chat/error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
