import { NextRequest, NextResponse } from 'next/server';
import { updateChat } from '@/db/helpers';
import type { ChatStatus, CompletionReason } from '@/db/helpers';

/**
 * PATCH /api/stores/[storeId]/chats/[chatId]/status
 * Update chat status for Kanban Board (with optional completion_reason)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { storeId: string; chatId: string } }
) {
  try {
    const { chatId } = params;
    const body = await request.json();
    const { status, completion_reason } = body;

    if (!status || typeof status !== 'string') {
      return NextResponse.json(
        { error: 'status is required and must be a string' },
        { status: 400 }
      );
    }

    const validStatuses: ChatStatus[] = ['inbox', 'in_progress', 'awaiting_reply', 'resolved', 'closed'];
    if (!validStatuses.includes(status as ChatStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate completion_reason if provided
    if (completion_reason) {
      const validReasons: CompletionReason[] = [
        'review_deleted', 'review_upgraded', 'no_reply', 'old_dialog',
        'not_our_issue', 'spam', 'negative', 'other'
      ];
      if (!validReasons.includes(completion_reason as CompletionReason)) {
        return NextResponse.json(
          { error: `Invalid completion_reason. Must be one of: ${validReasons.join(', ')}` },
          { status: 400 }
        );
      }
    }

    // If closing chat, require completion_reason
    if (status === 'closed' && !completion_reason) {
      return NextResponse.json(
        { error: 'completion_reason is required when closing chat' },
        { status: 400 }
      );
    }

    // Update chat with status and optionally completion_reason
    const updatedChat = await updateChat(chatId, {
      status: status as ChatStatus,
      status_updated_at: new Date().toISOString(),
      completion_reason: status === 'closed' ? (completion_reason as CompletionReason) : null,
    });

    if (!updatedChat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }

    console.log(`✅ [API] Chat ${chatId} status updated: ${status}${completion_reason ? ` (reason: ${completion_reason})` : ''}`);

    return NextResponse.json({
      data: {
        id: updatedChat.id,
        status: updatedChat.status,
        statusUpdatedAt: updatedChat.status_updated_at,
        completionReason: updatedChat.completion_reason,
      }
    }, { status: 200 });
  } catch (error: any) {
    console.error('[API ERROR] PATCH /api/stores/[storeId]/chats/[chatId]/status:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
