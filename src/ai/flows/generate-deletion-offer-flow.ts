'use server';
/**
 * @fileOverview AI Flow for generating deletion offer messages
 *
 * Generates personalized compensation offers for clients willing to delete/modify reviews.
 * Compensation amount comes from product_rules — either a single max_compensation
 * or per-rating amounts (compensation_1star/2star/3star) when per_rating_compensation=true.
 *
 * Created: 2026-01-16 (Stage 3)
 */

import { runChatCompletion } from '../assistant-utils';
import { z } from 'zod';
import * as dbHelpers from '@/db/helpers';
import { getEffectiveCompensation } from '@/db/helpers';

// ============================================================================
// Input/Output Schemas
// ============================================================================

const GenerateDeletionOfferInputSchema = z.object({
  // Chat context
  chatHistory: z.string().describe('Full conversation history'),
  clientName: z.string().describe('Client name for personalization'),
  productName: z.string().describe('Product name'),
  productVendorCode: z.string().optional().describe('Product article/SKU'),

  // Review context (if available)
  reviewRating: z.number().min(1).max(5).optional().describe('Review star rating (1-5)'),
  reviewText: z.string().optional().describe('Review text content'),

  // Product rules
  compensationType: z.enum(['cashback', 'refund']).describe('Type of compensation'),
  maxCompensation: z.number().describe('Maximum compensation amount (rubles)'),
  chatStrategy: z.enum(['upgrade_to_5', 'delete', 'both']).optional().describe('Chat strategy'),

  // Per-rating compensation (optional)
  perRatingCompensation: z.boolean().optional().describe('Whether per-rating compensation is enabled'),
  compensation1star: z.string().optional().describe('Compensation for 1★ reviews'),
  compensation2star: z.string().optional().describe('Compensation for 2★ reviews'),
  compensation3star: z.string().optional().describe('Compensation for 3★ reviews'),

  // IDs for logging
  storeId: z.string(),
  ownerId: z.string(),
  chatId: z.string(),
  storeInstructions: z.string().optional().describe('Store-specific AI instructions'),
});
export type GenerateDeletionOfferInput = z.infer<typeof GenerateDeletionOfferInputSchema>;

const GenerateDeletionOfferOutputSchema = z.object({
  messageText: z.string().describe('Generated offer message to send to client'),
  offerAmount: z.number().describe('Actual compensation amount offered (rubles)'),
  strategy: z.enum(['upgrade_to_5', 'delete', 'both']).describe('Recommended strategy'),
  tone: z.enum(['empathetic', 'apologetic', 'professional', 'friendly']).optional(),
  estimatedSuccessRate: z.number().min(0).max(1).optional().describe('AI confidence in acceptance (0-1)'),
});
export type GenerateDeletionOfferOutput = z.infer<typeof GenerateDeletionOfferOutputSchema>;

// ============================================================================
// Compensation Calculator
// ============================================================================

/**
 * Get compensation amount from product rules.
 *
 * Uses getEffectiveCompensation to resolve per-rating amounts when enabled,
 * falling back to maxCompensation for all ratings.
 */
function calculateCompensation(
  reviewRating: number | undefined,
  maxCompensation: number,
  perRatingCompensation?: boolean,
  compensation1star?: string,
  compensation2star?: string,
  compensation3star?: string,
): {
  amount: number;
  reasoning: string;
} {
  if (perRatingCompensation && reviewRating != null) {
    const effectiveStr = getEffectiveCompensation(
      {
        per_rating_compensation: true,
        compensation_1star: compensation1star || null,
        compensation_2star: compensation2star || null,
        compensation_3star: compensation3star || null,
        max_compensation: String(maxCompensation),
      },
      reviewRating
    );
    const amount = parseInt(effectiveStr, 10) || maxCompensation;
    return {
      amount,
      reasoning: `Per-rating (${reviewRating}★): ${amount}₽`,
    };
  }

  return {
    amount: maxCompensation,
    reasoning: `Fixed per product rules: ${maxCompensation}₽`,
  };
}

// ============================================================================
// Main Generation Function
// ============================================================================

/**
 * Generate deletion offer message using AI
 *
 * Two-stage approach:
 * 1. Calculate compensation amount (deterministic)
 * 2. Generate personalized message (AI-powered)
 */
