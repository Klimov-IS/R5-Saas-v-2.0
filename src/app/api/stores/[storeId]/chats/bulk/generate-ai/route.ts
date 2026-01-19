import { NextRequest, NextResponse } from 'next/server';
import { getChatsByStoreWithPagination, getChatById, getChatMessages, updateChat } from '@/db/helpers';
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

    // ⚠️ CRITICAL SAFETY: Require explicit chatIds array
    if (!chatIds || chatIds.length === 0) {
      return NextResponse.json(
        { error: 'chatIds array is required. Cannot generate for all chats without explicit selection.' },
        { status: 400 }
      );
    }

    const results = {
      total: chatIds.length,
      successful: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process each chat
    for (const chatId of chatIds) {
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
        const aiResult = await generateChatReply({
          context,
          storeId,
          ownerId: chat.owner_id,
          chatId,
        });

        // ✅ Save draft to database
        await updateChat(chatId, {
          draft_reply: aiResult.text,
          draft_reply_generated_at: new Date().toISOString(),
          draft_reply_edited: false,
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
