import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticateTgApiRequest } from '@/lib/telegram-auth';
import { getAccessibleStoreIds } from '@/db/auth-helpers';
import { getSequenceInfo } from '@/core/services/sequence-service';
import { ChatNotFoundError } from '@/core/services/chat-service';

/**
 * GET /api/telegram/chats/[chatId]/sequence
 *
 * Get auto-sequence status for a chat.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    const auth = await authenticateTgApiRequest(request);
    if (!auth.valid || !auth.userId) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const storeIds = await getAccessibleStoreIds(auth.userId);
    const result = await getSequenceInfo(params.chatId, storeIds);

    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof ChatNotFoundError) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }
    console.error('[TG-SEQUENCE] Error:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
