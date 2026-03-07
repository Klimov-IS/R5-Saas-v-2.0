/**
 * ChatService — domain service for TMA chat operations.
 *
 * Methods:
 *   - getChatDetail: enriched chat + messages (6-table JOIN)
 *   - sendMessage: marketplace dispatch + status update (PR-04)
 *   - generateReply: AI context building + generation (PR-05)
 */
import * as dbHelpers from '@/db/helpers';
import * as chatRepo from '@/db/repositories/chat-repository';
import type { ChatDetailDTO, ChatMessageDTO, ChatDetailResponse } from '@/core/contracts/tma-chat';
import type { SendMessageResponse, GenerateAiResponse } from '@/core/contracts/tma-chat';
import { sendMessageToMarketplace } from '@/core/services/message-sender';
import { generateChatReply } from '@/ai/flows/generate-chat-reply-flow';
import { buildStoreInstructions, detectConversationPhase, formatTimestampMSK, getRecencyLabel, getTagLabel, getStatusLabel } from '@/lib/ai-context';
import { findLinkWithReviewByChatId } from '@/db/review-chat-link-helpers';
import { isOfferMessage } from '@/lib/tag-classifier';
import { canAutoOverwriteTag } from '@/lib/chat-transitions';
import { runValidator } from '@/ai/output-validator';

/**
 * Get enriched chat detail with messages.
 *
 * Performs:
 * - 6-table JOIN: chats → stores → review_chat_links → reviews → products → product_rules
 * - Last 200 messages in chronological order (subquery DESC → outer ASC)
 * - Message synthesis fallback for unsynced last_message_*
 *
 * @throws Error if chat not found or not accessible
 */
export async function getChatDetail(
  chatId: string,
  accessibleStoreIds: string[]
): Promise<ChatDetailResponse> {
  const chat = await chatRepo.findChatDetailById(chatId, accessibleStoreIds);

  if (!chat) {
    throw new ChatNotFoundError(chatId);
  }

  const rows = await chatRepo.findLastMessages(chatId, 200);

  const messages: ChatMessageDTO[] = rows.map((m: any) => ({
    id: m.id,
    text: m.text,
    sender: m.sender,
    timestamp: m.timestamp,
    isAutoReply: m.is_auto_reply,
    downloadId: m.download_id || null,
  }));

  // Synthesize last message if not yet synced to chat_messages.
  // Covers: (1) TG mini-app send gap (seller), (2) dialogue sync gap (client).
  if (chat.last_message_text && chat.last_message_date && chat.last_message_sender) {
    const lastMsgDate = new Date(chat.last_message_date).getTime();
    const lastDbMsg = messages[messages.length - 1];
    const lastDbDate = lastDbMsg ? new Date(lastDbMsg.timestamp).getTime() : 0;
    if (lastDbDate < lastMsgDate - 1000) {
      messages.push({
        id: `tg_synth_${chat.id}_${lastMsgDate}`,
        text: chat.last_message_text,
        sender: chat.last_message_sender,
        timestamp: chat.last_message_date,
        isAutoReply: false,
        downloadId: null,
      });
    }
  }

  const chatDTO: ChatDetailDTO = {
    id: chat.id,
    storeId: chat.store_id,
    storeName: chat.store_name,
    marketplace: chat.marketplace,
    clientName: chat.client_name,
    productName: chat.product_name,
    productNmId: chat.product_nm_id ?? null,
    status: chat.status,
    tag: chat.tag,
    draftReply: chat.draft_reply,
    draftReplyGeneratedAt: chat.draft_reply_generated_at ?? null,
    completionReason: chat.completion_reason,
    reviewRating: chat.review_rating ?? null,
    reviewDate: chat.review_date ?? null,
    complaintStatus: chat.complaint_status ?? null,
    reviewStatusWb: chat.review_status_wb ?? null,
    productStatus: chat.product_status ?? null,
    offerCompensation: chat.offer_compensation ?? null,
    maxCompensation: chat.max_compensation ?? null,
    compensationType: chat.compensation_type ?? null,
    compensationBy: chat.compensation_by ?? null,
    chatStrategy: chat.chat_strategy ?? null,
    reviewText: chat.review_text ?? null,
    chatUrl: chat.chat_url ?? null,
  };

  return { chat: chatDTO, messages };
}

/**
 * Send a message to a buyer via marketplace API.
 *
 * Performs:
 * - Access check (chat belongs to accessible stores)
 * - Marketplace dispatch via sendMessageToMarketplace (WB/OZON)
 * - Stop active auto-sequence (manual reply overrides automation)
 * - Update chat: status → in_progress, clear draft, set last_message_*
 *
 * @returns { success: true } on success
 * @throws ChatNotFoundError if chat not accessible
 * @throws OzonChatNotStartedError if OZON buyer hasn't activated chat
 * @throws Error on marketplace API failure
 */
