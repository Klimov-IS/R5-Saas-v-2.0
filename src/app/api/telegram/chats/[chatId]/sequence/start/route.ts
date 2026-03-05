import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticateTgApiRequest } from '@/lib/telegram-auth';
import { getAccessibleStoreIds } from '@/db/auth-helpers';
import { startSequence, SequenceConflictError, SequenceReviewResolvedError } from '@/core/services/sequence-service';
import { ChatNotFoundError } from '@/core/services/chat-service';

/**
 * POST /api/telegram/chats/[chatId]/sequence/start
 *
 * Manually start an auto-sequence for a chat.
 * Sends the first message immediately, then schedules the rest via cron.
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

    const body = await request.json().catch(() => ({}));
    const storeIds = await getAccessibleStoreIds(auth.userId);
    const result = await startSequence(params.chatId, storeIds, body.sequenceType);

    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof ChatNotFoundError) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }
    if (error instanceof SequenceConflictError) {
      return NextResponse.json(
        {
          error: error.conflictType === 'active'
            ? 'Active sequence already exists'
            : 'Sequence of this type already exists (active or completed)',
          sequenceId: error.existingId || undefined,
        },
        { status: 409 }
      );
    }
    if (error instanceof SequenceReviewResolvedError) {
      return NextResponse.json(
        { error: `Review is resolved (${error.reason}), cannot start sequence` },
        { status: 400 }
      );
    }
    console.error('[TG-SEQUENCE-START] Error:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
