import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';
import { verifyApiKey } from '@/lib/server-utils';
import { classifyChatDeletion, bulkClassifyChatsForDeletion } from '@/ai/flows/classify-chat-deletion-flow';
import { getChatsEligibleForDeletion, getDeletionWorkflowStats } from '@/db/chat-deletion-helpers';
import type { ChatTag } from '@/types/chats';
import { buildStoreInstructions } from '@/lib/ai-context';

/**
 * Enhanced AI classification for deletion workflow
 * Stage 2: AI Classification (Day 4-5)
 *
 * This endpoint uses the new classifyChatDeletion flow which:
 * 1. Fast regex-based trigger phrase detection (90%+ confidence)
 * 2. AI-powered deep analysis for edge cases
 * 3. Supports extended tag taxonomy (deletion_candidate, refund_requested, spam, etc.)
 */
async function classifyAllChatsForDeletion(
    storeId: string,
    options: {
        limit?: number;
        force?: boolean;
        eligibleOnly?: boolean; // Only classify chats with work_in_chats=true
    } = {}
): Promise<{
    success: boolean;
    message: string;
    stats: {
        total: number;
        successful: number;
        failed: number;
        skipped: number;
        regexOnly: number; // High-confidence regex matches (skipped AI)
        aiCalls: number;   // Actual AI API calls made
        tagDistribution: Record<string, number>;
        deletionFunnel?: {
            candidates: number;
            offered: number;
            agreed: number;
            confirmed: number;
            refundRequested: number;
            totalRevenue: number;
        };
    };
}> {
    try {
        console.log(`[CLASSIFY-DELETION] Starting deletion workflow classification for store ${storeId}...`);

        const store = await dbHelpers.getStoreById(storeId);
        if (!store) {
            throw new Error(`Store ${storeId} not found`);
        }

        const ownerId = store.owner_id;

        // Get chats to classify
        let chatsToClassify: dbHelpers.Chat[];

        if (options.eligibleOnly) {
            // Only classify chats eligible for deletion workflow
            console.log(`[CLASSIFY-DELETION] Eligible-only mode: filtering by product rules`);
            const eligibleChats = await getChatsEligibleForDeletion(storeId, 1000);
            chatsToClassify = eligibleChats as dbHelpers.Chat[];
        } else if (options.force) {
            // Classify ALL chats
            console.log(`[CLASSIFY-DELETION] Force mode: classifying ALL chats`);
            chatsToClassify = await dbHelpers.getChats(storeId);
        } else {
            // Only classify untagged/active chats
            console.log(`[CLASSIFY-DELETION] Normal mode: classifying untagged & active chats`);
            const allChats = await dbHelpers.getChats(storeId);
            chatsToClassify = allChats.filter(chat =>
                !chat.tag || chat.tag === 'untagged' || chat.tag === 'active'
            );
        }

        // Apply limit if specified
        if (options.limit && options.limit > 0) {
            chatsToClassify = chatsToClassify.slice(0, options.limit);
        }

        console.log(`[CLASSIFY-DELETION] Found ${chatsToClassify.length} chats to classify`);

        if (chatsToClassify.length === 0) {
            return {
                success: true,
                message: 'No chats to classify',
                stats: {
                    total: 0,
                    successful: 0,
                    failed: 0,
                    skipped: 0,
                    regexOnly: 0,
                    aiCalls: 0,
                    tagDistribution: {},
                },
            };
        }

        // Classify each chat
        let successful = 0;
        let failed = 0;
        let skipped = 0;
        let regexOnly = 0;
        let aiCalls = 0;
        const tagCounts: Record<string, number> = {};

        for (const chat of chatsToClassify) {
            try {
                // Get chat messages
                const messages = await dbHelpers.getChatMessages(chat.id);

                if (messages.length === 0) {
                    console.log(`[CLASSIFY-DELETION] Chat ${chat.id}: No messages, skipping`);
                    skipped++;
                    continue;
                }

                // Build chat history
                const chatHistory = messages
                    .map(m => `${m.sender === 'client' ? 'Клиент' : 'Продавец'}: ${m.text || '[Вложение]'}`)
                    .join('\n');

                // Get product rules if available (for context)
                let productRules = null;
                if (chat.product_nm_id) {
                    // Try to find product by wb_product_id
                    const products = await dbHelpers.getProducts(storeId);
                    const product = products.find(p => p.wb_product_id === parseInt(chat.product_nm_id));

                    if (product) {
                        const rule = await dbHelpers.getProductRule(product.id);
                        if (rule) {
                            productRules = {
                                work_in_chats: rule.work_in_chats,
                                offer_compensation: rule.offer_compensation,
                                chat_strategy: rule.chat_strategy,
                                max_compensation: rule.max_compensation || undefined,
                            };
                        }
                    }
                }

                // Classify using AI + Regex hybrid
                console.log(`[CLASSIFY-DELETION] Chat ${chat.id}: Calling deletion classification...`);

                const startTime = Date.now();
                const result = await classifyChatDeletion({
                    chatHistory,
                    lastMessageText: chat.last_message_text || '',
                    storeId,
                    ownerId,
                    chatId: chat.id,
                    productName: chat.product_name || undefined,
                    productRules: productRules || undefined,
                    storeInstructions: await buildStoreInstructions(storeId, store.ai_instructions),
                });
                const duration = Date.now() - startTime;

                // Track if AI was called or regex-only
                if (result.reasoning?.includes('regex')) {
                    regexOnly++;
                } else {
                    aiCalls++;
                }

                // Update chat with new tag
                await dbHelpers.updateChat(chat.id, { tag: result.tag as ChatTag });

                // Update tag counts
                tagCounts[result.tag] = (tagCounts[result.tag] || 0) + 1;

                successful++;
                console.log(
                    `[CLASSIFY-DELETION] Chat ${chat.id}: '${result.tag}' ` +
                    `(confidence: ${(result.confidence * 100).toFixed(0)}%, ` +
                    `triggers: ${result.triggers?.length || 0}, ` +
                    `time: ${duration}ms) ` +
                    `[${successful}/${chatsToClassify.length}]`
                );

            } catch (error: any) {
                failed++;
                console.error(`[CLASSIFY-DELETION] Chat ${chat.id}: Classification failed - ${error.message}`);
            }
        }

        // Get updated deletion workflow stats
        const deletionFunnel = await getDeletionWorkflowStats(storeId);

        // Recalculate ALL tag stats for store
        const allChats = await dbHelpers.getChats(storeId);
        const allTagCounts: Record<string, number> = {};

        allChats.forEach(chat => {
            const tag = chat.tag || 'untagged';
            allTagCounts[tag] = (allTagCounts[tag] || 0) + 1;
        });

        // Update store stats (if helper exists)
        try {
            await dbHelpers.updateStore(storeId, {
                chat_tag_counts: allTagCounts as any,
            });
        } catch (error) {
            console.warn('[CLASSIFY-DELETION] Could not update store stats:', error);
        }

        const message =
            `Deletion workflow classification complete: ` +
            `${successful} successful (${regexOnly} regex-only, ${aiCalls} AI calls), ` +
            `${failed} failed, ${skipped} skipped ` +
            `(out of ${chatsToClassify.length} total)`;

        console.log(`[CLASSIFY-DELETION] ${message}`);
        console.log(`[CLASSIFY-DELETION] Deletion funnel:`, deletionFunnel);

        return {
            success: true,
            message,
            stats: {
                total: chatsToClassify.length,
                successful,
                failed,
                skipped,
                regexOnly,
                aiCalls,
                tagDistribution: tagCounts,
                deletionFunnel,
            },
        };

    } catch (error: any) {
        const errorMessage = error.message || 'An unknown error occurred during deletion classification';
        console.error(`[CLASSIFY-DELETION] Error: ${errorMessage}`, error);

        return {
            success: false,
            message: errorMessage,
            stats: {
                total: 0,
                successful: 0,
                failed: 0,
                skipped: 0,
                regexOnly: 0,
                aiCalls: 0,
                tagDistribution: {},
            },
        };
    }
}