export async function sendMessage(
  chatId: string,
  message: string,
  accessibleStoreIds: string[]
): Promise<SendMessageResponse> {
  const chat = await chatRepo.findChatForSend(chatId, accessibleStoreIds);

  if (!chat) {
    throw new ChatNotFoundError(chatId);
  }

  // Get store for marketplace credentials
  const store = await dbHelpers.getStoreById(chat.store_id);
  if (!store) {
    throw new ChatNotFoundError(chatId);
  }

  // Send via shared marketplace dispatch
  const trimmedMessage = message.trim();
  const result = await sendMessageToMarketplace({
    store,
    chatId,
    message: trimmedMessage,
    replySign: chat.reply_sign,
  });

  if (!result.sent) {
    if (result.error === 'credentials') {
      throw new Error(result.errorMessage || 'Marketplace credentials not configured');
    }
    // OZON code 7: chat not started
    if (result.errorMessage?.includes('"code":7') || result.errorMessage?.includes('chat not started')) {
      throw new OzonChatNotStartedError();
    }
    throw new Error(result.errorMessage || 'Failed to send message');
  }

  // Manual reply from TG → stop active sequence
  const activeSeq = await dbHelpers.getActiveSequenceForChat(chatId);
  if (activeSeq) {
    await dbHelpers.stopSequence(activeSeq.id, 'manual_reply');
    console.log(`[TG-SEND] Sequence paused for chat ${chatId} (manual reply, step ${activeSeq.current_step}/${activeSeq.max_steps})`);
  }

  // Clear draft, update status, and mark as seller-replied
  await dbHelpers.updateChat(chatId, {
    draft_reply: null,
    draft_reply_generated_at: null,
    draft_reply_edited: null,
    status: 'in_progress',
    last_message_sender: 'seller',
    last_message_text: trimmedMessage,
    last_message_date: new Date().toISOString(),
  });

  // Auto-classify tag if seller message is an offer (regex, no AI)
  try {
    const currentTag = (chat.tag as any) || null;
    if (isOfferMessage(trimmedMessage) && canAutoOverwriteTag(currentTag, 'deletion_offered')) {
      await dbHelpers.updateChat(chatId, { tag: 'deletion_offered' });
      console.log(`[TG-SEND] Tag auto-classified: chat ${chatId} ${currentTag || 'null'} → deletion_offered`);
    }
  } catch (tagErr: any) {
    console.error(`[TG-SEND] Tag classification error: ${tagErr.message}`);
  }

  return { success: true };
}

/**
 * Generate AI draft reply for a chat.
 *
 * Performs:
 * - Access check (chat + store.ai_instructions)
 * - Fetch messages, filter empty, format with MSK timestamps
 * - Load product rules + compensation gating by review_rating
 * - Build review context block (rating, date, trimmed text)
 * - Detect conversation phase
 * - Assemble full context string with marketplace-aware labels
 * - Build store instructions (ai_instructions + FAQ + guides + OZON addendum)
 * - Call generateChatReply AI flow
 * - OZON: enforce 1000-char limit at sentence boundary
 * - Save draft to DB
 *
 * @returns { success: true, draftReply } on success
 * @throws ChatNotFoundError if chat not accessible
 */
