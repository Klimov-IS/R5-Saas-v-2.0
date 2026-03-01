import { NextRequest, NextResponse } from 'next/server';
import { getChatById, getChatMessages, getStoreById, getProductRulesByNmId, updateChat } from '@/db/helpers';
import { generateChatReply } from '@/ai/flows/generate-chat-reply-flow';
import { buildStoreInstructions, detectConversationPhase } from '@/lib/ai-context';
import { findLinkByChatId } from '@/db/review-chat-link-helpers';

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

    // Load product rules for enriched context
    let productRulesContext = '';
    if (chat.product_nm_id) {
      const rules = await getProductRulesByNmId(storeId, chat.product_nm_id);
      if (rules) {
        productRulesContext = `\n**Правила товара:**\nРабота в чатах: ${rules.work_in_chats ? 'включена' : 'отключена'}`;

        // Check review rating — compensation only for 1-3★ reviews
        const rcl = await findLinkByChatId(chatId);
        const reviewRating = rcl?.review_rating;
        const isNegativeReview = reviewRating != null && reviewRating <= 3;

        if (rules.offer_compensation && isNegativeReview) {
          productRulesContext += `\nКомпенсация: до ${rules.max_compensation || '?'}₽ (${rules.compensation_type || 'не указан тип'})`;
        } else if (reviewRating != null && reviewRating >= 4) {
          productRulesContext += `\nКомпенсация: не предлагать (оценка ${reviewRating}★ — только повышение до 5★, без кешбека)`;
        } else if (!rules.offer_compensation) {
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
Название: ${store.name}

**Товар:**
Название: ${chat.product_name || 'Неизвестно'}
Артикул WB: ${chat.product_nm_id}
Вендор код: ${chat.product_vendor_code || 'Неизвестно'}
${productRulesContext}

**Клиент:**
Имя: ${chat.client_name}

**Фаза диалога:** ${phase.phaseLabel}
**Сообщений от клиента:** ${phase.clientMessageCount}

**История переписки:**
${chatHistory}
    `.trim();

    // Generate AI reply
    const result = await generateChatReply({
      context,
      storeId,
      ownerId,
      chatId,
      storeInstructions: await buildStoreInstructions(storeId, store.ai_instructions, store.marketplace),
    });

    // ✅ Save draft to database
    console.log('💾 [GENERATE-AI] Saving draft to DB:', {
      chatId,
      clientName: chat.client_name,
      draftLength: result.text.length,
      preview: result.text.substring(0, 100) + '...',
    });

    await updateChat(chatId, {
      draft_reply: result.text,
      draft_reply_generated_at: new Date().toISOString(),
      draft_reply_edited: false,
    });

    console.log('✅ [GENERATE-AI] Draft saved successfully to DB');

    return NextResponse.json({
      success: true,
      text: result.text,
      saved: true, // Indicator that draft was saved
    }, { status: 200 });

  } catch (error: any) {
    console.error('[API ERROR] POST /api/stores/[storeId]/chats/[chatId]/generate-ai:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
