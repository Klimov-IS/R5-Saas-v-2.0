import { NextRequest, NextResponse } from 'next/server';
import { getChatById, getChatMessages, updateChat, updateChatStatus, getStoreById } from '@/db/helpers';
import { generateChatReply } from '@/ai/flows/generate-chat-reply-flow';
import { buildStoreInstructions, detectConversationPhase } from '@/lib/ai-context';
import { sendChatMessage } from '@/lib/wb-chat-api';
import { createOzonClient } from '@/lib/ozon-api';
import type { ChatStatus } from '@/db/helpers';

type BulkAction = 'generate' | 'send' | 'change_status';

/**
 * POST /api/stores/[storeId]/chats/bulk-actions
 * Perform bulk actions on multiple chats (generate, send, change status)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { storeId: string } }
) {
  try {
    const { storeId } = params;
    const body = await request.json();
    const { chatIds, action, status }: {
      chatIds: string[];
      action: BulkAction;
      status?: ChatStatus;
    } = body;

    // ⚠️ CRITICAL SAFETY: Require explicit chatIds array
    if (!chatIds || chatIds.length === 0) {
      return NextResponse.json(
        { error: 'chatIds array is required and cannot be empty' },
        { status: 400 }
      );
    }

    if (!action || !['generate', 'send', 'change_status'].includes(action)) {
      return NextResponse.json(
        { error: 'action is required and must be one of: generate, send, change_status' },
        { status: 400 }
      );
    }

    if (action === 'change_status' && !status) {
      return NextResponse.json(
        { error: 'status is required when action is change_status' },
        { status: 400 }
      );
    }

    const results = {
      total: chatIds.length,
      successful: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Fetch store for marketplace-aware dispatch
    const store = await getStoreById(storeId);
    const isOzon = store?.marketplace === 'ozon' && store.ozon_client_id && store.ozon_api_key;

    // Process each chat
    for (const chatId of chatIds) {
      try {
        const chat = await getChatById(chatId);

        if (!chat) {
          results.failed++;
          results.errors.push(`Chat ${chatId} not found`);
          continue;
        }

        switch (action) {
          case 'generate': {
            // Generate AI reply
            const messages = await getChatMessages(chatId);
            const chatHistory = messages
              .map((msg) => `[${msg.sender === 'client' ? 'Клиент' : 'Продавец'}]: ${msg.text}`)
              .join('\n');

            // Detect conversation phase for stage-aware AI replies
            const phase = detectConversationPhase(messages);

            const context = `
**Информация о магазине:**
Название: ${store?.name || storeId}

**Товар:**
Название: ${chat.product_name || 'Неизвестно'}
Артикул WB: ${chat.product_nm_id}

**Клиент:**
Имя: ${chat.client_name}

**Фаза диалога:** ${phase.phaseLabel}
**Сообщений от клиента:** ${phase.clientMessageCount}

**История переписки:**
${chatHistory}
            `.trim();

            const aiResult = await generateChatReply({
              context,
              storeId,
              ownerId: chat.owner_id,
              chatId,
              storeInstructions: await buildStoreInstructions(storeId, store?.ai_instructions, store?.marketplace),
            });

            // Save draft to database
            await updateChat(chatId, {
              draft_reply: aiResult.text,
              draft_reply_generated_at: new Date().toISOString(),
              draft_reply_edited: false,
            });

            results.successful++;
            break;
          }

          case 'send': {
            // Send draft reply to WB
            if (!chat.draft_reply) {
              results.failed++;
              results.errors.push(`Chat ${chatId}: No draft reply to send`);
              continue;
            }

            try {
              // Send message via marketplace-aware dispatch
              if (isOzon) {
                const ozonClient = createOzonClient(store!.ozon_client_id!, store!.ozon_api_key!);
                await ozonClient.sendChatMessage(chatId, chat.draft_reply);
              } else {
                await sendChatMessage(storeId, chatId, chat.draft_reply);
              }

              // Mark as sent and clear draft
              await updateChat(chatId, {
                draft_reply: null,
                draft_reply_thread_id: null,
                draft_reply_generated_at: null,
                draft_reply_edited: null,
                last_message_text: chat.draft_reply,
                last_message_sender: 'seller',
                last_message_date: new Date().toISOString(),
              });

              // Update status to awaiting_reply after sending
              await updateChatStatus(chatId, 'awaiting_reply');

              results.successful++;
            } catch (sendError: any) {
              // If WB API fails, don't mark as sent
              results.failed++;
              results.errors.push(`Chat ${chatId}: Failed to send via WB API - ${sendError.message}`);
              console.error(`Failed to send message to WB for chat ${chatId}:`, sendError);
            }
            break;
          }

          case 'change_status': {
            // Change chat status
            await updateChatStatus(chatId, status!);
            results.successful++;
            break;
          }
        }
      } catch (error: any) {
        results.failed++;
        results.errors.push(`Chat ${chatId}: ${error.message}`);
        console.error(`Failed to process bulk action for chat ${chatId}:`, error);
      }
    }

    console.log(`✅ [API] Bulk action completed: ${action} on ${results.successful}/${results.total} chats`);

    return NextResponse.json({
      success: true,
      results,
    }, { status: 200 });

  } catch (error: any) {
    console.error('[API ERROR] POST /api/stores/[storeId]/chats/bulk-actions:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
