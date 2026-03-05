import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticateTgApiRequest } from '@/lib/telegram-auth';
import { getAccessibleStoreIds } from '@/db/auth-helpers';
import { sendMessage, ChatNotFoundError, OzonChatNotStartedError } from '@/core/services/chat-service';

/**
 * POST /api/telegram/chats/[chatId]/send
 *
 * Send message to buyer via TG Mini App.
 * Dispatches to WB Chat API or OZON Chat API based on store marketplace.
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

    const { message } = await request.json();
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const storeIds = await getAccessibleStoreIds(auth.userId);
    const result = await sendMessage(params.chatId, message, storeIds);

    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof ChatNotFoundError) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }
    if (error instanceof OzonChatNotStartedError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error('[TG-SEND] Error:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
