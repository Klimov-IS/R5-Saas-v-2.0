import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticateTelegramRequest } from '@/lib/telegram-auth';
import { getUnifiedChatQueue, getUnifiedChatQueueCount } from '@/db/telegram-helpers';

/**
 * GET /api/telegram/queue
 *
 * Returns unified cross-store chat queue (chats where client replied, not closed).
 * Auth: X-Telegram-Init-Data header
 */
export async function GET(request: NextRequest) {
  try {
    const initData = request.headers.get('X-Telegram-Init-Data');
    if (!initData) {
      return NextResponse.json({ error: 'Missing auth' }, { status: 401 });
    }

    const auth = await authenticateTelegramRequest(initData);
    if (!auth.valid || !auth.userId) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const [chats, totalCount] = await Promise.all([
      getUnifiedChatQueue(auth.userId, limit, offset),
      getUnifiedChatQueueCount(auth.userId),
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
