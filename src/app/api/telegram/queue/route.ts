import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticateTgApiRequest } from '@/lib/telegram-auth';
import { getUnifiedChatQueue, getUnifiedChatQueueCount } from '@/db/telegram-helpers';
import { getAccessibleStoreIds } from '@/db/auth-helpers';

/**
 * GET /api/telegram/queue
 *
 * Returns unified cross-store chat queue (chats where client replied, not closed).
 * Uses org-based access: shows chats for all stores accessible to the user.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateTgApiRequest(request);
    if (!auth.valid || !auth.userId) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const storeIds = await getAccessibleStoreIds(auth.userId);
    if (storeIds.length === 0) {
      return NextResponse.json({ data: [], totalCount: 0 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const [chats, totalCount] = await Promise.all([
      getUnifiedChatQueue(storeIds, limit, offset),
      getUnifiedChatQueueCount(storeIds),
    ]);

    return NextResponse.json({
      data: chats.map(c => ({
        id: c.id,
        storeId: c.store_id,
        storeName: c.store_name,
        clientName: c.client_name,
        productName: c.product_name,
        lastMessageText: c.last_message_text,
        lastMessageDate: c.last_message_date,
        hasDraft: !!c.draft_reply,
        draftPreview: c.draft_reply ? c.draft_reply.substring(0, 100) : null,
        status: c.status,
        tag: c.tag,
      })),
      totalCount,
    });
  } catch (error: any) {
    console.error('[TG-QUEUE] Error:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
