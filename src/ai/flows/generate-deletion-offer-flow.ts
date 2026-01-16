'use server';
/**
 * @fileOverview AI Flow for generating deletion offer messages
 *
 * Generates personalized compensation offers for clients willing to delete/modify reviews.
 * Business Model:
 * - Seller pays cashback to client (compensated by us)
 * - We charge seller 600₽ for successful deletion
 * - Net profit: 600₽ - cashback amount
 *
 * Created: 2026-01-16 (Stage 3)
 */

import { runChatCompletion } from '../assistant-utils';
import { z } from 'zod';
import * as dbHelpers from '@/db/helpers';

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

  // IDs for logging
  storeId: z.string(),
  ownerId: z.string(),
  chatId: z.string(),
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
 * Calculate compensation amount based on review rating and product rules
 *
 * Logic:
 * - Lower rating = higher compensation (more damage to seller)
 * - Always respect product_rules.max_compensation
 * - Return both amount and reasoning
 */
export function calculateCompensation(
  reviewRating: number | undefined,
  maxCompensation: number,
  productPrice?: number
): {
  amount: number;
  reasoning: string;
} {
  // If no rating, offer maximum (assume worst case)
  if (!reviewRating) {
    return {
      amount: maxCompensation,
      reasoning: 'No review rating available, offering maximum',
    };
  }

  // Rating-based percentage of max compensation
  const ratingMultipliers: Record<number, number> = {
    1: 1.0,   // 1★ → 100% max (most damage)
    2: 0.8,   // 2★ → 80% max
    3: 0.6,   // 3★ → 60% max
    4: 0.4,   // 4★ → 40% max (less critical)
    5: 0.2,   // 5★ → 20% max (shouldn't happen, but just in case)
  };

  const multiplier = ratingMultipliers[reviewRating] || 0.5;
  const calculatedAmount = Math.round(maxCompensation * multiplier);

  // Ensure we don't go below minimum viable offer (50 rubles)
  const finalAmount = Math.max(50, Math.min(calculatedAmount, maxCompensation));

  return {
    amount: finalAmount,
    reasoning: `Review rating ${reviewRating}★ → ${(multiplier * 100).toFixed(0)}% of max (${maxCompensation}₽)`,
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
      input.maxCompensation
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

    const systemPrompt = settings.prompt_deletion_offer || settings.prompt_chat_reply;
    if (!systemPrompt) {
      throw new Error('Системный промт для генерации офферов не найден в настройках.');
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

    // Chat history
    userContent += `\n**История переписки:**\n${input.chatHistory}\n`;

    // Instructions
    userContent += `\n**Задача:**\n`;
    userContent += `Сгенерируйте сообщение клиенту с предложением компенсации ${compensation.amount}₽.\n`;
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
    const fallbackMessage = generateFallbackOffer(
      input.clientName,
      input.productName,
      calculateCompensation(input.reviewRating, input.maxCompensation).amount,
      input.compensationType
    );

    return {
      messageText: fallbackMessage,
      offerAmount: calculateCompensation(input.reviewRating, input.maxCompensation).amount,
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
