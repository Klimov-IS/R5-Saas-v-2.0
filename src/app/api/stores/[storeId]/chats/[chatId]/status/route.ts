import { NextRequest, NextResponse } from 'next/server';
import { updateChatWithAudit, getActiveSequenceForChat, stopSequence, getChatById } from '@/db/helpers';
import type { ChatStatus, CompletionReason } from '@/db/helpers';
import { validateTransition } from '@/lib/chat-transitions';
import { getSession } from '@/lib/auth';

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

    const validStatuses: ChatStatus[] = ['inbox', 'awaiting_reply', 'in_progress', 'closed'];
    if (!validStatuses.includes(status as ChatStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate completion_reason if provided
    if (completion_reason) {
      const validReasons: CompletionReason[] = [
        'review_deleted', 'review_upgraded', 'review_resolved', 'temporarily_hidden',
        'refusal', 'no_reply', 'old_dialog', 'not_our_issue', 'spam', 'negative', 'other'
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

    // Validate transition from current status
    const currentChat = await getChatById(chatId);
    if (currentChat) {
      const transitionError = validateTransition(
        currentChat.status as ChatStatus,
        status as ChatStatus
      );
      if (transitionError) {
        console.warn(`[API] ${transitionError} for chat ${chatId}`);
        // Allow the transition but log warning (soft enforcement)
      }
    }

    // Get userId from session for audit trail
    const session = getSession();
    const userId = session?.userId || null;

    // Update chat with status and optionally completion_reason
    const updatedChat = await updateChatWithAudit(
      chatId,
      {
        status: status as ChatStatus,
        status_updated_at: new Date().toISOString(),
        completion_reason: status === 'closed' ? (completion_reason as CompletionReason) : null,
      },
      { changedBy: userId, source: 'web_app' },
      currentChat || undefined
    );

    if (!updatedChat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }

    console.log(`[API] Chat ${chatId} status updated: ${status}${completion_reason ? ` (reason: ${completion_reason})` : ''}${userId ? ` by ${userId}` : ''}`);

    // Auto-sequence trigger removed: sequences are now started manually from TG mini app
    // via "Запустить рассылку" button → /api/telegram/chats/[chatId]/sequence/start

    // When moving away from 'awaiting_reply', stop active sequence
    if (status !== 'awaiting_reply') {
      try {
        const activeSeq = await getActiveSequenceForChat(chatId);
        if (activeSeq) {
          await stopSequence(activeSeq.id, 'manual');
          console.log(`[API] Auto-sequence stopped for chat ${chatId} (status changed to ${status})`);
        }
      } catch (seqError: any) {
        console.error(`[API] Failed to stop auto-sequence for chat ${chatId}:`, seqError.message);
      }
    }

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
