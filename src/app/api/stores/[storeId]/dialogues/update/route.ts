import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';
import { verifyApiKey } from '@/lib/server-utils';
import type { ChatTag } from '@/db/helpers';
import { classifyChatDeletion } from '@/ai/flows/classify-chat-deletion-flow';

/**
 * Update dialogues (chats) and messages for a store from WB Chat API
 */
async function updateDialoguesForStore(storeId: string): Promise<{ success: boolean; message: string; }> {
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

        // --- Step 3: Update/create chat documents ---
        for (const activeChat of activeChats) {
            if (!activeChat.chatID) continue;

            const existingChat = existingChatMap.get(activeChat.chatID);

            const chatPayload: Omit<dbHelpers.Chat, 'created_at' | 'updated_at'> = {
                id: activeChat.chatID,
                store_id: storeId,
                owner_id: ownerId,
                client_name: activeChat.clientName,
                reply_sign: activeChat.replySign,
                product_nm_id: activeChat.goodCard?.nmID ? String(activeChat.goodCard.nmID) : null,
                product_name: existingChat?.product_name || null,
                product_vendor_code: existingChat?.product_vendor_code || null,
                last_message_date: existingChat?.last_message_date || null,
                last_message_text: existingChat?.last_message_text || null,
                last_message_sender: existingChat?.last_message_sender || null,
                tag: existingChat?.tag || 'untagged', // Preserve existing tag or set default
                draft_reply: existingChat?.draft_reply || null,
                draft_reply_thread_id: existingChat?.draft_reply_thread_id || null,
            };

            await dbHelpers.upsertChat(chatPayload);
        }

        console.log(`[DIALOGUES] Updated/Created ${activeChats.length} chat documents.`);

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

            for (const event of allEvents) {
                if (event.eventType === 'message' && event.chatID) {
                    const chatId = event.chatID;
                    chatsToClassify.add(chatId); // Mark chat for re-classification (Sprint 3)

                    // Save message
                    const messagePayload: Omit<dbHelpers.ChatMessage, 'created_at'> = {
                        id: event.eventID,
                        chat_id: chatId,
                        store_id: storeId,
                        owner_id: ownerId,
                        text: event.message?.text || '',
                        sender: event.sender,
                        timestamp: event.addTime,
                        download_id: event.downloadID || null,
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
                });
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
                    });

                    const tag = result.tag;

                    // Update chat with new tag
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

        // Run sync
        const result = await updateDialoguesForStore(storeId);

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
