import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';
import { query } from '@/db/client';
import { verifyApiKey } from '@/lib/server-utils';
import type { ChatTag, ChatStatus } from '@/db/helpers';
import { classifyChatDeletion } from '@/ai/flows/classify-chat-deletion-flow';
import { DEFAULT_TRIGGER_PHRASE, DEFAULT_FOLLOWUP_TEMPLATES, DEFAULT_FOLLOWUP_TEMPLATES_4STAR } from '@/lib/auto-sequence-templates';
import { buildStoreInstructions } from '@/lib/ai-context';
import { sendTelegramNotifications, sendSuccessNotification } from '@/lib/telegram-notifications';
import { detectSuccessEvent } from '@/lib/success-detector';
import { refreshOzonChats } from '@/lib/ozon-chat-sync';
import { reconcileChatWithLink } from '@/db/review-chat-link-helpers';
import { canAutoOverwriteTag } from '@/lib/chat-transitions';
import { maybeStartAutoSequence } from '@/lib/auto-sequence-launcher';

/**
 * Update dialogues (chats) and messages for a store from WB Chat API
 */
async function updateDialoguesForStore(storeId: string, fullScan = false): Promise<{ success: boolean; message: string; }> {
    console.log(`[DIALOGUES] Starting dialogue update for store: ${storeId}`);

    try {
        // Update status to pending
        await dbHelpers.updateStore(storeId, {
            last_chat_update_status: 'pending',
            last_chat_update_date: new Date().toISOString()
        });

        // Get store
        const store = await dbHelpers.getStoreById(storeId);
        if (!store) throw new Error(`Store with ID ${storeId} not found.`);

        // OZON stores: use OZON chat sync
        // ?fullScan=true triggers hourly safety scan (all opened chats); default = unread-only
        if (store.marketplace === 'ozon') {
            const message = await refreshOzonChats(storeId, fullScan);
            return { success: true, message };
        }

        const ownerId = store.owner_id;
        if (!ownerId) throw new Error(`OwnerID is missing for store ${storeId}.`);

        // Get WB token
        const token = store.chat_api_token || store.api_token;
        if (!token) throw new Error(`Chat API token not configured for store ${storeId}.`);

        // --- Step 1: Fetch all active chats from WB API ---
        console.log(`[DIALOGUES] Fetching active chats for store ${storeId}...`);
        const chatsResponse = await fetch('https://buyer-chat-api.wildberries.ru/api/v1/seller/chats', {
            headers: { 'Authorization': token }
        });

        if (!chatsResponse.ok) {
            throw new Error(`Error fetching WB chats: ${chatsResponse.status} ${chatsResponse.statusText}`);
        }

        const chatsData = await chatsResponse.json();
        const activeChats = chatsData.result || [];
        console.log(`[DIALOGUES] Found ${activeChats.length} active chats.`);

        // --- Step 2: Get existing chats to preserve tags ---
        const existingChats = await dbHelpers.getChats(storeId);
        const existingChatMap = new Map(existingChats.map(c => [c.id, c]));

        // Build set of active product nmIds (work_in_chats = TRUE) for TG notification filter
        // Only send TG notifications for client replies on active products (matches queue filter)
        const productsWithRules = await dbHelpers.getProductsWithRules(storeId);
        const activeNmIds = new Set(
            productsWithRules
                .filter(p => p.rule?.work_in_chats === true && p.wb_product_id)
                .map(p => String(p.wb_product_id))
        );

        // --- Step 3: Update/create chat documents ---
        for (const activeChat of activeChats) {
            if (!activeChat.chatID) continue;

            const existingChat = existingChatMap.get(activeChat.chatID);

            const chatPayload: Omit<dbHelpers.Chat, 'created_at' | 'updated_at'> = {
                id: activeChat.chatID,
                store_id: storeId,
                owner_id: ownerId,
                marketplace: 'wb',
                client_name: activeChat.clientName,
                reply_sign: activeChat.replySign,
                product_nm_id: activeChat.goodCard?.nmID ? String(activeChat.goodCard.nmID) : null,
                product_name: existingChat?.product_name || null,
                product_vendor_code: existingChat?.product_vendor_code || null,
                last_message_date: existingChat?.last_message_date || null,
                last_message_text: existingChat?.last_message_text || null,
                last_message_sender: existingChat?.last_message_sender || null,
                tag: existingChat?.tag || null,
                status: existingChat?.status || 'inbox', // NEW: Preserve Kanban status
                draft_reply: existingChat?.draft_reply || null,
                draft_reply_thread_id: existingChat?.draft_reply_thread_id || null,
            };

            await dbHelpers.upsertChat(chatPayload);
        }

        console.log(`[DIALOGUES] Updated/Created ${activeChats.length} chat documents.`);

        // --- Step 3.5: Reconcile extension-opened chats ---
        // For each synced chat, check if there's a pending review_chat_link
        // and set chat_id so the link is complete
        let reconciledCount = 0;
        for (const activeChat of activeChats) {
            if (!activeChat.chatID) continue;
            try {
                const reconciled = await reconcileChatWithLink(activeChat.chatID, storeId);
                if (reconciled) {
                    reconciledCount++;
                    // Auto-launch 30-day sequence for review-linked chats (WB only)
                    await maybeStartAutoSequence(activeChat.chatID, storeId);
                }
            } catch (err) {
                // Non-fatal: reconciliation failure shouldn't break sync
            }
        }
        if (reconciledCount > 0) {
            console.log(`[DIALOGUES] Reconciled ${reconciledCount} extension-opened chat links.`);
        }

        // Build set of all known chat IDs (existing in DB + just upserted from WB active list)
        const knownChatIds = new Set<string>([
            ...Array.from(existingChatMap.keys()),
            ...activeChats.map((c: any) => c.chatID).filter(Boolean),
        ]);

        // --- Step 4: Fetch new message events from WB API ---
        let allEvents: any[] = [];
        let next = store.last_chat_update_next || null;
        let finalNext = next;
        let hasMore = true;

        console.log(`[DIALOGUES] Fetching new message events starting from cursor: ${next}`);

        while (hasMore) {
            const eventsUrl = new URL('https://buyer-chat-api.wildberries.ru/api/v1/seller/events');
            if (next) eventsUrl.searchParams.set('next', next);

            const eventsResponse = await fetch(eventsUrl.toString(), {
                headers: { 'Authorization': token }
            });

            if (!eventsResponse.ok) {
                throw new Error(`Error fetching WB events: ${eventsResponse.status} ${eventsResponse.statusText}`);
            }

            const eventsData = await eventsResponse.json();
            const events = (Array.isArray(eventsData.result?.events) ? eventsData.result.events : []) || [];
            allEvents.push(...events);

            finalNext = eventsData.result?.next || finalNext;
            hasMore = !!eventsData.result?.next && events.length > 0;

            if (hasMore) {
                next = eventsData.result.next;
                await new Promise(res => setTimeout(res, 1500)); // API rate limiting
            }
        }

        console.log(`[DIALOGUES] Fetched ${allEvents.length} new message events.`);

        // --- Step 5: Process and save new messages ---
        const chatsToClassify = new Set<string>();

        if (allEvents.length > 0) {
            // Track latest message per chat for updating last_message fields
            const latestMessagesPerChat: { [chatId: string]: any } = {};
            // Track new seller messages per chat for trigger detection
            const newSellerMessagesByChat: { [chatId: string]: string[] } = {};

            for (const event of allEvents) {
                if (event.eventType === 'message' && event.chatID) {
                    const chatId = event.chatID;

                    // Skip messages for chats not in our database (WB events can reference inactive/closed chats)
                    if (!knownChatIds.has(chatId)) {
                        continue;
                    }

                    chatsToClassify.add(chatId); // Mark chat for re-classification (Sprint 3)

                    // Save message
                    const messagePayload: Omit<dbHelpers.ChatMessage, 'created_at'> = {
                        id: event.eventID,
                        chat_id: chatId,
                        store_id: storeId,
                        owner_id: ownerId,
                        marketplace: 'wb',
                        text: event.message?.text || '',
                        sender: event.sender,
                        timestamp: event.addTime,
                        download_id: event.downloadID || null,
                    };

                    await dbHelpers.upsertChatMessage(messagePayload);

                    // Track seller messages for trigger detection
                    if (event.sender === 'seller' && event.message?.text) {
                        if (!newSellerMessagesByChat[chatId]) newSellerMessagesByChat[chatId] = [];
                        newSellerMessagesByChat[chatId].push(event.message.text);
                    }

                    // Track latest message
                    if (!latestMessagesPerChat[chatId] || new Date(event.addTime) > new Date(latestMessagesPerChat[chatId].addTime)) {
                        latestMessagesPerChat[chatId] = event;
                    }
                }
            }

            // Update chat documents with latest message info
            for (const chatId in latestMessagesPerChat) {
                const latestMsg = latestMessagesPerChat[chatId];
                await dbHelpers.updateChat(chatId, {
                    last_message_text: latestMsg.message?.text || 'Вложение',
                    last_message_date: latestMsg.addTime,
                    last_message_sender: latestMsg.sender,
                    // Clear draft when new message arrives (draft is outdated)
                    draft_reply: null,
                    draft_reply_generated_at: null,
                    draft_reply_edited: null,
                });

                // Auto-set status based on who sent the last message
                const existingChat = existingChatMap.get(chatId);
                if (latestMsg.sender === 'client') {
                    // Client replied → always move to inbox
                    if (existingChat && existingChat.status !== 'inbox') {
                        const updates: any = {
                            status: 'inbox',
                            status_updated_at: new Date().toISOString(),
                        };
                        if (existingChat.status === 'closed') {
                            updates.completion_reason = null;
                        }
                        await dbHelpers.updateChat(chatId, updates);
                        console.log(`[DIALOGUES] Chat ${chatId}: ${existingChat.status} → inbox (client replied)`);
                    }

                    // Stop auto-sequence if client replied
                    try {
                        const activeSeq = await dbHelpers.getActiveSequenceForChat(chatId);
                        if (activeSeq) {
                            await dbHelpers.stopSequence(activeSeq.id, 'client_replied');
                            console.log(`[DIALOGUES] 🛑 Auto-sequence stopped for chat ${chatId} (client replied)`);
                        }
                    } catch (seqErr: any) {
                        console.error(`[DIALOGUES] Failed to stop auto-sequence for chat ${chatId}:`, seqErr.message);
                    }
                } else if (latestMsg.sender === 'seller') {
                    // Seller replied → move to in_progress (unless closed)
                    if (existingChat && existingChat.status !== 'in_progress' && existingChat.status !== 'closed') {
                        await dbHelpers.updateChat(chatId, {
                            status: 'in_progress' as ChatStatus,
                            status_updated_at: new Date().toISOString(),
                        });
                        console.log(`[DIALOGUES] Chat ${chatId}: ${existingChat.status} → in_progress (seller replied)`);
                    }
                    // Reopen closed chats when seller sends a new message
                    if (existingChat && existingChat.status === 'closed') {
                        await dbHelpers.updateChat(chatId, {
                            status: 'in_progress' as ChatStatus,
                            status_updated_at: new Date().toISOString(),
                            completion_reason: null,
                        });
                        console.log(`[DIALOGUES] Chat ${chatId}: closed → in_progress (seller replied)`);
                    }
                }
            }

            // --- Step 5a-tg: Send Telegram notifications for new client replies ---
            try {
                // Only notify for review-linked chats (chats we opened for complaint follow-up)
                const linkedResult = await query<{ chat_id: string }>(
                    `SELECT chat_id FROM review_chat_links WHERE store_id = $1 AND chat_id IS NOT NULL`,
                    [storeId]
                );
                const reviewLinkedChatIds = new Set(linkedResult.rows.map(r => r.chat_id));

                const clientRepliedChats: Array<{ chatId: string; clientName: string; productName: string | null; messagePreview: string | null }> = [];
                for (const chatId in latestMessagesPerChat) {
                    if (latestMessagesPerChat[chatId].sender === 'client') {
                        // Filter: only notify for review-linked chats (synced with TG queue filter)
                        if (!reviewLinkedChatIds.has(chatId)) continue;
                        const chatInfo = existingChatMap.get(chatId);
                        const msgText = latestMessagesPerChat[chatId].message?.text || null;
                        clientRepliedChats.push({
                            chatId,
                            clientName: chatInfo?.client_name || 'Клиент',
                            productName: chatInfo?.product_name || null,
                            messagePreview: msgText,
                        });

                        // Detect success event (deleted/upgraded review)
                        if (msgText) {
                            const successEvent = detectSuccessEvent(msgText);
                            if (successEvent) {
                                await sendSuccessNotification(storeId, store.name || storeId, ownerId, {
                                    chatId,
                                    clientName: chatInfo?.client_name || 'Клиент',
                                    productName: chatInfo?.product_name || null,
                                    messageText: msgText,
                                    event: successEvent,
                                });
                            }
                        }
                    }
                }
                if (clientRepliedChats.length > 0) {
                    await sendTelegramNotifications(storeId, store.name || storeId, ownerId, clientRepliedChats);
                }
            } catch (tgErr: any) {
                console.error(`[DIALOGUES] TG notification error (non-critical):`, tgErr.message);
            }

            // --- Step 5b: Trigger detection — auto-tag + auto-sequence for outreach messages ---
            // Supports two trigger sets: negatives (1-2-3 stars) and 4-star reviews
            const settings = await dbHelpers.getUserSettings();
            const triggerPhrase = settings?.no_reply_trigger_phrase || DEFAULT_TRIGGER_PHRASE;
            const triggerPhrase2 = settings?.no_reply_trigger_phrase2 || null; // 4-star trigger (null = disabled)

            for (const chatId of Object.keys(newSellerMessagesByChat)) {
                try {
                    const sellerTexts = newSellerMessagesByChat[chatId];

                    // Check which trigger matched (set 1 = negatives, set 2 = 4-star)
                    const matchedSet1 = sellerTexts.some(text => text.includes(triggerPhrase));
                    const matchedSet2 = triggerPhrase2 ? sellerTexts.some(text => text.includes(triggerPhrase2)) : false;

                    if (!matchedSet1 && !matchedSet2) continue;

                    // Check current chat state (avoid re-processing)
                    const chat = await dbHelpers.getChatById(chatId);
                    if (!chat) continue;

                    // Skip if already tagged as deletion workflow or already has active sequence
                    const deletionTags: ChatTag[] = [
                        'deletion_candidate', 'deletion_offered', 'deletion_agreed',
                        'deletion_confirmed', 'refund_requested'
                    ];
                    if (chat.tag && deletionTags.includes(chat.tag as ChatTag)) continue;

                    // Determine which template set to use
                    const is4Star = matchedSet2 && !matchedSet1; // Prefer set 1 if both match
                    const sequenceType = is4Star ? 'no_reply_followup_4star' : 'no_reply_followup';

                    // Tag as deletion_candidate + set in_progress (cron will move to awaiting_reply after 2 days)
                    await dbHelpers.updateChat(chatId, {
                        tag: 'deletion_candidate' as ChatTag,
                        status: 'in_progress' as ChatStatus,
                        status_updated_at: new Date().toISOString(),
                    });

                    // Create auto-sequence if none exists
                    const existingSeq = await dbHelpers.getActiveSequenceForChat(chatId);
                    if (!existingSeq) {
                        let templates;
                        if (is4Star) {
                            templates = settings?.no_reply_messages2?.length
                                ? settings.no_reply_messages2.map((text: string, i: number) => ({ day: i + 1, text }))
                                : DEFAULT_FOLLOWUP_TEMPLATES_4STAR;
                        } else {
                            templates = settings?.no_reply_messages?.length
                                ? settings.no_reply_messages.map((text: string, i: number) => ({ day: i + 1, text }))
                                : DEFAULT_FOLLOWUP_TEMPLATES;
                        }
                        await dbHelpers.createAutoSequence(chatId, chat.store_id, chat.owner_id, templates, sequenceType);
                        console.log(`[DIALOGUES] 🎯 Trigger detected in chat ${chatId} → deletion_candidate + in_progress + sequence [${sequenceType}] (${templates.length} msgs)`);
                    } else {
                        console.log(`[DIALOGUES] 🎯 Trigger detected in chat ${chatId} → deletion_candidate + in_progress (sequence already active)`);
                    }
                } catch (triggerErr: any) {
                    console.error(`[DIALOGUES] Trigger detection error for chat ${chatId}:`, triggerErr.message);
                }
            }

            // --- Step 6: Re-classify tags for updated chats using AI ---
            console.log(`[DIALOGUES] Starting AI tag classification for ${chatsToClassify.size} updated chats...`);

            let classifiedCount = 0;
            let errorCount = 0;

            for (const chatId of Array.from(chatsToClassify)) {
                try {
                    // Get chat messages to build history
                    const messages = await dbHelpers.getChatMessages(chatId);

                    if (messages.length === 0) {
                        console.log(`[DIALOGUES] Chat ${chatId}: No messages, skipping classification.`);
                        continue;
                    }

                    // Build chat history string
                    const chatHistory = messages.map(m =>
                        `${m.sender === 'client' ? 'Клиент' : 'Продавец'}: ${m.text || '[Вложение]'}`
                    ).join('\n');

                    // Get chat for full context
                    const chat = await dbHelpers.getChatById(chatId);

                    // Classify using AI deletion flow (hybrid regex + AI)
                    const result = await classifyChatDeletion({
                        chatHistory,
                        lastMessageText: chat?.last_message_text || '',
                        storeId,
                        ownerId,
                        chatId,
                        productName: chat?.product_name || undefined,
                        storeInstructions: await buildStoreInstructions(storeId, store.ai_instructions, store.marketplace),
                    });

                    const tag = result.tag;

                    // Protect deletion workflow tags from being overwritten by AI classification
                    const currentChat = await dbHelpers.getChatById(chatId);
                    const currentTag = (currentChat?.tag || null) as ChatTag | null;

                    if (!canAutoOverwriteTag(currentTag, tag as ChatTag)) {
                        console.log(`[DIALOGUES] Chat ${chatId}: Tag '${currentTag}' protected from AI overwrite to '${tag}'. Skipping.`);
                        continue;
                    }

                    // Update chat tag (AI classification), status remains unchanged
                    await dbHelpers.updateChat(chatId, {
                        tag,
                    });

                    classifiedCount++;
                    console.log(`[DIALOGUES] Chat ${chatId}: Classified as '${tag}'.`);

                } catch (error: any) {
                    errorCount++;
                    console.error(`[DIALOGUES] Chat ${chatId}: Classification failed - ${error.message}`);
                    // Continue processing other chats even if one fails
                }
            }

            console.log(`[DIALOGUES] AI classification complete: ${classifiedCount} successful, ${errorCount} errors.`);
        }

        // --- Step 7: Recalculate stats for the store ---
        console.log(`[DIALOGUES] Recalculating final stats for store ${storeId}.`);
        const allStoreChats = await dbHelpers.getChats(storeId);
        const totalChats = allStoreChats.length;

        // Initialize all possible tag counts (including new deletion workflow tags)
        const chatTagCounts: Record<string, number> = {
            active: 0,
            no_reply: 0,
            successful: 0,
            unsuccessful: 0,
            untagged: 0,
            completed: 0,
            // Deletion workflow tags
            deletion_candidate: 0,
            deletion_offered: 0,
            deletion_agreed: 0,
            deletion_confirmed: 0,
            refund_requested: 0,
            spam: 0,
        };

        allStoreChats.forEach(chat => {
            const tag = chat.tag || 'untagged';
            if (chatTagCounts.hasOwnProperty(tag)) {
                chatTagCounts[tag]++;
            } else {
                // Unknown tag, count as untagged
                chatTagCounts['untagged']++;
            }
        });

        console.log(`[DIALOGUES] Final stats: totalChats=${totalChats}, tagCounts=`, chatTagCounts);

        // --- Step 8: Update store status to success ---
        await dbHelpers.updateStore(storeId, {
            last_chat_update_status: 'success',
            last_chat_update_date: new Date().toISOString(),
            last_chat_update_next: finalNext,
        });

        const successMessage = `Successfully updated dialogues for store ${storeId}. Found ${activeChats.length} chats, processed ${allEvents.length} new events.`;
        console.log(`[DIALOGUES] ${successMessage}`);
        return { success: true, message: successMessage };

    } catch (error: any) {
        const errorMessage = error.message || "An unknown error occurred during dialogue update.";
        console.error(`[DIALOGUES] Failed to update dialogues for store ${storeId}:`, error);

        await dbHelpers.updateStore(storeId, {
            last_chat_update_status: 'error',
            last_chat_update_error: errorMessage
        });

        return { success: false, message: errorMessage };
    }
}

