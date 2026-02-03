'use server';
/**
 * @fileOverview Flow for generating a complaint about a customer review.
 * Migrated from Firebase to PostgreSQL.
 * Optimized for token efficiency while maintaining quality.
 *
 * - generateReviewComplaint - A function that handles the complaint generation process.
 * - GenerateReviewComplaintInput - The input type for the generateReviewComplaint function.
 * - GenerateReviewComplaintOutput - The return type for the generateReviewComplaint function.
 */
import { runChatCompletion } from '../assistant-utils';
import { z } from 'zod';
import * as dbHelpers from '@/db/helpers';
import {
  buildOptimizedSystemPrompt,
  calculatePromptSavings,
} from '../prompts/optimized-review-complaint-prompt';
import {
  canUseTemplate,
  selectTemplateByReviewId,
} from '../utils/complaint-templates';
import { truncateComplaintText } from '../utils/complaint-text-validator';

const GenerateReviewComplaintInputSchema = z.object({
    productName: z.string().describe('The name of the product being reviewed.'),
    productVendorCode: z.string().describe('The vendor code (article) of the product.'),
    productCharacteristics: z.string().optional().describe('Filtered string of key product characteristics (e.g., "Высота: 32 см, Ширина: 10 см, Материал: пластик").'),
    compensationMethod: z.string().optional().describe('Instructions on how to handle compensation or returns for this product.'),
    reviewAuthor: z.string().describe("The customer's name."),
    reviewText: z.string().describe("The customer's review text."),
    reviewRating: z.number().describe('The star rating (1-5) the customer gave.'),
    reviewPros: z.string().optional().describe('The "pros" or advantages mentioned in the review.'),
    reviewCons: z.string().optional().describe('The "cons" or disadvantages mentioned in the review.'),
    reviewDate: z.string().describe('The date the review was created.'),
    storeId: z.string().describe('Store ID for logging'),
    ownerId: z.string().describe('Owner ID for logging'),
    reviewId: z.string().describe('Review ID for logging'),
});
export type GenerateReviewComplaintInput = z.infer<typeof GenerateReviewComplaintInputSchema>;

const GenerateReviewComplaintOutputSchema = z.object({
  complaintText: z.string().describe('The generated complaint text to be sent to moderation.'),
  reasonId: z.number().describe('WB complaint reason ID (11-20)'),
  reasonName: z.string().describe('WB complaint reason name'),
  promptTokens: z.number().optional().describe('AI input tokens used'),
  completionTokens: z.number().optional().describe('AI output tokens generated'),
  totalTokens: z.number().optional().describe('Total AI tokens used'),
  costUsd: z.number().optional().describe('AI generation cost in USD'),
  durationMs: z.number().optional().describe('Generation duration in milliseconds'),
});
export type GenerateReviewComplaintOutput = z.infer<typeof GenerateReviewComplaintOutputSchema>;


