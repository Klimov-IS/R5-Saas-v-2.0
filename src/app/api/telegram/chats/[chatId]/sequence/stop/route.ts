import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticateTgApiRequest } from '@/lib/telegram-auth';
import { getAccessibleStoreIds } from '@/db/auth-helpers';
import { stopSequence, SequenceNotFoundError } from '@/core/services/sequence-service';
import { ChatNotFoundError } from '@/core/services/chat-service';

/**
 * POST /api/telegram/chats/[chatId]/sequence/stop
 *
 * Manually stop an active auto-sequence for a chat.
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

    const storeIds = await getAccessibleStoreIds(auth.userId);
    const result = await stopSequence(params.chatId, storeIds);

    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof ChatNotFoundError) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }
    if (error instanceof SequenceNotFoundError) {
      return NextResponse.json({ error: 'No active sequence found' }, { status: 404 });
    }
    console.error('[TG-SEQUENCE-STOP] Error:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
