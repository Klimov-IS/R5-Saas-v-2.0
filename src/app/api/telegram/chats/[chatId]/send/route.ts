import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticateTgApiRequest } from '@/lib/telegram-auth';
import { query } from '@/db/client';
import * as dbHelpers from '@/db/helpers';
import { getAccessibleStoreIds } from '@/db/auth-helpers';

/**
 * POST /api/telegram/chats/[chatId]/send
 *
 * Send message to WB buyer via TG Mini App.
 * Proxy to WB Chat API with ownership validation.
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

    const { chatId } = params;
    const { message } = await request.json();

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Get chat with org-based access check
    const storeIds = await getAccessibleStoreIds(auth.userId);
    const chatResult = await query(
      `SELECT c.id, c.store_id, c.reply_sign, c.owner_id
       FROM chats c
       WHERE c.id = $1 AND c.store_id = ANY($2::text[])`,
      [chatId, storeIds]
    );

    if (!chatResult.rows[0]) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    const chat = chatResult.rows[0];

    // Get store's chat API token
    const store = await dbHelpers.getStoreById(chat.store_id);
    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const token = store.chat_api_token || store.api_token;
    if (!token) {
      return NextResponse.json({ error: 'Chat API token not configured' }, { status: 400 });
    }

    // Send to WB Chat API
    const formData = new FormData();
    formData.append('replySign', chat.reply_sign);
    formData.append('message', message.trim());

    const wbResponse = await fetch('https://buyer-chat-api.wildberries.ru/api/v1/seller/message', {
      method: 'POST',
      headers: { 'Authorization': token },
      body: formData,
    });

    if (!wbResponse.ok) {
      const errorText = await wbResponse.text();
      console.error(`[TG-SEND] WB API error: ${wbResponse.status} ${errorText}`);
      return NextResponse.json({ error: 'Failed to send message to WB' }, { status: 502 });
    }

    // Clear draft, update status, and mark as seller-replied (removes from queue)
    await dbHelpers.updateChat(chatId, {
      draft_reply: null,
      draft_reply_generated_at: null,
      draft_reply_edited: null,
      status: 'awaiting_reply',
      last_message_sender: 'seller',
      last_message_text: message.trim(),
      last_message_date: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[TG-SEND] Error:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
