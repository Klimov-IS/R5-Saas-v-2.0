import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';
import { query } from '@/db/client';
import { verifyApiKey } from '@/lib/server-utils';
import type { ChatStatus } from '@/db/helpers';
// Tag classification: regex-based (replaced AI in migration 024)
import { isOfferMessage, isAgreementMessage, isConfirmationMessage } from '@/lib/tag-classifier';
import { canAutoOverwriteTag } from '@/lib/chat-transitions';
import { sendTelegramNotifications, sendSuccessNotification } from '@/lib/telegram-notifications';
import { detectSuccessEvent } from '@/lib/success-detector';
import { refreshOzonChats } from '@/lib/ozon-chat-sync';
import { reconcileChatWithLink, isReviewResolvedForChat } from '@/db/review-chat-link-helpers';

/**
 * Deterministic int32 hash from storeId for advisory lock.
 */
function hashStoreId(storeId: string): number {
    let hash = 0;
    for (let i = 0; i < storeId.length; i++) {
        hash = ((hash << 5) - hash + storeId.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
}

/**
 * Update dialogues (chats) and messages for a store from WB Chat API
 */
async function updateDialoguesForStore(storeId: string, fullScan = false): Promise<{ success: boolean; message: string; }> {
    console.log(`[DIALOGUES] Starting dialogue update for store: ${storeId}`);

    // Advisory lock: prevent concurrent syncs for the same store (M-2)
    const lockId = hashStoreId(storeId);
    const lockResult = await query('SELECT pg_try_advisory_lock($1) as acquired', [lockId]);
    if (!lockResult.rows[0]?.acquired) {
        console.log(`[DIALOGUES] Skipping store ${storeId}: sync already running (advisory lock)`);
        return { success: true, message: `Sync already running for store ${storeId}, skipped` };
    }

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
                }
            } catch (err) {
                // Non-fatal: reconciliation failure shouldn't break sync
            }
        }
        if (reconciledCount > 0) {
            console.log(`[DIALOGUES] Reconciled ${reconciledCount} extension-opened chat links.`);
        }

        // --- Step 3.5b: Immediately close chats with resolved reviews ---
        // Checks ALL synced chats (not only reconciled) because review status
        // may have changed since last sync (e.g. complaint got approved between syncs)
        let resolvedClosedCount = 0;
        for (const activeChat of activeChats) {
            if (!activeChat.chatID) continue;
            try {
                const chatRecord = existingChatMap.get(activeChat.chatID);
                if (chatRecord && chatRecord.status === 'closed') continue; // already closed

                const { resolved, reason } = await isReviewResolvedForChat(activeChat.chatID);
                if (resolved) {
                    // Use specific reason for temporarily_hidden, generic for others
                    const completionReason = (reason === 'review_temporarily_hidden'
                        ? 'temporarily_hidden' : 'review_resolved') as dbHelpers.CompletionReason;
                    await dbHelpers.updateChatWithAudit(
                        activeChat.chatID,
                        {
                            status: 'closed' as dbHelpers.ChatStatus,
                            completion_reason: completionReason,
                            status_updated_at: new Date().toISOString(),
                        },
                        { changedBy: null, source: 'sync_dialogue' },
                        chatRecord || undefined
                    );
                    // Stop active sequence if any
                    const activeSeq = await dbHelpers.getActiveSequenceForChat(activeChat.chatID);
                    if (activeSeq) {
                        await dbHelpers.stopSequence(activeSeq.id, reason || 'review_resolved');
                    }
                    resolvedClosedCount++;
                }
            } catch (err) {
                // Non-fatal: resolved check failure shouldn't break sync
            }
        }
        if (resolvedClosedCount > 0) {
            console.log(`[DIALOGUES] Auto-closed ${resolvedClosedCount} chats with resolved reviews.`);
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
        if (allEvents.length > 0) {
            // Track latest message per chat for updating last_message fields
            const latestMessagesPerChat: { [chatId: string]: any } = {};

            for (const event of allEvents) {
                if (event.eventType === 'message' && event.chatID) {
                    const chatId = event.chatID;

                    // Skip messages for chats not in our database (WB events can reference inactive/closed chats)
                    if (!knownChatIds.has(chatId)) {
                        continue;
                    }

                    // Save message (skip if auto-sequence already recorded it)
                    const msgText = event.message?.text || '';
                    if (event.sender === 'seller' && msgText) {
                        const isDupe = await query(
                            `SELECT 1 FROM chat_messages
                             WHERE chat_id = $1 AND sender = 'seller' AND is_auto_reply = true
                               AND text = $2 AND timestamp >= $3::timestamptz - interval '5 minutes'
                               AND timestamp <= $3::timestamptz + interval '5 minutes'
                             LIMIT 1`,
                            [chatId, msgText, event.addTime]
                        );
                        if (isDupe.rows.length > 0) continue;
                    }

                    // Extract attachment URL from WB API (images array in message.attachments)
                    const attachmentUrl = event.message?.attachments?.images?.[0]?.url || null;

                    const messagePayload: Omit<dbHelpers.ChatMessage, 'created_at'> = {
                        id: event.eventID,
                        chat_id: chatId,
                        store_id: storeId,
                        owner_id: ownerId,
                        marketplace: 'wb',
                        text: msgText,
                        sender: event.sender,
                        timestamp: event.addTime,
                        download_id: attachmentUrl,
                    };

                    await dbHelpers.upsertChatMessage(messagePayload);

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
                        const result = await dbHelpers.updateChatWithAudit(
                            chatId, updates,
                            { changedBy: null, source: 'sync_dialogue' },
                            existingChat,
                            { expectedStatusUpdatedAt: existingChat.status_updated_at }
                        );
                        if (result) {
                            console.log(`[DIALOGUES] Chat ${chatId}: ${existingChat.status} → inbox (client replied)`);
                        }
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
                    // Seller replied → move to in_progress (unless closed or awaiting_reply with active sequence)
                    if (existingChat && existingChat.status !== 'in_progress' && existingChat.status !== 'closed') {
                        // If chat is awaiting_reply with active auto-sequence, keep it there
                        // (auto-mailing messages should not move chat to in_progress)
                        let skipTransition = false;
                        if (existingChat.status === 'awaiting_reply') {
                            const activeSeq = await dbHelpers.getActiveSequenceForChat(chatId);
                            if (activeSeq) {
                                skipTransition = true;
                            }
                        }
                        if (!skipTransition) {
                            const result = await dbHelpers.updateChatWithAudit(
                                chatId,
                                {
                                    status: 'in_progress' as ChatStatus,
                                    status_updated_at: new Date().toISOString(),
                                },
                                { changedBy: null, source: 'sync_dialogue' },
                                existingChat,
                                { expectedStatusUpdatedAt: existingChat.status_updated_at }
                            );
                            if (result) {
                                console.log(`[DIALOGUES] Chat ${chatId}: ${existingChat.status} → in_progress (seller replied)`);
                            }
                        }
                    }
                    // Reopen closed chats when seller sends a new message
                    if (existingChat && existingChat.status === 'closed') {
                        const result = await dbHelpers.updateChatWithAudit(
                            chatId,
                            {
                                status: 'in_progress' as ChatStatus,
                                status_updated_at: new Date().toISOString(),
                                completion_reason: null,
                            },
                            { changedBy: null, source: 'sync_dialogue' },
                            existingChat,
                            { expectedStatusUpdatedAt: existingChat.status_updated_at }
                        );
                        if (result) {
                            console.log(`[DIALOGUES] Chat ${chatId}: closed → in_progress (seller replied)`);
                        }
                    }
                }
            }

            // Fetch review-linked chat IDs once (used for tag classification + TG notifications)
            const linkedResult = await query<{ chat_id: string }>(
                `SELECT chat_id FROM review_chat_links WHERE store_id = $1 AND chat_id IS NOT NULL`,
                [storeId]
            );
            const reviewLinkedChatIds = new Set(linkedResult.rows.map(r => r.chat_id));

            // --- Step 5-tag: Auto-classify tags based on new messages (regex, no AI) ---
            try {
                let tagUpdates = 0;
                for (const chatId in latestMessagesPerChat) {
                    if (!reviewLinkedChatIds.has(chatId)) continue;

                    const latestMsg = latestMessagesPerChat[chatId];
                    const msgText = latestMsg.message?.text;
                    if (!msgText) continue;

                    const existingChat = existingChatMap.get(chatId);
                    const currentTag = (existingChat?.tag as any) || null;

                    let newTag: string | null = null;

                    if (latestMsg.sender === 'seller') {
                        if (isOfferMessage(msgText) && canAutoOverwriteTag(currentTag, 'deletion_offered')) {
                            newTag = 'deletion_offered';
                        }
                    } else if (latestMsg.sender === 'client') {
                        // Check confirmed first (higher priority than agreed)
                        if (isConfirmationMessage(msgText, 'client') && canAutoOverwriteTag(currentTag, 'deletion_confirmed')) {
                            newTag = 'deletion_confirmed';
                        } else if (isAgreementMessage(msgText) && canAutoOverwriteTag(currentTag, 'deletion_agreed')) {
                            newTag = 'deletion_agreed';
                        }
                    }

                    if (newTag && newTag !== currentTag) {
                        await dbHelpers.updateChat(chatId, { tag: newTag });
                        console.log(`[DIALOGUES] Tag auto-classified: chat ${chatId} ${currentTag || 'null'} → ${newTag}`);
                        tagUpdates++;
                    }
                }
                if (tagUpdates > 0) {
                    console.log(`[DIALOGUES] Tag classification: ${tagUpdates} chats updated`);
                }
            } catch (classifyErr: any) {
                console.error(`[DIALOGUES] Tag classification error (non-critical):`, classifyErr.message);
            }

            // --- Step 5a-tg: Send Telegram notifications for new client replies ---
            try {
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

            // --- Step 5b REMOVED: Auto-sequence trigger detection removed ---
            // Sequences are now started manually from TG mini app.
            // Old logic: detected trigger phrases in seller messages → auto-created sequences.
            // New logic: user starts sequences manually via "Запустить рассылку" button.

            // Step 6: Tag classification now handled by regex in Step 5-tag above.
            // AI classification disabled (migration 024). Regex classifier: src/lib/tag-classifier.ts
        }

        // --- Step 7: Recalculate stats for the store ---
        console.log(`[DIALOGUES] Recalculating final stats for store ${storeId}.`);
        const allStoreChats = await dbHelpers.getChats(storeId);
        const totalChats = allStoreChats.length;

        // Tag counts (simplified: 4 deletion workflow tags + untagged)
        const chatTagCounts: Record<string, number> = {
            untagged: 0,
            deletion_candidate: 0,
            deletion_offered: 0,
            deletion_agreed: 0,
            deletion_confirmed: 0,
        };

        allStoreChats.forEach(chat => {
            const tag = chat.tag || 'untagged';
            if (chatTagCounts.hasOwnProperty(tag)) {
                chatTagCounts[tag]++;
            } else {
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
    } finally {
        // Release advisory lock
        await query('SELECT pg_advisory_unlock($1)', [lockId]).catch(() => {});
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
