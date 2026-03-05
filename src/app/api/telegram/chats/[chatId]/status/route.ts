import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticateTgApiRequest } from '@/lib/telegram-auth';
import { query } from '@/db/client';
import * as dbHelpers from '@/db/helpers';
import type { ChatStatus, ChatTag, CompletionReason } from '@/db/helpers';
import { getAccessibleStoreIds } from '@/db/auth-helpers';
import { validateTransition } from '@/lib/chat-transitions';

const validStatuses: ChatStatus[] = ['inbox', 'in_progress', 'awaiting_reply', 'closed'];
const validReasons: CompletionReason[] = [
  'review_deleted', 'review_upgraded', 'review_resolved', 'refusal',
  'no_reply', 'old_dialog', 'not_our_issue', 'spam', 'negative', 'other',
  'temporarily_hidden',
];

/** Tags that managers can set manually from TG Mini App (deletion workflow progression) */
const manuallySettableTags: ChatTag[] = [
  'deletion_candidate', 'deletion_offered', 'deletion_agreed',
  'deletion_confirmed', 'refund_requested',
];

/**
 * PATCH /api/telegram/chats/[chatId]/status
 *
 * Change chat status and/or tag via TG Mini App.
 * Accepts: { status, completion_reason?, tag? }
 * - status is required
 * - completion_reason required when status = 'closed'
 * - tag is optional — updates deletion workflow stage
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    const auth = await authenticateTgApiRequest(request);
    if (!auth.valid || !auth.userId) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const { chatId } = params;
    const { status, completion_reason, tag } = await request.json();

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

    // Validate tag if provided
    if (tag && !manuallySettableTags.includes(tag)) {
      return NextResponse.json({ error: 'Invalid tag' }, { status: 400 });
    }

    // Org-based access check
    const storeIds = await getAccessibleStoreIds(auth.userId);
    const chatResult = await query(
      'SELECT id FROM chats WHERE id = $1 AND store_id = ANY($2::text[])',
      [chatId, storeIds]
    );

    if (!chatResult.rows[0]) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // Validate transition from current status
    const currentChat = await dbHelpers.getChatById(chatId);
    if (currentChat) {
      const transitionError = validateTransition(
        currentChat.status as ChatStatus,
        status as ChatStatus
      );
      if (transitionError) {
        console.warn(`[TG-STATUS] ${transitionError} for chat ${chatId}`);
      }
    }

    // Update status + optionally tag
    const updateData: Record<string, any> = {
      status,
      status_updated_at: new Date().toISOString(),
    };

    if (status === 'closed' && completion_reason) {
      updateData.completion_reason = completion_reason;
    }

    if (tag) {
      updateData.tag = tag;
      console.log(`[TG-STATUS] Tag changed: chat ${chatId}, ${currentChat?.tag} → ${tag}`);
    }

    await dbHelpers.updateChat(chatId, updateData);

    // Stop active sequence when tag changes (family mismatch)
    let sequenceStopped = false;
    if (tag && tag !== currentChat?.tag) {
      try {
        const activeSeq = await dbHelpers.getActiveSequenceForChat(chatId);
        if (activeSeq) {
          await dbHelpers.stopSequence(activeSeq.id, 'tag_changed');
          sequenceStopped = true;
          console.log(`[TG-STATUS] Sequence stopped: chat ${chatId}, tag ${currentChat?.tag}→${tag} (was ${activeSeq.sequence_type})`);
        }
      } catch (seqErr: any) {
        console.error(`[TG-STATUS] Failed to stop sequence on tag change:`, seqErr.message);
      }
    }

    // Stop active auto-sequence when closing or moving away from awaiting_reply
    if (!sequenceStopped && (status === 'closed' || (currentChat?.status === 'awaiting_reply' && status !== 'awaiting_reply'))) {
      try {
        const activeSeq = await dbHelpers.getActiveSequenceForChat(chatId);
        if (activeSeq) {
          const reason = status === 'closed' ? 'manual_close' : 'manual';
          await dbHelpers.stopSequence(activeSeq.id, reason);
          console.log(`[TG-STATUS] Auto-sequence stopped for chat ${chatId} (${reason})`);
        }
      } catch (seqError: any) {
        console.error(`[TG-STATUS] Failed to stop auto-sequence for chat ${chatId}:`, seqError.message);
      }
    }

    return NextResponse.json({ success: true, tag: tag || undefined, sequenceStopped });
  } catch (error: any) {
    console.error('[TG-STATUS] Error:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
