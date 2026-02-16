import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';
import { verifyApiKey } from '@/lib/server-utils';
import { generateDeletionOffer } from '@/ai/flows/generate-deletion-offer-flow';
import { createDeletionCase, getDeletionCaseByChatId } from '@/db/deletion-case-helpers';
import { buildStoreInstructions } from '@/lib/ai-context';

/**
 * Generate deletion offer for a specific chat
 * Stage 3: Deletion Agent
 *
 * Flow:
 * 1. Verify chat is deletion_candidate
 * 2. Get product rules (compensation amount, type, strategy)
 * 3. Generate AI offer message
 * 4. Create deletion_case record
 * 5. Optionally auto-send message
 *
 * POST /api/stores/{storeId}/chats/{chatId}/generate-deletion-offer
 */

/**
 * @swagger
 * /api/stores/{storeId}/chats/{chatId}/generate-deletion-offer:
 *   post:
 *     summary: Сгенерировать оффер на удаление отзыва для чата
 *     description: |
 *       AI генерирует персонализированное сообщение с предложением компенсации.
 *       Создаёт deletion_case для отслеживания workflow.
 *
 *       Требования:
 *       - Chat tag должен быть `deletion_candidate`
 *       - Product rule: `work_in_chats=true` и `offer_compensation=true`
 *       - Не должно быть существующего активного deletion_case
 *     tags:
 *       - Deletion Workflow
 *       - Чаты
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: autoSend
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Автоматически отправить сообщение клиенту
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       '200':
 *         description: Оффер успешно сгенерирован
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deletionCase:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [offer_generated, offer_sent]
 *                     offerAmount:
 *                       type: integer
 *                       example: 500
 *                     offerMessage:
 *                       type: string
 *                       example: "Здравствуйте! Готовы вернуть 500₽..."
 *                     compensationType:
 *                       type: string
 *                       enum: [cashback, refund]
 *                     aiEstimatedSuccess:
 *                       type: number
 *                       example: 0.85
 *                 messageSent:
 *                   type: boolean
 *                   description: Было ли отправлено сообщение
 *       '400':
 *         description: Chat не является deletion_candidate или уже есть активный case
 *       '404':
 *         description: Chat/Product/Rules не найдены
 *       '500':
 *         description: Ошибка генерации
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { storeId: string; chatId: string } }
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

    const { storeId, chatId } = params;

    // Parse query params
    const { searchParams } = new URL(request.url);
    const autoSend = searchParams.get('autoSend') === 'true';

    console.log(`[GENERATE-DELETION-OFFER] Chat ${chatId}: Starting (autoSend: ${autoSend})`);

    // Get store for AI instructions
    const store = await dbHelpers.getStoreById(storeId);

    // Step 1: Get chat
    const chat = await dbHelpers.getChatById(chatId);
    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }

    // Step 2: Verify chat tag is deletion_candidate
    if (chat.tag !== 'deletion_candidate') {
      return NextResponse.json(
        {
          error: 'Chat is not a deletion candidate',
          currentTag: chat.tag,
          hint: 'Run /classify-deletion first',
        },
        { status: 400 }
      );
    }

    // Step 3: Check if deletion case already exists
    const existingCase = await getDeletionCaseByChatId(chatId);
    if (existingCase && !['failed', 'cancelled'].includes(existingCase.status)) {
      return NextResponse.json(
        {
          error: 'Deletion case already exists for this chat',
          existingCase: {
            id: existingCase.id,
            status: existingCase.status,
            offerAmount: existingCase.offer_amount,
            createdAt: existingCase.created_at,
          },
        },
        { status: 400 }
      );
    }

    // Step 4: Get product and rules
    const products = await dbHelpers.getProducts(storeId);
    const product = products.find(p => p.wb_product_id === parseInt(chat.product_nm_id));

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found for this chat' },
        { status: 404 }
      );
    }

    const productRule = await dbHelpers.getProductRule(product.id);
    if (!productRule) {
      return NextResponse.json(
        { error: 'Product rules not configured' },
        { status: 404 }
      );
    }

    // Step 5: Verify product is eligible for deletion workflow
    if (!productRule.work_in_chats || !productRule.offer_compensation) {
      return NextResponse.json(
        {
          error: 'Product not eligible for deletion workflow',
          productRule: {
            workInChats: productRule.work_in_chats,
            offerCompensation: productRule.offer_compensation,
          },
          hint: 'Enable work_in_chats and offer_compensation in product rules',
        },
        { status: 400 }
      );
    }

    // Step 6: Get chat messages for history
    const messages = await dbHelpers.getChatMessages(chatId);
    const chatHistory = messages
      .map(msg => `${msg.sender === 'client' ? 'Клиент' : 'Продавец'}: ${msg.text || '(без текста)'}`)
      .join('\n');

    // Step 7: Generate AI offer
    console.log(`[GENERATE-DELETION-OFFER] Chat ${chatId}: Calling AI...`);

    const offerResult = await generateDeletionOffer({
      chatHistory,
      clientName: chat.client_name,
      productName: chat.product_name || product.name,
      productVendorCode: product.vendor_code,
      reviewRating: undefined, // TODO: Link to review
      reviewText: undefined,
      compensationType: (productRule.compensation_type as 'cashback' | 'refund') || 'refund',
      maxCompensation: parseInt(productRule.max_compensation || '500', 10),
      chatStrategy: productRule.chat_strategy,
      storeId,
      ownerId: chat.owner_id,
      chatId,
      storeInstructions: await buildStoreInstructions(storeId, store?.ai_instructions, store?.marketplace),
    });

    console.log(
      `[GENERATE-DELETION-OFFER] Chat ${chatId}: Offer generated ` +
      `(amount: ${offerResult.offerAmount}₽, strategy: ${offerResult.strategy}, ` +
      `success rate: ${((offerResult.estimatedSuccessRate || 0) * 100).toFixed(0)}%)`
    );

    // Step 8: Create deletion case
    const deletionCase = await createDeletionCase({
      store_id: storeId,
      owner_id: chat.owner_id,
      chat_id: chatId,
      product_id: product.id,
      review_id: null, // TODO: Link to review

      offer_amount: offerResult.offerAmount,
      compensation_type: (productRule.compensation_type as 'cashback' | 'refund') || 'refund',
      offer_message: offerResult.messageText,
      offer_strategy: offerResult.strategy,

      client_name: chat.client_name,
      review_rating: undefined,
      review_text: undefined,

      ai_confidence: undefined, // From classification step
      ai_estimated_success: offerResult.estimatedSuccessRate,
      triggers_detected: undefined,

      metadata: {
        tone: offerResult.tone,
        productVendorCode: product.vendor_code,
      },
    });

    // Step 9: Update chat tag to deletion_offered
    await dbHelpers.updateChat(chatId, { tag: 'deletion_offered' as any });

    console.log(`[GENERATE-DELETION-OFFER] Chat ${chatId}: Deletion case created (${deletionCase.id})`);

    // Step 10: Optionally auto-send message
    let messageSent = false;
    if (autoSend) {
      // TODO: Implement WB API message sending
      // For now, just mark as sent
      console.log(`[GENERATE-DELETION-OFFER] Chat ${chatId}: Auto-send requested (not implemented yet)`);
      // await updateDeletionCaseStatus(deletionCase.id, 'offer_sent', {
      //   offer_sent_at: new Date(),
      // });
      // messageSent = true;
    }

    return NextResponse.json({
      deletionCase: {
        id: deletionCase.id,
        status: deletionCase.status,
        offerAmount: deletionCase.offer_amount,
        offerMessage: deletionCase.offer_message,
        compensationType: deletionCase.compensation_type,
        offerStrategy: deletionCase.offer_strategy,
        aiEstimatedSuccess: deletionCase.ai_estimated_success,
        createdAt: deletionCase.created_at,
      },
      messageSent,
      chatTagUpdated: 'deletion_offered',
    });

  } catch (error: any) {
    console.error('[API ERROR] /api/stores/[storeId]/chats/[chatId]/generate-deletion-offer:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
