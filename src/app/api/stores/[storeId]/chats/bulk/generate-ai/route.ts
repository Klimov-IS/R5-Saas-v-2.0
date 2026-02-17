import { NextRequest, NextResponse } from 'next/server';
import { getChatsByStoreWithPagination, getChatById, getChatMessages, getStoreById, getProductRulesByNmId, updateChat } from '@/db/helpers';
import { generateChatReply } from '@/ai/flows/generate-chat-reply-flow';
import { buildStoreInstructions, detectConversationPhase } from '@/lib/ai-context';

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

    // Get store for AI instructions
    const store = await getStoreById(storeId);

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

        // Load product rules for enriched context
        let productRulesContext = '';
        if (chat.product_nm_id) {
          const rules = await getProductRulesByNmId(storeId, chat.product_nm_id);
          if (rules) {
            productRulesContext = `\n**Правила товара:**\nРабота в чатах: ${rules.work_in_chats ? 'включена' : 'отключена'}`;
            if (rules.offer_compensation) {
              productRulesContext += `\nКомпенсация: до ${rules.max_compensation || '?'}₽ (${rules.compensation_type || 'не указан тип'})`;
            } else {
              productRulesContext += `\nКомпенсация: не предлагать`;
            }
            if (rules.chat_strategy) {
              productRulesContext += `\nСтратегия: ${rules.chat_strategy}`;
            }
          }
        }

        // Detect conversation phase for stage-aware AI replies
        const phase = detectConversationPhase(messages);

        const context = `
**Магазин:**
Название: ${store?.name || storeId}

**Товар:**
Название: ${chat.product_name || 'Неизвестно'}
Артикул WB: ${chat.product_nm_id}
${productRulesContext}

**Клиент:**
Имя: ${chat.client_name}

**Фаза диалога:** ${phase.phaseLabel}
**Сообщений от клиента:** ${phase.clientMessageCount}

**История переписки:**
${chatHistory}
        `.trim();

        // Generate AI reply
        const aiResult = await generateChatReply({
          context,
          storeId,
          ownerId: chat.owner_id,
          chatId,
          storeInstructions: await buildStoreInstructions(storeId, store?.ai_instructions, store?.marketplace),
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
