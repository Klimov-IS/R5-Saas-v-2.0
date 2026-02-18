import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticateTgApiRequest } from '@/lib/telegram-auth';
import { query } from '@/db/client';
import * as dbHelpers from '@/db/helpers';
import { getAccessibleStoreIds } from '@/db/auth-helpers';
import { generateChatReply } from '@/ai/flows/generate-chat-reply-flow';
import { buildStoreInstructions, detectConversationPhase } from '@/lib/ai-context';

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
    const auth = await authenticateTgApiRequest(request);
    if (!auth.valid || !auth.userId) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const { chatId } = params;

    // Get chat with org-based access check
    const storeIds = await getAccessibleStoreIds(auth.userId);
    const chatResult = await query(
      `SELECT c.*, s.name as store_name, s.ai_instructions
       FROM chats c
       JOIN stores s ON c.store_id = s.id
       WHERE c.id = $1 AND c.store_id = ANY($2::text[])`,
      [chatId, storeIds]
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

    // Build chat history (filter out null/empty messages)
    const chatHistory = messagesResult.rows
      .filter((m: any) => m.text && m.text.trim())
      .map((m: any) => `[${m.sender === 'client' ? 'Клиент' : 'Продавец'}]: ${m.text}`)
      .join('\n');

    // Load product rules for enriched context
    let productRulesContext = '';
    if (chat.product_nm_id) {
      const rules = await dbHelpers.getProductRulesByNmId(chat.store_id, chat.product_nm_id);
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
    const filteredMessages = messagesResult.rows.filter((m: any) => m.text && m.text.trim());
    const phase = detectConversationPhase(filteredMessages);
    const sellerMessageCount = filteredMessages.filter((m: any) => m.sender === 'seller').length;
    const lastSellerMsg = [...filteredMessages].reverse().find((m: any) => m.sender === 'seller');
    const lastSellerText = lastSellerMsg ? lastSellerMsg.text.slice(0, 200) : 'нет';

    // Build context string (matching web API format, marketplace-aware labels)
    const isOzon = chat.marketplace === 'ozon';
    const context = `
**Магазин:**
Название: ${chat.store_name}

**Товар:**
Название: ${chat.product_name || 'Неизвестно'}
${isOzon ? 'ID товара OZON' : 'Артикул WB'}: ${chat.product_nm_id || 'Неизвестно'}${!isOzon ? `\nВендор код: ${chat.product_vendor_code || 'Неизвестно'}` : ''}
${productRulesContext}

**Клиент:**
Имя: ${chat.client_name || 'Клиент'}

**Фаза диалога:** ${phase.phaseLabel}
**Сообщений от клиента:** ${phase.clientMessageCount}
**Сообщений от продавца:** ${sellerMessageCount}
**Последнее сообщение продавца:** ${lastSellerText}

**История переписки:**
${chatHistory}
    `.trim();

    // Build store instructions (pass ai_instructions, not product_nm_id)
    const storeInstructions = await buildStoreInstructions(chat.store_id, chat.ai_instructions, chat.marketplace);

    // Generate AI reply
    const result = await generateChatReply({
      context,
      chatId,
      storeId: chat.store_id,
      ownerId: auth.userId,
      storeInstructions: storeInstructions || undefined,
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

    // Save draft
    await dbHelpers.updateChat(chatId, {
      draft_reply: draftText,
      draft_reply_generated_at: new Date().toISOString(),
      draft_reply_edited: false,
    });

    return NextResponse.json({
      success: true,
      draftReply: draftText,
    });
  } catch (error: any) {
    console.error('[TG-GENERATE] Error:', error.message);
    return NextResponse.json({ error: 'Failed to generate reply' }, { status: 500 });
  }
}
