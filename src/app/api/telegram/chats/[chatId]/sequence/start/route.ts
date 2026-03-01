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
  TAG_SEQUENCE_CONFIG,
  getNextSlotTime,
} from '@/lib/auto-sequence-templates';

/**
 * POST /api/telegram/chats/[chatId]/sequence/start
 *
 * Manually start an auto-sequence for a chat.
 * Supports two modes:
 *   1. Default (no body.sequenceType) — 30-day base sequence (by rating: 4★ vs 1-3★)
 *   2. Tag-based (body.sequenceType) — short funnel follow-up (offer_reminder, agreement_followup, refund_followup)
 *
 * Skips buyer_messages_count check (manual = manager decision).
 * Still checks: no active sequence, no completed family sequence.
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
    const body = await request.json().catch(() => ({}));
    const requestedType = body.sequenceType as string | undefined;

    // Org-based access check
    const storeIds = await getAccessibleStoreIds(auth.userId);
    const chatResult = await query(
      'SELECT id, store_id, owner_id, tag FROM chats WHERE id = $1 AND store_id = ANY($2::text[])',
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

    let sequenceType: string;
    let templates;
    let familyPrefix: string;
    let chatTag: ChatTag;

    if (requestedType && TAG_SEQUENCE_CONFIG[requestedType]) {
      // Tag-based sequence: use config from TAG_SEQUENCE_CONFIG keyed by tag name
      const config = TAG_SEQUENCE_CONFIG[requestedType];
      sequenceType = config.sequenceType;
      templates = config.templates;
      familyPrefix = config.familyPrefix;
      chatTag = requestedType as ChatTag;
    } else if (requestedType && Object.values(TAG_SEQUENCE_CONFIG).some(c => c.sequenceType === requestedType)) {
      // Accept sequence type name directly (e.g., 'offer_reminder')
      const config = Object.values(TAG_SEQUENCE_CONFIG).find(c => c.sequenceType === requestedType)!;
      const tagName = Object.entries(TAG_SEQUENCE_CONFIG).find(([, c]) => c.sequenceType === requestedType)?.[0];
      sequenceType = config.sequenceType;
      templates = config.templates;
      familyPrefix = config.familyPrefix;
      chatTag = (tagName || chat.tag) as ChatTag;
    } else {
      // Default: 30-day base sequence by rating
      const rcl = await findLinkByChatId(chatId);
      const rating = rcl?.review_rating;

      if (rating === 4) {
        sequenceType = 'no_reply_followup_4star_30d';
        templates = DEFAULT_FOLLOWUP_TEMPLATES_4STAR_30D;
        familyPrefix = 'no_reply_followup_4star';
      } else {
        sequenceType = 'no_reply_followup_30d';
        templates = DEFAULT_FOLLOWUP_TEMPLATES_30D;
        familyPrefix = 'no_reply_followup';
      }
      chatTag = 'deletion_candidate' as ChatTag;
    }

    // Check family dedup (active/completed of same family)
    const hasFamily = await dbHelpers.hasCompletedSequenceFamily(chatId, familyPrefix);
    if (hasFamily) {
      return NextResponse.json(
        { error: 'Sequence of this type already exists (active or completed)' },
        { status: 409 }
      );
    }

    // Create sequence — Day 0 for base, Day 3 for funnel (first message starts at day 3)
    const firstDay = templates[0]?.day ?? 0;
    const nextSendAt = getNextSlotTime(firstDay === 0 ? 0 : firstDay);
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

    // Update chat status to awaiting_reply (sequence is sending messages)
    await dbHelpers.updateChat(chatId, {
      status: 'awaiting_reply' as ChatStatus,
      status_updated_at: new Date().toISOString(),
    });

    console.log(
      `[TG-SEQUENCE] Manual start: chat ${chatId}, type=${sequenceType}, ` +
      `${templates.length} msgs, tag=${chatTag}`
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
