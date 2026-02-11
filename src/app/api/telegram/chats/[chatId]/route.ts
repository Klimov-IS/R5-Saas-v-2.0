import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticateTgApiRequest } from '@/lib/telegram-auth';
import { query } from '@/db/client';

/**
 * GET /api/telegram/chats/[chatId]
 *
 * Returns chat detail + messages for Mini App.
 * Validates ownership via TG auth.
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

    // Get chat with ownership check
    const chatResult = await query(
      `SELECT c.*, s.name as store_name
       FROM chats c
       JOIN stores s ON c.store_id = s.id
       WHERE c.id = $1 AND c.owner_id = $2`,
      [chatId, auth.userId]
    );

    if (!chatResult.rows[0]) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    const chat = chatResult.rows[0];

    // Get last 20 messages
    const messagesResult = await query(
      `SELECT id, text, sender, timestamp, is_auto_reply
       FROM chat_messages
       WHERE chat_id = $1
       ORDER BY timestamp ASC
       LIMIT 20`,
      [chatId]
    );

    return NextResponse.json({
      chat: {
        id: chat.id,
        storeId: chat.store_id,
        storeName: chat.store_name,
        clientName: chat.client_name,
        productName: chat.product_name,
        status: chat.status,
        tag: chat.tag,
        draftReply: chat.draft_reply,
        completionReason: chat.completion_reason,
      },
      messages: messagesResult.rows.map((m: any) => ({
        id: m.id,
        text: m.text,
        sender: m.sender,
        timestamp: m.timestamp,
        isAutoReply: m.is_auto_reply,
      })),
    });
  } catch (error: any) {
    console.error('[TG-CHAT] Error:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
