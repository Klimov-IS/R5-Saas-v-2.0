import { NextRequest, NextResponse } from 'next/server';
import { getChatById, getChatMessages, getStoreById, getProductRulesByNmId, updateChat } from '@/db/helpers';
import { generateChatReply } from '@/ai/flows/generate-chat-reply-flow';
import { buildStoreInstructions, detectConversationPhase, formatTimestampMSK, getTagLabel, getStatusLabel } from '@/lib/ai-context';
import { findLinkWithReviewByChatId } from '@/db/review-chat-link-helpers';

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

    // Build context for AI — with timestamps
    const chatHistory = messages
      .filter((msg) => msg.text && msg.text.trim())
      .map((msg) => {
        const ts = msg.timestamp ? formatTimestampMSK(msg.timestamp) : '';
        const prefix = ts ? `${ts} | ` : '';
        return `[${prefix}${msg.sender === 'client' ? 'Клиент' : 'Продавец'}]: ${msg.text}`;
      })
      .join('\n');

    // Marketplace-aware labels
    const isOzon = store.marketplace === 'ozon';

    // Get review link data (for compensation gating + review context)
    const rcl = await findLinkWithReviewByChatId(chatId);
    const reviewRating = rcl?.review_rating;

    // Load product rules for enriched context
    let productRulesContext = '';
    if (chat.product_nm_id) {
      const rules = await getProductRulesByNmId(storeId, chat.product_nm_id);
      if (rules) {
        productRulesContext = `\n**Правила товара:**\nРабота в чатах: ${rules.work_in_chats ? 'включена' : 'отключена'}`;

        // Compensation gating by review rating
        const isNegativeReview = reviewRating != null && reviewRating <= 3;

        if (rules.offer_compensation && isNegativeReview) {
          productRulesContext += `\nКомпенсация: до ${rules.max_compensation || '?'}₽ (${rules.compensation_type || 'не указан тип'})`;
        } else if (reviewRating != null && reviewRating >= 4) {
          if (isOzon) {
            productRulesContext += `\nКомпенсация: не предлагать (оценка ${reviewRating}★ — попросить дополнить отзыв до 5★)`;
          } else {
            productRulesContext += `\nКомпенсация: не предлагать (оценка ${reviewRating}★ — только повышение до 5★, без кешбека)`;
          }
        } else if (!rules.offer_compensation) {
          productRulesContext += `\nКомпенсация: не предлагать`;
        } else if (reviewRating == null && rules.offer_compensation) {
          // Rating unknown (e.g. OZON chats without review_chat_links) — compensation ONLY for target action
          if (isOzon) {
            productRulesContext += `\nКомпенсация: до ${rules.max_compensation || '?'}₽ — СТРОГО только за дополнение отзыва до 5★. Без согласия на дополнение — не предлагать`;
          } else {
            productRulesContext += `\nКомпенсация: до ${rules.max_compensation || '?'}₽ — СТРОГО только за удаление или изменение отзыва. Без согласия — не предлагать`;
          }
        }
        if (rules.chat_strategy) {
          productRulesContext += `\nСтратегия: ${rules.chat_strategy}`;
        }
      }
    }

    // Build review context block
    let reviewContext = '';
    if (rcl) {
      const reviewDate = rcl.review_date ? formatTimestampMSK(rcl.review_date) : 'неизвестна';
      reviewContext = `\n**Отзыв покупателя:**\nОценка: ${rcl.review_rating}★\nДата отзыва: ${reviewDate}`;
      if (rcl.review_text) {
        const trimmedText = rcl.review_text.length > 500 ? rcl.review_text.slice(0, 500) + '...' : rcl.review_text;
        reviewContext += `\nТекст отзыва: ${trimmedText}`;
      }
    }

    // Detect conversation phase for stage-aware AI replies
    const filteredMessages = messages.filter((msg) => msg.text && msg.text.trim());
    const phase = detectConversationPhase(filteredMessages);
    const sellerMessageCount = filteredMessages.filter((m) => m.sender === 'seller').length;
    const lastSellerMsg = [...filteredMessages].reverse().find((m) => m.sender === 'seller');
    const lastSellerText = lastSellerMsg ? (lastSellerMsg.text || '').slice(0, 200) : 'нет';

    const context = `
**Магазин:**
Название: ${store.name}

**Товар:**
Название: ${chat.product_name || 'Неизвестно'}
${isOzon ? 'ID товара OZON' : 'Артикул WB'}: ${chat.product_nm_id || 'Неизвестно'}${!isOzon ? `\nВендор код: ${chat.product_vendor_code || 'Неизвестно'}` : ''}
${productRulesContext}
${reviewContext}

**Клиент:**
Имя: ${chat.client_name}

**Текущий этап воронки:** ${getTagLabel(chat.tag)}
**Статус чата:** ${getStatusLabel(chat.status)}
**Фаза диалога:** ${phase.phaseLabel}
**Сообщений от клиента:** ${phase.clientMessageCount}
**Сообщений от продавца:** ${sellerMessageCount}
**Последнее сообщение продавца:** ${lastSellerText}

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

    // For OZON: enforce 1000-char limit by trimming at last sentence boundary
    let draftText = result.text;
    if (isOzon && draftText.length > 1000) {
      const trimmed = draftText.slice(0, 1000);
      const lastSentenceEnd = Math.max(
        trimmed.lastIndexOf('. '),
        trimmed.lastIndexOf('! '),
        trimmed.lastIndexOf('? '),
        trimmed.lastIndexOf('.\n'),
      );
      draftText = lastSentenceEnd > 800
        ? trimmed.slice(0, lastSentenceEnd + 1).trim()
        : trimmed.trim();
    }

    // ✅ Save draft to database
    console.log('💾 [GENERATE-AI] Saving draft to DB:', {
      chatId,
      clientName: chat.client_name,
      draftLength: draftText.length,
      preview: draftText.substring(0, 100) + '...',
    });

    await updateChat(chatId, {
      draft_reply: draftText,
      draft_reply_generated_at: new Date().toISOString(),
      draft_reply_edited: false,
    });

    console.log('✅ [GENERATE-AI] Draft saved successfully to DB');

    return NextResponse.json({
      success: true,
      text: draftText,
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
