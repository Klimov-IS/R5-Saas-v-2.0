import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticateTelegramRequest } from '@/lib/telegram-auth';
import { query } from '@/db/client';
import * as dbHelpers from '@/db/helpers';
import { generateChatReply } from '@/ai/flows/generate-chat-reply-flow';
import { buildStoreInstructions } from '@/lib/ai-context';

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
    const initData = request.headers.get('X-Telegram-Init-Data');
    if (!initData) return NextResponse.json({ error: 'Missing auth' }, { status: 401 });

    const auth = await authenticateTelegramRequest(initData);
    if (!auth.valid || !auth.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chatId } = params;

    // Get chat with ownership check
    const chatResult = await query(
      `SELECT c.*, s.name as store_name, s.ai_instructions
       FROM chats c
       JOIN stores s ON c.store_id = s.id
       WHERE c.id = $1 AND c.owner_id = $2`,
      [chatId, auth.userId]
    );

    if (!chatResult.rows[0]) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    const chat = chatResult.rows[0];

    // Get messages
    const messagesResult = await query(
      `SELECT text, sender, timestamp
       FROM chat_messages
       WHERE chat_id = $1
       ORDER BY timestamp ASC`,
      [chatId]
    );

    // Build context
    const storeInstructions = await buildStoreInstructions(chat.store_id, chat.product_nm_id);

    // Generate AI reply
    const result = await generateChatReply({
      chatId,
      storeId: chat.store_id,
      ownerId: auth.userId,
      clientName: chat.client_name || 'Клиент',
      productName: chat.product_name || null,
      messages: messagesResult.rows.map((m: any) => ({
        text: m.text,
        sender: m.sender,
        timestamp: m.timestamp,
      })),
      storeInstructions: storeInstructions || undefined,
    });

    // Save draft
    await dbHelpers.updateChat(chatId, {
      draft_reply: result.text,
      draft_reply_generated_at: new Date().toISOString(),
      draft_reply_edited: false,
    });

    return NextResponse.json({
      success: true,
      draftReply: result.text,
    });
  } catch (error: any) {
    console.error('[TG-GENERATE] Error:', error.message);
    return NextResponse.json({ error: 'Failed to generate reply' }, { status: 500 });
  }
}