/**
 * @swagger
 * /api/stores/{storeId}/chats/classify-deletion:
 *   post:
 *     summary: AI-классификация чатов для deletion workflow
 *     description: |
 *       Расширенная классификация с поддержкой deletion workflow.
 *       Использует гибридный подход: regex (90%+ confidence) + AI для сложных случаев.
 *
 *       Новые теги:
 *       - deletion_candidate - кандидат на удаление отзыва (600₽ ROI)
 *       - deletion_offered - предложена компенсация
 *       - deletion_agreed - клиент согласился
 *       - deletion_confirmed - отзыв удален (подтверждено)
 *       - refund_requested - запрос возврата
 *       - spam - спам от конкурентов
 *     tags:
 *       - Чаты
 *       - AI Deletion Workflow
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
 *         description: Максимальное количество чатов (опционально)
 *       - in: query
 *         name: force
 *         schema:
 *           type: boolean
 *         description: Классифицировать все чаты (по умолчанию false)
 *       - in: query
 *         name: eligibleOnly
 *         schema:
 *           type: boolean
 *         description: Только чаты с work_in_chats=true (по умолчанию false)
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
 *                   example: "Deletion workflow classification complete: 15 successful (8 regex-only, 7 AI calls), 0 failed, 4 skipped (out of 19 total)"
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
 *                     regexOnly:
 *                       type: integer
 *                       description: Чаты классифицированные regex без AI
 *                     aiCalls:
 *                       type: integer
 *                       description: Фактическое количество AI API вызовов
 *                     tagDistribution:
 *                       type: object
 *                       example:
 *                         deletion_candidate: 2
 *                         refund_requested: 1
 *                         spam: 1
 *                         active: 6
 *                         successful: 3
 *                     deletionFunnel:
 *                       type: object
 *                       properties:
 *                         candidates:
 *                           type: integer
 *                         offered:
 *                           type: integer
 *                         agreed:
 *                           type: integer
 *                         confirmed:
 *                           type: integer
 *                         refundRequested:
 *                           type: integer
 *                         totalRevenue:
 *                           type: integer
 *                           description: "confirmed × 600₽"
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
        const eligibleOnly = searchParams.get('eligibleOnly') === 'true';

        // Run deletion workflow classification
        const result = await classifyAllChatsForDeletion(storeId, { limit, force, eligibleOnly });

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
        console.error('[API ERROR] /api/stores/[storeId]/chats/classify-deletion:', error);
        return NextResponse.json(
            { error: error.message || 'Internal server error' },
            { status: 500 }
        );
    }
}
