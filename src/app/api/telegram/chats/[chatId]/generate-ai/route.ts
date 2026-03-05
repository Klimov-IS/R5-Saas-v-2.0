import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticateTgApiRequest } from '@/lib/telegram-auth';
import { getAccessibleStoreIds } from '@/db/auth-helpers';
import { generateReply, ChatNotFoundError } from '@/core/services/chat-service';

/**
 * POST /api/telegram/chats/[chatId]/generate-ai
 *
 * Generate AI draft reply for a chat via TG Mini App.
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
    const result = await generateReply(params.chatId, auth.userId, storeIds);

    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof ChatNotFoundError) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }
    console.error('[TG-GENERATE] Error:', error.message);
    return NextResponse.json({ error: 'Failed to generate reply' }, { status: 500 });
  }
}
