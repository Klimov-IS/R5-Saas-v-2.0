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
import { query } from '@/db/client';
import type { ChatStatus } from '@/db/helpers';
// Tag classification: regex-based (replaced AI in migration 024)
import { isOfferMessage, isAgreementMessage, isConfirmationMessage } from '@/lib/tag-classifier';
import { canAutoOverwriteTag } from '@/lib/chat-transitions';
import { sendTelegramNotifications, sendSuccessNotification } from '@/lib/telegram-notifications';
import { detectSuccessEvent } from '@/lib/success-detector';

/** Map OZON user.type to our sender format */
function mapSender(userType: string): 'client' | 'seller' | null {
  const t = userType.toLowerCase();
  if (t === 'customer' || t === 'сustomer') return 'client'; // note: OZON has typo with Cyrillic С
  if (t === 'seller') return 'seller';
  return null; // ignore system messages (NotificationUser, crm, courier, support)
}

/**
 * Extract text from OZON message data array.
 * OZON format: client msgs = ["text"], seller msgs = ["errorText", "actual text"]
 * "errorText" is OZON's internal type label, NOT an error.
 */
function extractMessageText(data?: string[], isImage?: boolean): string {
  if (!data || data.length === 0) return isImage ? '[Изображение]' : '';
  if (data[0] === 'errorText' && data.length > 1) return data[1];
  return data[0];
}

/**
 * Sync OZON chats for a store.
 * @param fullScan - if true, fetches ALL opened chats (hourly safety scan);
 *                   if false (default), fetches only unread chats (fast 5-min scan).
 * Returns summary string for logging.
 */