export async function generateReply(
  chatId: string,
  userId: string,
  accessibleStoreIds: string[]
): Promise<GenerateAiResponse> {
  const chat = await chatRepo.findChatWithAiInstructions(chatId, accessibleStoreIds);

  if (!chat) {
    throw new ChatNotFoundError(chatId);
  }

  // Get messages (windowed: last N messages + total count)
  const windowSize = parseInt(process.env.AI_HISTORY_WINDOW_SIZE || '20', 10);
  const { rows: messagesRows, totalCount } = await chatRepo.findMessagesForAi(chatId, windowSize);

  // Build chat history with timestamps (filter out null/empty messages)
  const filteredMessages = messagesRows.filter((m: any) => m.text && m.text.trim());
  const skippedCount = totalCount - messagesRows.length;
  const historyHeader = skippedCount > 0
    ? `[... ранее ещё ${skippedCount} сообщений ...]\n`
    : '';
  const chatHistory = historyHeader + filteredMessages
    .map((m: any) => {
      const ts = m.timestamp ? formatTimestampMSK(m.timestamp) : '';
      const prefix = ts ? `${ts} | ` : '';
      return `[${prefix}${m.sender === 'client' ? 'Клиент' : 'Продавец'}]: ${m.text}`;
    })
    .join('\n');

  // Marketplace-aware context
  const isOzon = chat.marketplace === 'ozon';

  // Get review link data (for compensation gating + review context)
  const rcl = await findLinkWithReviewByChatId(chatId);
  const reviewRating = rcl?.review_rating;

  // Load product rules for enriched context
  let productRulesContext = '';
  if (chat.product_nm_id) {
    const rules = await dbHelpers.getProductRulesByNmId(chat.store_id, chat.product_nm_id);
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
      const trimmedText = rcl.review_text.length > 300 ? rcl.review_text.slice(0, 300) + '...' : rcl.review_text;
      reviewContext += `\nТекст отзыва: ${trimmedText}`;
    }
  }

  // Detect conversation phase for stage-aware AI replies
  const phase = detectConversationPhase(filteredMessages);
  const sellerMessageCount = filteredMessages.filter((m: any) => m.sender === 'seller').length;
  const lastSellerMsg = [...filteredMessages].reverse().find((m: any) => m.sender === 'seller');
  const lastSellerText = lastSellerMsg ? lastSellerMsg.text.slice(0, 200) : 'нет';
  const lastMsgTimestamp = filteredMessages[filteredMessages.length - 1]?.timestamp;
  const recencyLabel = lastMsgTimestamp ? getRecencyLabel(lastMsgTimestamp) : '';

  // Build context string (matching web API format, marketplace-aware labels)
  const context = `
**Магазин:**
Название: ${chat.store_name}

**Товар:**
Название: ${chat.product_name || 'Неизвестно'}
${isOzon ? 'ID товара OZON' : 'Артикул WB'}: ${chat.product_nm_id || 'Неизвестно'}${!isOzon ? `\nВендор код: ${chat.product_vendor_code || 'Неизвестно'}` : ''}
${productRulesContext}
${reviewContext}

**Клиент:**
Имя: ${chat.client_name || 'Клиент'}

**Текущий этап воронки:** ${getTagLabel(chat.tag)}
**Статус чата:** ${getStatusLabel(chat.status)}
**Фаза диалога:** ${phase.phaseLabel}
**Сообщений от клиента:** ${phase.clientMessageCount}
**Сообщений от продавца:** ${sellerMessageCount}
**Последнее сообщение продавца:** ${lastSellerText}${recencyLabel ? `\n**Давность последнего сообщения:** ${recencyLabel}` : ''}

**История переписки:**
${chatHistory}
    `.trim();

  // Build store instructions (pass ai_instructions, not product_nm_id)
  const storeInstructions = await buildStoreInstructions(chat.store_id, chat.ai_instructions, chat.marketplace);

  console.log(`[AI-CTX] generateReply | chat=${chatId} | msgs=${filteredMessages.length}/${totalCount} (window=${windowSize}) | marketplace=${chat.marketplace} | phase=${phase.phase} | rating=${reviewRating ?? 'none'} | hasRules=${!!productRulesContext} | hasReview=${!!rcl} | hasCustomInstr=${!!chat.ai_instructions} | contextLen=${context.length} | instrLen=${storeInstructions?.length ?? 0}`);

  // Generate AI reply
  const result = await generateChatReply({
    context,
    chatId,
    storeId: chat.store_id,
    ownerId: userId,
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

  // Post-generation validation (feature-flagged)
  const validation = runValidator(draftText, {
    marketplace: chat.marketplace,
    reviewRating: reviewRating ?? null,
    phase: phase.phase,
    sellerMessageCount,
    chatId,
  });

  if (validation?.shouldReject) {
    // Enforce mode: don't save invalid draft, return error
    const errorMessages = validation.result.violations
      .filter(v => v.severity === 'error')
      .map(v => v.message);
    throw new Error(`AI draft rejected by validator: ${errorMessages.join('; ')}`);
  }

  // Save draft
  await dbHelpers.updateChat(chatId, {
    draft_reply: draftText,
    draft_reply_generated_at: new Date().toISOString(),
    draft_reply_edited: false,
  });

  return { success: true, draftReply: draftText };
}

/**
 * Custom error for chat not found / access denied.
 */
export class ChatNotFoundError extends Error {
  constructor(chatId: string) {
    super(`Chat not found: ${chatId}`);
    this.name = 'ChatNotFoundError';
  }
}

/**
 * OZON-specific: buyer hasn't activated the chat yet.
 */
export class OzonChatNotStartedError extends Error {
  constructor() {
    super('Покупатель ещё не принял чат. Отправить сообщение невозможно — дождитесь ответа покупателя.');
    this.name = 'OzonChatNotStartedError';
  }
}
