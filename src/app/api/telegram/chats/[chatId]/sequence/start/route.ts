import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticateTgApiRequest } from '@/lib/telegram-auth';
import { query } from '@/db/client';
import * as dbHelpers from '@/db/helpers';
import type { ChatTag, ChatStatus } from '@/db/helpers';
import { getAccessibleStoreIds } from '@/db/auth-helpers';
import { findLinkByChatId } from '@/db/review-chat-link-helpers';
import {
  DEFAULT_FOLLOWUP_TEMPLATES_30D,
  DEFAULT_FOLLOWUP_TEMPLATES_4STAR_30D,
  getNextSlotTime,
} from '@/lib/auto-sequence-templates';

/**
 * POST /api/telegram/chats/[chatId]/sequence/start
 *
 * Manually start a 30-day auto-sequence for a chat.
 * Skips buyer_messages_count check (manual = manager decision).
 * Still checks: no active/completed family sequence, rating known.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    const auth = await authenticateTgApiRequest(request);
    if (!auth.valid || !auth.userId) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const { chatId } = params;

    // Org-based access check
    const storeIds = await getAccessibleStoreIds(auth.userId);
    const chatResult = await query(
      'SELECT id, store_id, owner_id FROM chats WHERE id = $1 AND store_id = ANY($2::text[])',
      [chatId, storeIds]
    );

    if (!chatResult.rows[0]) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    const chat = chatResult.rows[0];

    // Check for existing active sequence
    const existing = await dbHelpers.getActiveSequenceForChat(chatId);
    if (existing) {
      return NextResponse.json(
        { error: 'Active sequence already exists', sequenceId: existing.id },
        { status: 409 }
      );
    }

    // Determine rating from RCL
    const rcl = await findLinkByChatId(chatId);
    const rating = rcl?.review_rating;

    // Determine sequence type and templates based on rating
    let sequenceType: string;
    let templates;

    if (rating === 4) {
      sequenceType = 'no_reply_followup_4star_30d';
      templates = DEFAULT_FOLLOWUP_TEMPLATES_4STAR_30D;
    } else {
      // Default to negative templates (1-3★ or unknown rating)
      sequenceType = 'no_reply_followup_30d';
      templates = DEFAULT_FOLLOWUP_TEMPLATES_30D;
    }

    // Check family dedup (active/completed of same family)
    const familyPrefix = rating === 4 ? 'no_reply_followup_4star' : 'no_reply_followup';
    const hasFamily = await dbHelpers.hasCompletedSequenceFamily(chatId, familyPrefix);
    if (hasFamily) {
      return NextResponse.json(
        { error: 'Sequence of this type already exists (active or completed)' },
        { status: 409 }
      );
    }

    // Create sequence with Day 0 = today
    const nextSendAt = getNextSlotTime(0);
    const seq = await query(
      `INSERT INTO chat_auto_sequences
        (chat_id, store_id, owner_id, sequence_type, messages, max_steps, next_send_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [chatId, chat.store_id, chat.owner_id, sequenceType, JSON.stringify(templates), templates.length, nextSendAt]
    );

    if (!seq.rows[0]) {
      return NextResponse.json({ error: 'Failed to create sequence' }, { status: 500 });
    }

    // Update chat tag and status
    await dbHelpers.updateChat(chatId, {
      tag: 'deletion_candidate' as ChatTag,
      status: 'awaiting_reply' as ChatStatus,
      status_updated_at: new Date().toISOString(),
    });

    console.log(
      `[TG-SEQUENCE] Manual start: chat ${chatId}, type=${sequenceType}, ` +
      `${templates.length} msgs, rating=${rating ?? 'unknown'}★`
    );

    return NextResponse.json({
      success: true,
      sequence: {
        id: seq.rows[0].id,
        sequenceType,
        maxSteps: templates.length,
        nextSendAt,
      },
    });
  } catch (error: any) {
    console.error('[TG-SEQUENCE-START] Error:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