export async function refreshOzonChats(storeId: string, fullScan = false): Promise<string> {
  const scanMode = fullScan ? 'FULL SCAN' : 'UNREAD ONLY';
  console.log(`[OZON-CHATS] Starting chat sync for store ${storeId} (mode: ${scanMode})`);

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

    // Step 1: Fetch BUYER_SELLER chats from OZON API
    // - unread-only (default): fast 5-min scan, catches buyer replies to trigger messages
    // - full scan: hourly safety net, catches chats read in OZON dashboard before unread scan
    const allChats = fullScan
      ? await client.getAllBuyerChatsAll()
      : await client.getAllBuyerChats();
    console.log(`[OZON-CHATS] Found ${allChats.length} BUYER_SELLER chats (${scanMode})`);

    // Early exit: unread scan found nothing → nothing to do
    if (!fullScan && allChats.length === 0) {
      await dbHelpers.updateStore(storeId, {
        last_chat_update_status: 'success',
        last_chat_update_date: new Date().toISOString(),
      });
      const msg = 'OZON chats synced: 0 processed (no unread chats)';
      console.log(`[OZON-CHATS] ${msg}`);
      return msg;
    }

    // Load existing chats from DB
    // - unread scan: targeted SELECT for the 1-20 specific chat IDs (fast)
    // - full scan: load all store chats (may be 156K rows, but needed for incremental skip)
    let existingChatsResult;
    if (fullScan) {
      existingChatsResult = await query(
        `SELECT id, ozon_last_message_id, product_nm_id, product_name, product_vendor_code,
                client_name, status, tag, draft_reply, draft_reply_thread_id,
                draft_reply_generated_at, draft_reply_edited,
                last_message_date, last_message_text, last_message_sender,
                owner_id, ozon_chat_type, ozon_chat_status, ozon_unread_count
         FROM chats WHERE store_id = $1 AND marketplace = 'ozon'`,
        [storeId]
      );
    } else {
      const chatIds = allChats.map(c => c.chat.chat_id);
      existingChatsResult = await query(
        `SELECT id, ozon_last_message_id, product_nm_id, product_name, product_vendor_code,
                client_name, status, tag, draft_reply, draft_reply_thread_id,
                draft_reply_generated_at, draft_reply_edited,
                last_message_date, last_message_text, last_message_sender,
                owner_id, ozon_chat_type, ozon_chat_status, ozon_unread_count
         FROM chats WHERE store_id = $1 AND id = ANY($2::text[])`,
        [storeId, chatIds]
      );
    }
    const existingChatMap = new Map(existingChatsResult.rows.map((c: any) => [c.id, c]));

    let newMessagesTotal = 0;
    let chatsProcessed = 0;
    let chatsSkipped = 0;
    let chatsSeeded = 0;
    let chatErrors = 0;
    const clientRepliedChats: Array<{ chatId: string; clientName: string; productName: string | null; messagePreview: string | null }> = [];
    let statusTransitions = 0;
    const seedBatch: Array<{ id: string; lastMsgId: string }> = [];

    for (const chatItem of allChats) {
      const chatId = chatItem.chat.chat_id;
      const existing = existingChatMap.get(chatId);

      // Incremental sync: skip chats with no new messages
      const apiLastMsgId = String(chatItem.last_message_id || 0);
      if (existing && existing.ozon_last_message_id === apiLastMsgId) {
        chatsSkipped++;
        continue;
      }

      // Seed ozon_last_message_id for existing chats that don't have it yet
      // (avoids fetching full history for 250K+ chats that were already synced)
      // Note: seed even if apiLastMsgId = "0" (empty chats) — "0" === "0" → skipped next time
      if (existing && !existing.ozon_last_message_id) {
        seedBatch.push({ id: chatId, lastMsgId: apiLastMsgId });
        chatsSeeded++;
        continue;
      }

      try {
        // Step 2: Fetch message history only for chats with new activity
        let messages: OzonChatMessage[] = [];
        try {
          const history = await client.getChatHistory(chatId, 'Backward', undefined, 100);
          messages = history.messages || [];
        } catch (err: any) {
          if (err.status === 403) {
            if (chatErrors < 5) console.warn(`[OZON-CHATS] 403 for chat ${chatId} (Premium Plus required)`);
            chatErrors++;
            continue;
          }
          throw err;
        }

        // Extract latest message info
        const latestMsg = messages[0] || null;
        const latestSender = latestMsg ? mapSender(latestMsg.user.type) : null;
        const latestText = latestMsg ? extractMessageText(latestMsg.data, latestMsg.is_image) || null : null;

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
          status: existing?.status || 'awaiting_reply',
          tag: existing?.tag,
          draft_reply: existing?.draft_reply || null,
          draft_reply_thread_id: existing?.draft_reply_thread_id || null,
          draft_reply_generated_at: existing?.draft_reply_generated_at || null,
          draft_reply_edited: existing?.draft_reply_edited || null,
          ozon_chat_type: chatItem.chat.chat_type,
          ozon_chat_status: chatItem.chat.chat_status,
          ozon_unread_count: chatItem.unread_count,
          // Always mark with apiLastMsgId — even "0" for empty chats, so they skip next time
          ozon_last_message_id: apiLastMsgId !== '0' ? apiLastMsgId : (latestMsg ? String(latestMsg.message_id) : apiLastMsgId),
        });

        // Step 3: Save messages + track new seller messages for trigger detection
        let newForThisChat = 0;
        const existingLastMsgId = existing?.ozon_last_message_id ? parseInt(existing.ozon_last_message_id, 10) : 0;
        for (const msg of messages) {
          const sender = mapSender(msg.user.type);
          if (!sender) continue; // skip system messages

          const text = extractMessageText(msg.data, msg.is_image);

          // Skip if auto-sequence already recorded this seller message
          if (sender === 'seller' && text) {
            const isDupe = await query(
              `SELECT 1 FROM chat_messages
               WHERE chat_id = $1 AND sender = 'seller' AND is_auto_reply = true
                 AND text = $2 AND timestamp >= $3::timestamptz - interval '5 minutes'
                 AND timestamp <= $3::timestamptz + interval '5 minutes'
               LIMIT 1`,
              [chatId, text, msg.created_at]
            );
            if (isDupe.rows.length > 0) continue;
          }

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
        }

        newMessagesTotal += newForThisChat;
        chatsProcessed++;

        // Step 3a: Status transitions + draft clearing (only for chats with NEW activity)
        const hasNewActivity = latestMsg && Number(latestMsg.message_id) > existingLastMsgId;
        if (hasNewActivity && existing) {
          try {
            if (latestSender === 'client') {
              // Client replied → move to inbox
              if (existing.status !== 'inbox') {
                const updates: Record<string, any> = {
                  status: 'inbox' as ChatStatus,
                  status_updated_at: new Date().toISOString(),
                };
                if (existing.status === 'closed') {
                  updates.completion_reason = null;
                }
                await dbHelpers.updateChat(chatId, updates);
                console.log(`[OZON-CHATS] Chat ${chatId}: ${existing.status} → inbox (client replied)`);
                statusTransitions++;
              }

              // Stop auto-sequence if client replied
              try {
                const activeSeq = await dbHelpers.getActiveSequenceForChat(chatId);
                if (activeSeq) {
                  await dbHelpers.stopSequence(activeSeq.id, 'client_replied');
                  console.log(`[OZON-CHATS] Auto-sequence stopped for chat ${chatId} (client replied)`);
                }
              } catch (seqErr: any) {
                console.error(`[OZON-CHATS] Failed to stop auto-sequence for chat ${chatId}: ${seqErr.message}`);
              }

              // Collect for TG notification (only seller-initiated chats — those have product_nm_id from context.sku)
              // Random buyer-initiated chats (no product_nm_id) are excluded — matches queue filter
              if (existing.product_nm_id) {
                const msgPreview = latestMsg ? extractMessageText(latestMsg.data, latestMsg.is_image) || null : null;
                clientRepliedChats.push({
                  chatId,
                  clientName: existing.client_name || 'Покупатель',
                  productName: productName || null,
                  messagePreview: msgPreview,
                });

                // Detect success event (deleted/upgraded review)
                if (msgPreview) {
                  const successEvent = detectSuccessEvent(msgPreview);
                  if (successEvent) {
                    // Fire-and-forget — errors caught in outer try/catch
                    sendSuccessNotification(storeId, store.name || storeId, {
                      chatId,
                      clientName: existing.client_name || 'Покупатель',
                      productName: productName || null,
                      messageText: msgPreview,
                      event: successEvent,
                    }).catch((err: any) => {
                      console.error(`[OZON-CHATS] Success notification error for chat ${chatId}: ${err.message}`);
                    });
                  }
                }
              }
            } else if (latestSender === 'seller') {
              if (existing.status === 'closed') {
                // Reopen closed chat
                await dbHelpers.updateChat(chatId, {
                  status: 'in_progress' as ChatStatus,
                  status_updated_at: new Date().toISOString(),
                  completion_reason: null,
                });
                console.log(`[OZON-CHATS] Chat ${chatId}: closed → in_progress (seller replied)`);
                statusTransitions++;
              } else if (existing.status !== 'in_progress') {
                // Protection: don't move awaiting_reply → in_progress if active auto-sequence
                // (auto-mailing messages should not move chat out of "Ожидание")
                let skipTransition = false;
                if (existing.status === 'awaiting_reply') {
                  const activeSeq = await dbHelpers.getActiveSequenceForChat(chatId);
                  if (activeSeq) {
                    skipTransition = true;
                  }
                }
                if (!skipTransition) {
                  await dbHelpers.updateChat(chatId, {
                    status: 'in_progress' as ChatStatus,
                    status_updated_at: new Date().toISOString(),
                  });
                  console.log(`[OZON-CHATS] Chat ${chatId}: ${existing.status} → in_progress (seller replied)`);
                  statusTransitions++;
                }
              }
            }

            // Clear draft when new message arrives (draft is outdated)
            if (existing.draft_reply) {
              await dbHelpers.updateChat(chatId, {
                draft_reply: null,
                draft_reply_generated_at: null,
                draft_reply_edited: null,
              });
            }
          } catch (transErr: any) {
            console.error(`[OZON-CHATS] Status transition error for chat ${chatId}: ${transErr.message}`);
          }

          // Step 3b: Auto-classify tag based on latest message (regex, no AI)
          if (latestText && latestSender && existing?.product_nm_id) {
            try {
              const currentTag = (existing.tag as any) || null;
              let newTag: string | null = null;

              if (latestSender === 'seller') {
                if (isOfferMessage(latestText) && canAutoOverwriteTag(currentTag, 'deletion_offered')) {
                  newTag = 'deletion_offered';
                }
              } else if (latestSender === 'client') {
                if (isConfirmationMessage(latestText, 'client') && canAutoOverwriteTag(currentTag, 'deletion_confirmed')) {
                  newTag = 'deletion_confirmed';
                } else if (isAgreementMessage(latestText) && canAutoOverwriteTag(currentTag, 'deletion_agreed')) {
                  newTag = 'deletion_agreed';
                }
              }

              if (newTag && newTag !== currentTag) {
                await dbHelpers.updateChat(chatId, { tag: newTag });
                console.log(`[OZON-CHATS] Tag auto-classified: chat ${chatId} ${currentTag || 'null'} → ${newTag}`);
              }
            } catch (tagErr: any) {
              console.error(`[OZON-CHATS] Tag classification error for chat ${chatId}: ${tagErr.message}`);
            }
          }
        }

      } catch (err: any) {
        console.error(`[OZON-CHATS] Error processing chat ${chatId}: ${err.message}`);
        chatErrors++;
      }
    }

    // Step 3.5 REMOVED: OZON trigger phrase detection removed.
    // Sequences are now started manually from TG mini app.
    const triggersDetected = 0;

    // Step 5a-tg: Send Telegram notifications for OZON client replies
    // OZON chats don't have review_chat_links — notify for all seller-initiated chats (product_nm_id IS NOT NULL)
    if (clientRepliedChats.length > 0) {
      try {
        // For OZON: all chats with product_nm_id are work-relevant (seller-initiated)
        // No rcl filter needed — OZON has no extension to create review_chat_links
        if (clientRepliedChats.length > 0) {
          await sendTelegramNotifications(storeId, store.name || storeId, clientRepliedChats);
        }
        console.log(`[OZON-CHATS] TG notifications: ${clientRepliedChats.length} chats`);
      } catch (tgErr: any) {
        console.error(`[OZON-CHATS] TG notification error (non-critical): ${tgErr.message}`);
      }
    }

    // Step 4 REMOVED: AI tag classification disabled (migration 024).
    // Tags are now set: deletion_candidate (auto on link creation),
    // deletion_offered/agreed/confirmed (manual from TG Mini App).
    const classified = 0;

    // Step 4.5: Batch seed ozon_last_message_id for existing chats
    if (seedBatch.length > 0) {
      const BATCH_SIZE = 5000;
      for (let i = 0; i < seedBatch.length; i += BATCH_SIZE) {
        const batch = seedBatch.slice(i, i + BATCH_SIZE);
        const values = batch.map((_, idx) => `($${idx * 2 + 1}, $${idx * 2 + 2})`).join(',');
        const params = batch.flatMap(b => [b.id, b.lastMsgId]);
        await query(
          `UPDATE chats SET ozon_last_message_id = v.last_msg_id
           FROM (VALUES ${values}) AS v(chat_id, last_msg_id)
           WHERE chats.id = v.chat_id`,
          params
        );
      }
      console.log(`[OZON-CHATS] Seeded ozon_last_message_id for ${seedBatch.length} chats`);
    }

    // Step 5: Update store stats (COUNT only — no need to load all rows)
    const totalChatsResult = await query<{ cnt: string }>(
      'SELECT count(*) as cnt FROM chats WHERE store_id = $1',
      [storeId]
    );
    await dbHelpers.updateStore(storeId, {
      last_chat_update_status: 'success',
      last_chat_update_date: new Date().toISOString(),
      total_chats: parseInt(totalChatsResult.rows[0].cnt, 10),
    });

    const message = `OZON chats synced: ${chatsProcessed} processed, ${chatsSeeded} seeded, ${chatsSkipped} skipped (no changes), ${newMessagesTotal} msgs, ${statusTransitions} transitions, ${triggersDetected} triggers, ${clientRepliedChats.length} notifs, ${classified} classified, ${chatErrors} errors`;
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
