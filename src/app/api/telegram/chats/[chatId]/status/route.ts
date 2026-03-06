import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticateTgApiRequest } from '@/lib/telegram-auth';
import { getAccessibleStoreIds } from '@/db/auth-helpers';
import { changeStatus, InvalidStatusError } from '@/core/services/chat-status-service';
import { ChatNotFoundError } from '@/core/services/chat-service';

/**
 * PATCH /api/telegram/chats/[chatId]/status
 *
 * Change chat status and/or tag via TG Mini App.
 * Accepts: { status, completion_reason?, tag? }
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

    const { status, completion_reason, tag } = await request.json();
    const storeIds = await getAccessibleStoreIds(auth.userId);
    const result = await changeStatus(params.chatId, storeIds, status, completion_reason, tag, auth.userId);

    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof InvalidStatusError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof ChatNotFoundError) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }
    console.error('[TG-STATUS] Error:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