export async function generateReviewComplaint(input: GenerateReviewComplaintInput): Promise<GenerateReviewComplaintOutput> {
    const startTime = Date.now();

    // Check if we can use template instead of AI (empty review with rating 1-3)
    if (canUseTemplate(input.reviewText, input.reviewPros, input.reviewCons, input.reviewRating)) {
        // A/B Testing: Select template variant by reviewId (hash-based rotation)
        const template = selectTemplateByReviewId(input.reviewId);
        const durationMs = Date.now() - startTime;

        console.log('[TEMPLATE] Using template for empty review (zero AI cost)');
        console.log(`[TEMPLATE] Review ${input.reviewId}: rating=${input.reviewRating}, variant=${String.fromCharCode(65 + template.variantId)} (${template.variantId}), reason=${template.reasonId}, text=empty, pros=empty, cons=empty`);

        return {
            complaintText: template.complaintText,
            reasonId: template.reasonId,
            reasonName: template.reasonName,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            costUsd: 0,
            durationMs,
        };
    }

    // Continue with AI generation for non-empty reviews
    // Log input data for analytics and debugging
    console.log('[AI INPUT] Generating complaint for review:', {
        reviewId: input.reviewId,
        storeId: input.storeId,
        rating: input.reviewRating,
        hasText: !!input.reviewText?.trim(),
        hasPros: !!input.reviewPros?.trim(),
        hasCons: !!input.reviewCons?.trim(),
        textLength: input.reviewText?.length || 0,
        prosLength: input.reviewPros?.length || 0,
        consLength: input.reviewCons?.length || 0,
        characteristics: input.productCharacteristics?.substring(0, 100) + '...',
    });

    let userContent = `**Контекст:**
- **Товар:** ${input.productName} (Артикул: ${input.productVendorCode})
- **Характеристики товара:** ${input.productCharacteristics || 'N/A'}
- **Способ компенсации:** ${input.compensationMethod || 'N/A'}
- **Автор отзыва:** ${input.reviewAuthor}
- **Дата отзыва:** ${input.reviewDate}
- **Оценка:** ${input.reviewRating}
- **Текст отзыва:** "${input.reviewText}"`;

    if (input.reviewPros) {
        userContent += `\n- **Достоинства:** "${input.reviewPros}"`;
    }
    if (input.reviewCons) {
        userContent += `\n- **Недостатки:** "${input.reviewCons}"`;
    }

    // Build optimized system prompt based on product category
    const optimizedSystemPrompt = buildOptimizedSystemPrompt(
        input.productName,
        input.productCharacteristics || ''
    );

    // Get original prompt from DB for comparison (optional logging)
    const settings = await dbHelpers.getUserSettings();
    if (settings?.prompt_review_complaint) {
        const savings = calculatePromptSavings(
            settings.prompt_review_complaint.length,
            optimizedSystemPrompt.length
        );
        console.log(`[AI OPTIMIZATION] Prompt token savings: ${savings.savedPercent}% (${savings.saved} chars)`);
    }

    const complaintText = await runChatCompletion({
        operation: 'generate-review-complaint',
        systemPrompt: optimizedSystemPrompt,
        userContent,
        storeId: input.storeId,
        ownerId: input.ownerId,
        entityType: 'review',
        entityId: input.reviewId,
    });

    const durationMs = Date.now() - startTime;

    // Log raw AI response for debugging
    console.log('[AI RAW RESPONSE] Review', input.reviewId, ':', complaintText.substring(0, 200) + '...');

    // Parse JSON response from AI to extract reason_id, reason_name, complaintText
    let parsedResponse: { reasonId: number; reasonName: string; complaintText: string };

    try {
        // Try to extract JSON from markdown code block
        const jsonMatch = complaintText.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            parsedResponse = JSON.parse(jsonMatch[1]);
        } else {
            // Try to parse as direct JSON
            parsedResponse = JSON.parse(complaintText);
        }
    } catch (e) {
        console.error('[AI ERROR] Failed to parse complaint JSON:', e);
        // Fallback: use default values
        parsedResponse = {
            reasonId: 11,
            reasonName: 'Отзыв не относится к товару',
            complaintText: complaintText, // Use raw response as fallback
        };
    }

    // Estimate tokens (rough approximation: 1 token ≈ 4 characters)
    // TODO: Replace with actual token counts from Deepseek API if available
    const promptChars = optimizedSystemPrompt.length + userContent.length;
    const completionChars = parsedResponse.complaintText.length;
    const estimatedPromptTokens = Math.ceil(promptChars / 4);
    const estimatedCompletionTokens = Math.ceil(completionChars / 4);
    const estimatedTotalTokens = estimatedPromptTokens + estimatedCompletionTokens;

    // Calculate cost (Deepseek: $0.14 per 1M input, $0.28 per 1M output)
    const costUsd =
        (estimatedPromptTokens / 1_000_000) * 0.14 +
        (estimatedCompletionTokens / 1_000_000) * 0.28;

    // Validate and truncate complaint text if exceeds WB hard limit (1000 chars)
    const { text: validatedComplaintText, wasTruncated, originalLength } = truncateComplaintText(parsedResponse.complaintText);
    if (wasTruncated) {
        console.warn(`[AI] Complaint text truncated from ${originalLength} to ${validatedComplaintText.length} chars for review ${input.reviewId}`);
    }

    return {
        complaintText: validatedComplaintText, // Use validated (potentially truncated) text
        reasonId: parsedResponse.reasonId,
        reasonName: parsedResponse.reasonName,
        promptTokens: estimatedPromptTokens,
        completionTokens: estimatedCompletionTokens,
        totalTokens: estimatedTotalTokens,
        costUsd,
        durationMs,
    };
}
