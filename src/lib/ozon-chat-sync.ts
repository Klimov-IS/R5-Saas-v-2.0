/**
 * OZON Chat Sync
 *
 * Fetches chats and message history from OZON Seller API.
 * Uses shared `chats` + `chat_messages` tables with marketplace='ozon'.
 *
 * Key differences from WB:
 * - Per-chat history fetch (not global events cursor)
 * - Filter for BUYER_SELLER only (Premium Plus required)
 * - No client name available (OZON doesn't expose buyer name)
 * - SKU extracted from message context
 * - Sender mapping: customer→client, seller→seller, others→skip
 */

import { createOzonClient, OzonChatMessage } from '@/lib/ozon-api';
import * as dbHelpers from '@/db/helpers';
import type { ChatTag, ChatStatus } from '@/db/helpers';
import { classifyChatDeletion } from '@/ai/flows/classify-chat-deletion-flow';
import { buildStoreInstructions } from '@/lib/ai-context';
import { DEFAULT_TRIGGER_PHRASE, DEFAULT_OZON_FOLLOWUP_TEMPLATES, DEFAULT_OZON_FOLLOWUP_TEMPLATES_4STAR } from '@/lib/auto-sequence-templates';

/** Map OZON user.type to our sender format */
function mapSender(userType: string): 'client' | 'seller' | null {
  const t = userType.toLowerCase();
  if (t === 'customer' || t === 'сustomer') return 'client'; // note: OZON has typo with Cyrillic С
  if (t === 'seller') return 'seller';
  return null; // ignore system messages (NotificationUser, crm, courier, support)
}

/**
 * Sync OZON chats for a store.
 * Returns summary string for logging.
 */