/**
 * @swagger
 * /api/stores/{storeId}/dialogues/update:
 *   post:
 *     summary: Запустить обновление диалогов для магазина
 *     description: |
 *       Синхронизирует чаты и сообщения из WB Chat API в PostgreSQL.
 *       Обновляет активные чаты, загружает новые сообщения и пересчитывает статистику.
 *       Включает AI-классификацию тегов для чатов с новыми сообщениями.
 *     tags:
 *       - Диалоги
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID магазина
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       '200':
 *         description: Успешный ответ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Successfully updated dialogues for store abc123. Found 15 chats, processed 42 new events."
 *       '401':
 *         description: Ошибка авторизации
 *       '404':
 *         description: Магазин не найден
 *       '500':
 *         description: Внутренняя ошибка сервера
 */
export async function POST(request: NextRequest, { params }: { params: { storeId: string } }) {
    const { storeId } = params;

    try {
        // Verify API key
        const authResult = await verifyApiKey(request);
        if (!authResult.authorized) {
            return NextResponse.json({ error: authResult.error }, { status: 401 });
        }

        // Check if store exists
        const store = await dbHelpers.getStoreById(storeId);
        if (!store) {
            return NextResponse.json({ error: 'Store not found.' }, { status: 404 });
        }

        // Run sync (?fullScan=true = hourly OZON safety scan)
        const fullScan = request.nextUrl.searchParams.get('fullScan') === 'true';
        const result = await updateDialoguesForStore(storeId, fullScan);

        if (!result.success) {
            return NextResponse.json({
                error: 'Dialogue update failed',
                details: result.message
            }, { status: 500 });
        }

        return NextResponse.json({
            message: result.message
        }, { status: 200 });

    } catch (error: any) {
        console.error(`[API ERROR] /api/stores/${storeId}/dialogues/update:`, error);
        return NextResponse.json({
            error: 'Internal Server Error',
            details: String(error.message || 'An unknown error occurred.')
        }, { status: 500 });
    }
}
