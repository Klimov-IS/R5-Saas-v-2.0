import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';
import { verifyApiKey } from '@/lib/server-utils';
import { generateDeletionOffer } from '@/ai/flows/generate-deletion-offer-flow';
import { createDeletionCase, getDeletionCaseByChatId } from '@/db/deletion-case-helpers';

/**
 * Bulk generate deletion offers for all deletion_candidate chats
 * Stage 3: Deletion Agent
 *
 * POST /api/stores/{storeId}/deletion-cases/generate-all
 */

/**
 * @swagger
 * /api/stores/{storeId}/deletion-cases/generate-all:
 *   post:
 *     summary: Массовая генерация офферов для всех deletion_candidate чатов
 *     description: |
 *       Находит все чаты с тегом deletion_candidate, у которых:
 *       - Product rule: work_in_chats=true AND offer_compensation=true
 *       - Ещё нет активного deletion_case
 *
 *       Генерирует AI оффер для каждого чата и создаёт deletion_case.
 *     tags:
 *       - Deletion Workflow
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Макс. количество чатов для обработки
 *       - in: query
 *         name: autoSend
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Автоматически отправить сообщения
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       '200':
 *         description: Успешно
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { storeId: string } }
) {
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

    // Parse query params
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined;
    const autoSend = searchParams.get('autoSend') === 'true';

    console.log(`[GENERATE-ALL-OFFERS] Store ${storeId}: Starting (limit: ${limit || 'none'}, autoSend: ${autoSend})`);

    // Get store for AI instructions
    const store = await dbHelpers.getStoreById(storeId);

    // Step 1: Get all deletion_candidate chats
    const allChats = await dbHelpers.getChats(storeId);
    let candidateChats = allChats.filter(chat => chat.tag === 'deletion_candidate');

    if (limit) {
      candidateChats = candidateChats.slice(0, limit);
    }

    console.log(`[GENERATE-ALL-OFFERS] Found ${candidateChats.length} deletion_candidate chats`);

    if (candidateChats.length === 0) {
      return NextResponse.json({
        message: 'No deletion_candidate chats found',
        stats: {
          total: 0,
          successful: 0,
          skipped: 0,
          failed: 0,
        },
      });
    }

    // Step 2: Process each chat
    const results: Array<{
      chatId: string;
      success: boolean;
      deletionCaseId?: string;
      offerAmount?: number;
      error?: string;
      reason?: string;
    }> = [];

    let successful = 0;
    let skipped = 0;
    let failed = 0;

    for (const chat of candidateChats) {
      try {
        // Check if case already exists
        const existingCase = await getDeletionCaseByChatId(chat.id);
        if (existingCase && !['failed', 'cancelled'].includes(existingCase.status)) {
          results.push({
            chatId: chat.id,
            success: false,
            reason: `Already has ${existingCase.status} case`,
          });
          skipped++;
          continue;
        }

        // Get product and rules
        const products = await dbHelpers.getProducts(storeId);
        const product = products.find(p => p.wb_product_id === parseInt(chat.product_nm_id));

        if (!product) {
          results.push({
            chatId: chat.id,
            success: false,
            error: 'Product not found',
          });
          skipped++;
          continue;
        }

        const productRule = await dbHelpers.getProductRule(product.id);
        if (!productRule || !productRule.work_in_chats || !productRule.offer_compensation) {
          results.push({
            chatId: chat.id,
            success: false,
            reason: 'Product not eligible (work_in_chats or offer_compensation disabled)',
          });
          skipped++;
          continue;
        }

        // Get chat history
        const messages = await dbHelpers.getChatMessages(chat.id);
        const chatHistory = messages
          .map(msg => `${msg.sender === 'client' ? 'Клиент' : 'Продавец'}: ${msg.text || '(без текста)'}`)
          .join('\n');

        // Generate offer
        const offerResult = await generateDeletionOffer({
          chatHistory,
          clientName: chat.client_name,
          productName: chat.product_name || product.name,
          productVendorCode: product.vendor_code,
          reviewRating: undefined,
          reviewText: undefined,
          compensationType: (productRule.compensation_type as 'cashback' | 'refund') || 'refund',
          maxCompensation: parseInt(productRule.max_compensation || '500', 10),
          chatStrategy: productRule.chat_strategy,
          storeId,
          ownerId: chat.owner_id,
          chatId: chat.id,
          storeInstructions: store?.ai_instructions || undefined,
        });

        // Create deletion case
        const deletionCase = await createDeletionCase({
          store_id: storeId,
          owner_id: chat.owner_id,
          chat_id: chat.id,
          product_id: product.id,
          review_id: null,

          offer_amount: offerResult.offerAmount,
          compensation_type: (productRule.compensation_type as 'cashback' | 'refund') || 'refund',
          offer_message: offerResult.messageText,
          offer_strategy: offerResult.strategy,

          client_name: chat.client_name,
          ai_estimated_success: offerResult.estimatedSuccessRate,

          metadata: {
            tone: offerResult.tone,
            productVendorCode: product.vendor_code,
          },
        });

        // Update chat tag
        await dbHelpers.updateChat(chat.id, { tag: 'deletion_offered' as any });

        results.push({
          chatId: chat.id,
          success: true,
          deletionCaseId: deletionCase.id,
          offerAmount: deletionCase.offer_amount,
        });

        successful++;

        console.log(
          `[GENERATE-ALL-OFFERS] Chat ${chat.id}: Success ` +
          `(case ${deletionCase.id}, ${deletionCase.offer_amount}₽) ` +
          `[${successful}/${candidateChats.length}]`
        );

      } catch (error: any) {
        results.push({
          chatId: chat.id,
          success: false,
          error: error.message,
        });
        failed++;
        console.error(`[GENERATE-ALL-OFFERS] Chat ${chat.id}: Error - ${error.message}`);
      }
    }

    const message = `Generated ${successful} offers, ${skipped} skipped, ${failed} failed (out of ${candidateChats.length} candidates)`;

    console.log(`[GENERATE-ALL-OFFERS] ${message}`);

    return NextResponse.json({
      message,
      stats: {
        total: candidateChats.length,
        successful,
        skipped,
        failed,
      },
      results,
    });

  } catch (error: any) {
    console.error('[API ERROR] /api/stores/[storeId]/deletion-cases/generate-all:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
