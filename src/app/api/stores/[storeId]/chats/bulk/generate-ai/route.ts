import { NextRequest, NextResponse } from 'next/server';
import { getChatsByStoreWithPagination, getChatById, getChatMessages } from '@/db/helpers';
import { generateChatReply } from '@/ai/flows/generate-chat-reply-flow';

/**
 * POST /api/stores/[storeId]/chats/bulk/generate-ai
 * Bulk generate AI responses for multiple chats
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { storeId: string } }
) {
  try {
    const { storeId } = params;
    const body = await request.json();
    const { chatIds } = body;

    // If chatIds is empty or ['all'], process all chats
    const shouldProcessAll = !chatIds || chatIds.length === 0 || chatIds[0] === 'all';

    let targetChatIds: string[];

    if (shouldProcessAll) {
      // Get all chats for the store
      const allChats = await getChatsByStoreWithPagination(storeId, {
        limit: 1000, // Reasonable limit for bulk operations
        offset: 0,
      });
      targetChatIds = allChats.map((chat) => chat.id);
    } else {
      targetChatIds = chatIds;
    }

    const results = {
      total: targetChatIds.length,
      successful: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process each chat
    for (const chatId of targetChatIds) {
      try {
        // Get chat data
        const chat = await getChatById(chatId);

        if (!chat) {
          results.failed++;
          results.errors.push(`Chat ${chatId} not found`);
          continue;
        }

        // Get chat messages
        const messages = await getChatMessages(chatId);

        // Build context
        const chatHistory = messages
          .map((msg) => `[${msg.sender === 'client' ? 'Клиент' : 'Продавец'}]: ${msg.text}`)
          .join('\n');

        const context = `
**Информация о магазине:**
Store ID: ${storeId}

**Товар:**
Название: ${chat.product_name || 'Неизвестно'}
Артикул WB: ${chat.product_nm_id}

**Клиент:**
Имя: ${chat.client_name}

**История переписки:**
${chatHistory}
        `.trim();

        // Generate AI reply
        await generateChatReply({
          context,
          storeId,
          ownerId: 'default',
          chatId,
        });

        results.successful++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`Chat ${chatId}: ${error.message}`);
        console.error(`Failed to generate AI for chat ${chatId}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      results,
    }, { status: 200 });

  } catch (error: any) {
    console.error('[API ERROR] POST /api/stores/[storeId]/chats/bulk/generate-ai:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
