import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticateTelegramRequest } from '@/lib/telegram-auth';
import { query } from '@/db/client';
import * as dbHelpers from '@/db/helpers';
import type { ChatStatus, CompletionReason } from '@/db/helpers';

const validStatuses: ChatStatus[] = ['inbox', 'in_progress', 'awaiting_reply', 'closed'];
const validReasons: CompletionReason[] = [
  'review_deleted', 'review_upgraded', 'no_reply', 'old_dialog',
  'not_our_issue', 'spam', 'negative', 'other',
];

/**
 * PATCH /api/telegram/chats/[chatId]/status
 *
 * Change chat status via TG Mini App.
 * Requires completion_reason when status = 'closed'.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    const initData = request.headers.get('X-Telegram-Init-Data');
    if (!initData) return NextResponse.json({ error: 'Missing auth' }, { status: 401 });

    const auth = await authenticateTelegramRequest(initData);
    if (!auth.valid || !auth.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chatId } = params;
    const { status, completion_reason } = await request.json();

    // Validate status
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Require completion_reason for closed
    if (status === 'closed') {
      if (!completion_reason || !validReasons.includes(completion_reason)) {
        return NextResponse.json({ error: 'completion_reason is required for closed status' }, { status: 400 });
      }
    }

    // Ownership check
    const chatResult = await query(
      'SELECT id FROM chats WHERE id = $1 AND owner_id = $2',
      [chatId, auth.userId]
    );

    if (!chatResult.rows[0]) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // Update status
    const updateData: Record<string, any> = {
      status,
      status_updated_at: new Date().toISOString(),
    };

    if (status === 'closed' && completion_reason) {
      updateData.completion_reason = completion_reason;
    }

    await dbHelpers.updateChat(chatId, updateData);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[TG-STATUS] Error:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