export async function generateDeletionOffer(
  input: GenerateDeletionOfferInput
): Promise<GenerateDeletionOfferOutput> {
  try {
    // Stage 1: Calculate compensation
    const compensation = calculateCompensation(
      input.reviewRating,
      input.maxCompensation,
      input.perRatingCompensation,
      input.compensation1star,
      input.compensation2star,
      input.compensation3star,
    );

    console.log(
      `[GENERATE-DELETION-OFFER] Chat ${input.chatId}: ` +
      `Calculated compensation: ${compensation.amount}₽ (${compensation.reasoning})`
    );

    // Get AI settings
    const settings = await dbHelpers.getUserSettings();
    if (!settings) {
      throw new Error('Не найдены настройки AI.');
    }

    let systemPrompt = settings.prompt_deletion_offer || settings.prompt_chat_reply;
    if (!systemPrompt) {
      throw new Error('Системный промт для генерации офферов не найден в настройках.');
    }

    // Inject store-specific instructions
    if (input.storeInstructions) {
      systemPrompt += `\n\n## Инструкции магазина\n${input.storeInstructions}`;
    }

    // Stage 2: Build context for AI
    let userContent = `**Контекст:**\n`;
    userContent += `- **Клиент:** ${input.clientName}\n`;
    userContent += `- **Товар:** ${input.productName}`;
    if (input.productVendorCode) {
      userContent += ` (Артикул: ${input.productVendorCode})`;
    }
    userContent += `\n`;

    // Review context
    if (input.reviewRating) {
      userContent += `- **Оценка в отзыве:** ${input.reviewRating}★\n`;
    }
    if (input.reviewText) {
      userContent += `- **Текст отзыва:** "${input.reviewText}"\n`;
    }

    // Compensation details
    userContent += `\n**Параметры компенсации:**\n`;
    userContent += `- **Тип:** ${input.compensationType === 'cashback' ? 'Кешбэк' : 'Возврат на карту'}\n`;
    userContent += `- **Сумма:** ${compensation.amount} руб\n`;
    userContent += `- **Стратегия:** ${input.chatStrategy || 'both'}\n`;

    // Conversation phase detection (count client messages in history)
    const historyLines = input.chatHistory.split('\n').filter(l => l.trim());
    const clientLines = historyLines.filter(l => l.startsWith('Клиент:') || l.startsWith('[Клиент]'));
    const clientMessageCount = clientLines.length;
    const phaseLabel = clientMessageCount === 0 ? 'знакомство' : clientMessageCount <= 2 ? 'понимание' : 'решение';
    userContent += `\n**Фаза диалога:** ${phaseLabel}\n`;
    userContent += `**Сообщений от клиента:** ${clientMessageCount}\n`;

    // Chat history
    userContent += `\n**История переписки:**\n${input.chatHistory}\n`;

    // Instructions
    userContent += `\n**Задача:**\n`;
    if (clientMessageCount === 0) {
      userContent += `Клиент ещё не ответил. Сгенерируйте вопрос — узнайте, что случилось. НЕ предлагайте компенсацию.\n`;
    } else if (clientMessageCount <= 2) {
      userContent += `Клиент рассказал о проблеме. Покажите, что вникли. Мягко подведите к решению, но пока не называйте сумму.\n`;
    } else {
      userContent += `Сгенерируйте сообщение клиенту с предложением компенсации ${compensation.amount}₽.\n`;
    }
    if (input.chatStrategy === 'upgrade_to_5') {
      userContent += `Акцент: попросить повысить оценку до 5★ после решения проблемы.\n`;
    } else if (input.chatStrategy === 'delete') {
      userContent += `Акцент: деликатно намекнуть на возможность удаления отзыва (НЕ напрямую!).\n`;
    } else {
      userContent += `Акцент: предложить решение проблемы + компенсацию.\n`;
    }

    // Call AI
    const rawOutput = await runChatCompletion({
      operation: 'generate-deletion-offer',
      systemPrompt: systemPrompt,
      userContent: userContent,
      isJsonMode: true,
      storeId: input.storeId,
      ownerId: input.ownerId,
      entityType: 'chat',
      entityId: input.chatId,
    });

    // Parse AI response
    const parsedOutput = JSON.parse(rawOutput);
    const result = GenerateDeletionOfferOutputSchema.safeParse(parsedOutput);

    if (!result.success) {
      console.error('[GENERATE-DELETION-OFFER] AI validation failed:', result.error);

      // Fallback: Generate simple template-based message
      const fallbackMessage = generateFallbackOffer(
        input.clientName,
        input.productName,
        compensation.amount,
        input.compensationType
      );

      return {
        messageText: fallbackMessage,
        offerAmount: compensation.amount,
        strategy: input.chatStrategy || 'both',
        tone: 'professional',
        estimatedSuccessRate: 0.5,
      };
    }

    // Ensure offer amount matches calculation
    const finalResult = {
      ...result.data,
      offerAmount: compensation.amount, // Override AI amount with calculated
    };

    console.log(
      `[GENERATE-DELETION-OFFER] Chat ${input.chatId}: ` +
      `Generated offer (${finalResult.offerAmount}₽, ${finalResult.strategy})`
    );

    return finalResult;

  } catch (error) {
    console.error('[GENERATE-DELETION-OFFER] Error:', error);

    // Fallback to template
    const fallbackComp = calculateCompensation(
      input.reviewRating, input.maxCompensation,
      input.perRatingCompensation, input.compensation1star,
      input.compensation2star, input.compensation3star,
    );
    const fallbackMessage = generateFallbackOffer(
      input.clientName,
      input.productName,
      fallbackComp.amount,
      input.compensationType
    );

    return {
      messageText: fallbackMessage,
      offerAmount: fallbackComp.amount,
      strategy: input.chatStrategy || 'both',
      tone: 'professional',
      estimatedSuccessRate: 0.5,
    };
  }
}

