import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';
import { verifyApiKey } from '@/lib/server-utils';
import { classifyChatTag } from '@/ai/flows/classify-chat-tag-flow';
import { buildStoreInstructions } from '@/lib/ai-context';

/**
 * Force AI classification for all chats (or untagged chats only)
 * Useful for initial data load and testing
 */
async function classifyAllChatsForStore(
    storeId: string,
    options: { limit?: number; force?: boolean } = {}
): Promise<{ success: boolean; message: string; stats: any }> {
    try {
        console.log(`[CLASSIFY-ALL] Starting classification for store ${storeId}...`);

        const store = await dbHelpers.getStoreById(storeId);
        if (!store) {
            throw new Error(`Store ${storeId} not found`);
        }

        const ownerId = store.owner_id;

        // Get chats to classify
        let chatsToClassify: dbHelpers.Chat[];

        if (options.force) {
            // Classify ALL chats
            console.log(`[CLASSIFY-ALL] Force mode: classifying ALL chats`);
            chatsToClassify = await dbHelpers.getChats(storeId);
        } else {
            // Only classify untagged chats
            console.log(`[CLASSIFY-ALL] Normal mode: classifying only untagged chats`);
            const allChats = await dbHelpers.getChats(storeId);
            chatsToClassify = allChats.filter(chat => !chat.tag || chat.tag === 'untagged');
        }

        // Apply limit if specified
        if (options.limit && options.limit > 0) {
            chatsToClassify = chatsToClassify.slice(0, options.limit);
        }

        console.log(`[CLASSIFY-ALL] Found ${chatsToClassify.length} chats to classify`);

        if (chatsToClassify.length === 0) {
            return {
                success: true,
                message: 'No chats to classify',
                stats: {
                    total: 0,
                    successful: 0,
                    failed: 0,
                    skipped: 0,
                },
            };
        }

        // Classify each chat
        let successful = 0;
        let failed = 0;
        let skipped = 0;

        for (const chat of chatsToClassify) {
            try {
                // Get chat messages
                const messages = await dbHelpers.getChatMessages(chat.id);

                if (messages.length === 0) {
                    console.log(`[CLASSIFY-ALL] Chat ${chat.id}: No messages, skipping`);
                    skipped++;
                    continue;
                }

                // Build chat history
                const chatHistory = messages
                    .map(m => `${m.sender === 'client' ? 'Клиент' : 'Продавец'}: ${m.text || '[Вложение]'}`)
                    .join('\n');

                // Classify using AI
                console.log(`[CLASSIFY-ALL] Chat ${chat.id}: Calling AI classification...`);
                const { tag } = await classifyChatTag({
                    chatHistory,
                    storeId,
                    ownerId,
                    chatId: chat.id,
                    storeInstructions: await buildStoreInstructions(storeId, store.ai_instructions),
                });

                // Update chat with new tag
                await dbHelpers.updateChat(chat.id, { tag });

                successful++;
                console.log(`[CLASSIFY-ALL] Chat ${chat.id}: Classified as '${tag}' (${successful}/${chatsToClassify.length})`);

            } catch (error: any) {
                failed++;
                console.error(`[CLASSIFY-ALL] Chat ${chat.id}: Classification failed - ${error.message}`);
            }
        }

        // Recalculate stats
        const allChats = await dbHelpers.getChats(storeId);
        const chatTagCounts: Record<string, number> = {
            active: 0,
            no_reply: 0,
            successful: 0,
            unsuccessful: 0,
            untagged: 0,
            completed: 0,
            deletion_candidate: 0,
            deletion_offered: 0,
            deletion_agreed: 0,
            deletion_confirmed: 0,
            refund_requested: 0,
            spam: 0,
        };

        allChats.forEach(chat => {
            const tag = chat.tag || 'untagged';
            if (chatTagCounts.hasOwnProperty(tag)) {
                chatTagCounts[tag as dbHelpers.ChatTag]++;
            } else {
                chatTagCounts['untagged']++;
            }
        });

        // Update store stats
        await dbHelpers.updateStore(storeId, {
            chat_tag_counts: chatTagCounts,
        });

        const message = `AI classification complete: ${successful} successful, ${failed} failed, ${skipped} skipped (out of ${chatsToClassify.length} total)`;
        console.log(`[CLASSIFY-ALL] ${message}`);

        return {
            success: true,
            message,
            stats: {
                total: chatsToClassify.length,
                successful,
                failed,
                skipped,
                tagDistribution: chatTagCounts,
            },
        };

    } catch (error: any) {
        const errorMessage = error.message || 'An unknown error occurred during classification';
        console.error(`[CLASSIFY-ALL] Error: ${errorMessage}`, error);

        return {
            success: false,
            message: errorMessage,
            stats: {
                total: 0,
                successful: 0,
                failed: 0,
                skipped: 0,
            },
        };
    }
}

/**
 * @swagger
 * /api/stores/{storeId}/chats/classify-all:
 *   post:
 *     summary: Запустить массовую AI-классификацию чатов
 *     description: |
 *       Классифицирует все чаты магазина с помощью AI (или только untagged).
 *       Полезно для первоначальной загрузки данных и тестирования AI.
 *     tags:
 *       - Чаты
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID магазина
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Максимальное количество чатов для классификации (опционально)
 *       - in: query
 *         name: force
 *         schema:
 *           type: boolean
 *         description: Классифицировать все чаты, даже уже классифицированные (по умолчанию false)
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
 *                   example: "AI classification complete: 65 successful, 2 failed, 1 skipped (out of 68 total)"
 *                 stats:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     successful:
 *                       type: integer
 *                     failed:
 *                       type: integer
 *                     skipped:
 *                       type: integer
 *                     tagDistribution:
 *                       type: object
 *       '401':
 *         description: Ошибка авторизации
 *       '404':
 *         description: Магазин не найден
 *       '500':
 *         description: Внутренняя ошибка сервера
 */
export async function POST(request: NextRequest, { params }: { params: { storeId: string } }) {
    try {
        // Verify API key
        const authResult = await verifyApiKey(request);
        if (!authResult.authorized) {
            return NextResponse.json(
                { error: authResult.error || 'Unauthorized' },
                { status: 401 }
            );
        }

        const { storeId } = params;

        // Parse query parameters
        const { searchParams } = new URL(request.url);
        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;
        const force = searchParams.get('force') === 'true';

        // Run classification
        const result = await classifyAllChatsForStore(storeId, { limit, force });

        if (!result.success) {
            return NextResponse.json(
                { error: result.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            message: result.message,
            stats: result.stats,
        });

    } catch (error: any) {
        console.error('[API ERROR] /api/stores/[storeId]/chats/classify-all:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
