import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticateTgApiRequest } from '@/lib/telegram-auth';
import { query } from '@/db/client';
import { getAccessibleStoreIds } from '@/db/auth-helpers';

/**
 * GET /api/telegram/chats/[chatId]
 *
 * Returns chat detail + messages for Mini App.
 * Validates access via org-based store permissions.
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

    const { chatId } = params;
    const storeIds = await getAccessibleStoreIds(auth.userId);

    // Get chat with org-based access check
    const chatResult = await query(
      `SELECT c.*, s.name as store_name
       FROM chats c
       JOIN stores s ON c.store_id = s.id
       WHERE c.id = $1 AND c.store_id = ANY($2::text[])`,
      [chatId, storeIds]
    );

    if (!chatResult.rows[0]) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    const chat = chatResult.rows[0];

    // Get last 50 messages
    const messagesResult = await query(
      `SELECT id, text, sender, timestamp, is_auto_reply
       FROM chat_messages
       WHERE chat_id = $1
       ORDER BY timestamp ASC
       LIMIT 50`,
      [chatId]
    );

    const messages = messagesResult.rows.map((m: any) => ({
      id: m.id,
      text: m.text,
      sender: m.sender,
      timestamp: m.timestamp,
      isAutoReply: m.is_auto_reply,
    }));

    // Synthesize last seller message if not yet synced to chat_messages.
    // Covers the gap between TG mini-app send and the next sync cycle (up to 60 min for OZON).
    // Uses chats.last_message_text/sender/date which are updated immediately on send.
    if (
      chat.last_message_sender === 'seller' &&
      chat.last_message_text &&
      chat.last_message_date
    ) {
      const lastMsgDate = new Date(chat.last_message_date).getTime();
      const lastDbMsg = messages[messages.length - 1];
      const lastDbDate = lastDbMsg ? new Date(lastDbMsg.timestamp).getTime() : 0;
      // Add synthetic entry only if chat_messages doesn't yet have this message
      if (lastDbDate < lastMsgDate - 1000) {
        messages.push({
          id: `tg_sent_${chat.id}_${lastMsgDate}`,
          text: chat.last_message_text,
          sender: 'seller',
          timestamp: chat.last_message_date,
          isAutoReply: false,
        });
      }
    }

    return NextResponse.json({
      chat: {
        id: chat.id,
        storeId: chat.store_id,
        storeName: chat.store_name,
        marketplace: chat.marketplace,
        clientName: chat.client_name,
        productName: chat.product_name,
        status: chat.status,
        tag: chat.tag,
        draftReply: chat.draft_reply,
        completionReason: chat.completion_reason,
      },
      messages,
    });
  } catch (error: any) {
    console.error('[TG-CHAT] Error:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