// ============================================================================
// Fallback Template Generator
// ============================================================================

/**
 * Generate simple template-based offer if AI fails
 */
function generateFallbackOffer(
  clientName: string,
  productName: string,
  amount: number,
  compensationType: 'cashback' | 'refund'
): string {
  const compensationText = compensationType === 'cashback'
    ? 'кешбэк на следующую покупку'
    : 'возврат средств на карту';

  return `Здравствуйте, ${clientName}!

Очень сожалеем о проблеме с товаром "${productName}". Мы ценим каждого покупателя и готовы помочь решить вопрос.

Предлагаем вам ${compensationText} в размере ${amount} руб. Для оформления напишите, пожалуйста, в нашу службу поддержки.

Будем благодарны за возможность исправить ситуацию!`;
}

// ============================================================================
// Batch Generation
// ============================================================================

/**
 * Generate offers for multiple deletion candidates
 */
export async function bulkGenerateDeletionOffers(
  chatIds: string[],
  storeId: string
): Promise<Array<{
  chatId: string;
  offer: GenerateDeletionOfferOutput | null;
  error?: string;
}>> {
  const results: Array<{
    chatId: string;
    offer: GenerateDeletionOfferOutput | null;
    error?: string;
  }> = [];

  for (const chatId of chatIds) {
    try {
      // Get chat context
      const chat = await dbHelpers.getChatById(chatId);
      if (!chat) {
        results.push({
          chatId,
          offer: null,
          error: 'Chat not found',
        });
        continue;
      }

      // Get product and rules
      const products = await dbHelpers.getProducts(storeId);
      const product = products.find(p => p.wb_product_id === parseInt(chat.product_nm_id));

      if (!product) {
        results.push({
          chatId,
          offer: null,
          error: 'Product not found',
        });
        continue;
      }

      const productRule = await dbHelpers.getProductRule(product.id);
      if (!productRule || !productRule.offer_compensation) {
        results.push({
          chatId,
          offer: null,
          error: 'Product not eligible for compensation',
        });
        continue;
      }

      // Get chat messages
      const messages = await dbHelpers.getChatMessages(chatId);
      const chatHistory = messages
        .map(msg => `${msg.sender === 'client' ? 'Клиент' : 'Продавец'}: ${msg.text || '(без текста)'}`)
        .join('\n');

      // TODO: Get review rating (needs review lookup by chat)
      // For now, use undefined to trigger max compensation

      // Generate offer
      const offer = await generateDeletionOffer({
        chatHistory,
        clientName: chat.client_name,
        productName: chat.product_name || product.name,
        productVendorCode: product.vendor_code,
        reviewRating: undefined, // TODO: Link to review
        reviewText: undefined,
        compensationType: (productRule.compensation_type as 'cashback' | 'refund') || 'refund',
        maxCompensation: parseInt(productRule.max_compensation || '500', 10),
        chatStrategy: productRule.chat_strategy,
        perRatingCompensation: productRule.per_rating_compensation ?? false,
        compensation1star: productRule.compensation_1star ?? undefined,
        compensation2star: productRule.compensation_2star ?? undefined,
        compensation3star: productRule.compensation_3star ?? undefined,
        storeId,
        ownerId: chat.owner_id,
        chatId,
      });

      results.push({
        chatId,
        offer,
      });

    } catch (error) {
      console.error(`[BULK-GENERATE-OFFERS] Chat ${chatId} error:`, error);
      results.push({
        chatId,
        offer: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}