export async function refreshOzonChats(storeId: string): Promise<string> {
  console.log(`[OZON-CHATS] Starting chat sync for store ${storeId}`);

  // Mark sync as pending
  await dbHelpers.updateStore(storeId, {
    last_chat_update_status: 'pending',
    last_chat_update_date: new Date().toISOString(),
  });

  try {
    const store = await dbHelpers.getStoreById(storeId);
    if (!store) throw new Error(`Store ${storeId} not found`);
    if (!store.ozon_client_id || !store.ozon_api_key) {
      throw new Error('OZON credentials not configured');
    }

    const client = createOzonClient(store.ozon_client_id, store.ozon_api_key);
    const ownerId = store.owner_id;

    // Build product map: ozon_sku → product
    const products = await dbHelpers.getProducts(storeId);
    const skuToProduct = new Map<string, typeof products[0]>();
    for (const p of products) {
      if (p.ozon_sku) skuToProduct.set(p.ozon_sku, p);
      if (p.ozon_fbs_sku) skuToProduct.set(p.ozon_fbs_sku, p);
    }

    // Step 1: Fetch all BUYER_SELLER chats
    const allChats = await client.getAllBuyerChats();
    console.log(`[OZON-CHATS] Found ${allChats.length} BUYER_SELLER chats`);

    // Get existing chats map
    const existingChats = await dbHelpers.getChats(storeId);
    const existingChatMap = new Map(existingChats.map((c) => [c.id, c]));

    let newMessagesTotal = 0;
    let chatsProcessed = 0;
    let chatErrors = 0;
    const chatsToClassify: { chatId: string; productName?: string }[] = [];
    const newSellerMessagesByChat: Record<string, string[]> = {};

    for (const chatItem of allChats) {
      const chatId = chatItem.chat.chat_id;
      const existing = existingChatMap.get(chatId);

      try {
        // Step 2: Fetch message history for this chat
        let messages: OzonChatMessage[] = [];
        try {
          const history = await client.getChatHistory(chatId, 'Backward', undefined, 100);
          messages = history.messages || [];
        } catch (err: any) {
          if (err.status === 403) {
            console.warn(`[OZON-CHATS] 403 for chat ${chatId} (Premium Plus required)`);
            chatErrors++;
            continue;
          }
          throw err;
        }

        // Extract latest message info
        const latestMsg = messages[0] || null;
        const latestSender = latestMsg ? mapSender(latestMsg.user.type) : null;
        const latestText = latestMsg?.data?.[0] || null;

        // Try to extract product SKU from messages
        let productNmId: string | null = existing?.product_nm_id || null;
        let productName: string | null = existing?.product_name || null;
        if (!productNmId && messages.length > 0) {
          // Search messages for context.sku (usually in first message)
          for (let i = messages.length - 1; i >= 0; i--) {
            const sku = messages[i].context?.sku;
            if (sku) {
              const product = skuToProduct.get(String(sku));
              if (product) {
                productNmId = String(sku);
                productName = product.name;
              }
              break;
            }
          }
        }

        // Upsert chat
        await dbHelpers.upsertChat({
          id: chatId,
          store_id: storeId,
          owner_id: ownerId,
          marketplace: 'ozon',
          client_name: existing?.client_name || 'Покупатель',
          product_nm_id: productNmId,
          product_name: productName,
          product_vendor_code: existing?.product_vendor_code || null,
          last_message_date: latestMsg?.created_at || existing?.last_message_date || null,
          last_message_text: latestText || existing?.last_message_text || null,
          last_message_sender: latestSender || existing?.last_message_sender || null,
          reply_sign: '', // OZON doesn't use reply_sign (WB-specific)
          status: existing?.status || 'inbox',
          tag: existing?.tag,
          draft_reply: existing?.draft_reply || null,
          draft_reply_thread_id: existing?.draft_reply_thread_id || null,
          draft_reply_generated_at: existing?.draft_reply_generated_at || null,
          draft_reply_edited: existing?.draft_reply_edited || null,
          ozon_chat_type: chatItem.chat.chat_type,
          ozon_chat_status: chatItem.chat.chat_status,
          ozon_unread_count: chatItem.unread_count,
          ozon_last_message_id: latestMsg ? String(latestMsg.message_id) : existing?.ozon_last_message_id || null,
        });

        // Step 3: Save messages + track new seller messages for trigger detection
        let newForThisChat = 0;
        const existingLastMsgId = existing?.ozon_last_message_id ? parseInt(existing.ozon_last_message_id, 10) : 0;
        for (const msg of messages) {
          const sender = mapSender(msg.user.type);
          if (!sender) continue; // skip system messages

          const text = msg.data?.[0] || (msg.is_image ? '[Изображение]' : '');

          await dbHelpers.upsertChatMessage({
            id: `ozon_${msg.message_id}`,
            chat_id: chatId,
            store_id: storeId,
            owner_id: ownerId,
            marketplace: 'ozon',
            text,
            sender,
            timestamp: msg.created_at,
            download_id: null,
            is_auto_reply: false,
          });
          newForThisChat++;

          // Track new seller messages for trigger phrase detection
          if (sender === 'seller' && text.trim() && msg.message_id > existingLastMsgId) {
            if (!newSellerMessagesByChat[chatId]) newSellerMessagesByChat[chatId] = [];
            newSellerMessagesByChat[chatId].push(text);
          }
        }

        newMessagesTotal += newForThisChat;
        chatsProcessed++;

        // Collect chats needing AI classification (last message from client, limit 20)
        if (newForThisChat > 0 && latestSender === 'client' && chatsToClassify.length < 20) {
          chatsToClassify.push({ chatId, productName: productName || undefined });
        }
      } catch (err: any) {
        console.error(`[OZON-CHATS] Error processing chat ${chatId}: ${err.message}`);
        chatErrors++;
      }
    }

    // Step 3.5: Trigger phrase detection for OZON auto-sequences
    let triggersDetected = 0;
    if (Object.keys(newSellerMessagesByChat).length > 0) {
      const settings = await dbHelpers.getUserSettings();
      const triggerPhrase = settings?.no_reply_trigger_phrase || DEFAULT_TRIGGER_PHRASE;
      const triggerPhrase2 = settings?.no_reply_trigger_phrase2 || null;

      const deletionTags: ChatTag[] = [
        'deletion_candidate', 'deletion_offered', 'deletion_agreed',
        'deletion_confirmed', 'refund_requested',
      ];

      for (const [trigChatId, sellerTexts] of Object.entries(newSellerMessagesByChat)) {
        try {
          const matchedSet1 = sellerTexts.some(text => text.includes(triggerPhrase));
          const matchedSet2 = triggerPhrase2 ? sellerTexts.some(text => text.includes(triggerPhrase2)) : false;

          if (!matchedSet1 && !matchedSet2) continue;

          const chat = await dbHelpers.getChatById(trigChatId);
          if (!chat) continue;

          // Skip if already in deletion workflow
          if (chat.tag && deletionTags.includes(chat.tag as ChatTag)) continue;

          const is4Star = matchedSet2 && !matchedSet1;
          const sequenceType = is4Star ? 'ozon_no_reply_followup_4star' : 'ozon_no_reply_followup';

          await dbHelpers.updateChat(trigChatId, {
            tag: 'deletion_candidate' as ChatTag,
            status: 'in_progress' as ChatStatus,
            status_updated_at: new Date().toISOString(),
          });

          // Create auto-sequence if none exists
          const existingSeq = await dbHelpers.getActiveSequenceForChat(trigChatId);
          if (!existingSeq) {
            let templates;
            if (is4Star) {
              templates = settings?.no_reply_messages2?.length
                ? settings.no_reply_messages2.map((text: string, i: number) => ({ day: i + 1, text }))
                : DEFAULT_OZON_FOLLOWUP_TEMPLATES_4STAR;
            } else {
              templates = settings?.no_reply_messages?.length
                ? settings.no_reply_messages.map((text: string, i: number) => ({ day: i + 1, text }))
                : DEFAULT_OZON_FOLLOWUP_TEMPLATES;
            }
            await dbHelpers.createAutoSequence(trigChatId, chat.store_id, chat.owner_id, templates, sequenceType);
            console.log(`[OZON-CHATS] Trigger detected in chat ${trigChatId} → deletion_candidate + sequence [${sequenceType}]`);
          }
          triggersDetected++;
        } catch (triggerErr: any) {
          console.error(`[OZON-CHATS] Trigger detection error for chat ${trigChatId}: ${triggerErr.message}`);
        }
      }
    }

    // Step 4: AI classification for chats with new client messages
    let classified = 0;
    if (chatsToClassify.length > 0) {
      const storeInstructions = await buildStoreInstructions(storeId, store.ai_instructions, 'ozon');
      for (const item of chatsToClassify) {
        try {
          const chatMessages = await dbHelpers.getChatMessages(item.chatId);
          const chatHistory = chatMessages
            .filter(m => m.text?.trim())
            .map(m => `[${m.sender === 'client' ? 'Клиент' : 'Продавец'}]: ${m.text}`)
            .join('\n');

          if (chatHistory.length < 10) continue;

          const lastMsg = chatMessages[chatMessages.length - 1];
          const result = await classifyChatDeletion({
            chatHistory,
            lastMessageText: lastMsg?.text || '',
            storeId,
            ownerId,
            chatId: item.chatId,
            productName: item.productName,
            storeInstructions,
          });

          await dbHelpers.updateChat(item.chatId, { tag: result.tag });
          classified++;
        } catch (classifyErr: any) {
          console.warn(`[OZON-CHATS] Classification failed for chat ${item.chatId}: ${classifyErr.message}`);
        }
      }
      if (classified > 0) {
        console.log(`[OZON-CHATS] AI classified ${classified}/${chatsToClassify.length} chats`);
      }
    }

    // Step 5: Update store stats
    const allStoreChats = await dbHelpers.getChats(storeId);
    await dbHelpers.updateStore(storeId, {
      last_chat_update_status: 'success',
      last_chat_update_date: new Date().toISOString(),
      total_chats: allStoreChats.length,
    });

    const message = `OZON chats synced: ${chatsProcessed} chats processed, ${newMessagesTotal} messages, ${triggersDetected} triggers, ${classified} classified, ${chatErrors} errors`;
    console.log(`[OZON-CHATS] ${message}`);
    return message;
  } catch (error: any) {
    const errorMsg = error.message || String(error);
    console.error(`[OZON-CHATS] Error: ${errorMsg}`);

    try {
      await dbHelpers.updateStore(storeId, {
        last_chat_update_status: 'error',
        last_chat_update_error: errorMsg.slice(0, 500),
      });
    } catch { /* ignore */ }

    throw error;
  }
}
