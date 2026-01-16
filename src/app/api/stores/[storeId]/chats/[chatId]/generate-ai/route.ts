import { NextRequest, NextResponse } from 'next/server';
import { getChatById, getChatMessages, getStoreById } from '@/db/helpers';
import { generateChatReply } from '@/ai/flows/generate-chat-reply-flow';

/**
 * POST /api/stores/[storeId]/chats/[chatId]/generate-ai
 * Generate AI response for a chat
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { storeId: string; chatId: string } }
) {
  try {
    const { storeId, chatId } = params;

    // Get store to retrieve owner_id
    const store = await getStoreById(storeId);
    if (!store) {
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 404 }
      );
    }

    const ownerId = store.owner_id;
    console.log(`[GENERATE-AI] Store: ${store.name}, owner_id: ${ownerId}`);

    // Get chat data
    const chat = await getChatById(chatId);

    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }

    // Get chat messages (history)
    const messages = await getChatMessages(chatId);

    // Build context for AI
    const chatHistory = messages
      .map((msg) => `[${msg.sender === 'client' ? 'Клиент' : 'Продавец'}]: ${msg.text}`)
      .join('\n');

    const context = `
**Информация о магазине:**
Store ID: ${storeId}

**Товар:**
Название: ${chat.product_name || 'Неизвестно'}
Артикул WB: ${chat.product_nm_id}
Вендор код: ${chat.product_vendor_code || 'Неизвестно'}

**Клиент:**
Имя: ${chat.client_name}

**История переписки:**
${chatHistory}
    `.trim();

    // Generate AI reply
    const result = await generateChatReply({
      context,
      storeId,
      ownerId,
      chatId,
    });

    return NextResponse.json({
      success: true,
      text: result.text,
    }, { status: 200 });

  } catch (error: any) {
    console.error('[API ERROR] POST /api/stores/[storeId]/chats/[chatId]/generate-ai:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
