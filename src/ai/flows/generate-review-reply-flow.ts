'use server';
/**
 * @fileOverview Flow for generating a reply to a customer review.
 * Migrated from Firebase to PostgreSQL.
 *
 * - generateReviewReply - A function that handles the reply generation process.
 * - GenerateReviewReplyInput - The input type for the generateReviewReply function.
 * - GenerateReviewReplyOutput - The return type for the generateReviewReply function.
 */
import { runChatCompletion } from '../assistant-utils';
import { z } from 'zod';
import * as dbHelpers from '@/db/helpers';

const GenerateReviewReplyInputSchema = z.object({
    storeName: z.string().describe('The name of the store.'),
    reviewText: z.string().describe("The customer's review text."),
    reviewPros: z.string().optional().describe('The "pros" or advantages mentioned in the review.'),
    reviewCons: z.string().optional().describe('The "cons" or disadvantages mentioned in the review.'),
    reviewRating: z.number().describe('The star rating (1-5) the customer gave.'),
    reviewAuthor: z.string().describe("The customer's name."),
    productName: z.string().describe('The name of the product being reviewed.'),
    productVendorCode: z.string().describe('The vendor code (article) of the product.'),
    productCharacteristics: z.string().optional().describe('A JSON string of product characteristics (name-value pairs).'),
    storeId: z.string().describe('Store ID for logging'),
    ownerId: z.string().describe('Owner ID for logging'),
    reviewId: z.string().describe('Review ID for logging'),
    storeInstructions: z.string().optional().describe('Store-specific AI instructions'),
});
export type GenerateReviewReplyInput = z.infer<typeof GenerateReviewReplyInputSchema>;

const GenerateReviewReplyOutputSchema = z.object({
  replyText: z.string().describe('The generated reply to the customer.'),
});
export type GenerateReviewReplyOutput = z.infer<typeof GenerateReviewReplyOutputSchema>;

export async function generateReviewReply(input: GenerateReviewReplyInput): Promise<GenerateReviewReplyOutput> {
    let userContent = `**Store Name:** ${input.storeName}

**Review Context:**
- **Author:** ${input.reviewAuthor}
- **Rating:** ${input.reviewRating} out of 5 stars
- **Review Text:** "${input.reviewText}"`;

    if (input.reviewPros) {
        userContent += `\n- **Достоинства:** "${input.reviewPros}"`;
    }
    if (input.reviewCons) {
        userContent += `\n- **Недостатки:** "${input.reviewCons}"`;
    }

    userContent += `\n\n**Product Context:**
- **Product Name:** ${input.productName}
- **Vendor Code:** ${input.productVendorCode}
- **Characteristics:** ${input.productCharacteristics || 'N/A'}`;

    // Get settings from PostgreSQL
    const settings = await dbHelpers.getUserSettings();

    if (!settings) {
      throw new Error("Не найдены настройки AI.");
    }
    let systemPrompt = settings.prompt_review_reply;

    if (!systemPrompt) {
        throw new Error("Системный промт для ответов на отзывы не найден в настройках.");
    }

    // Inject store-specific instructions
    if (input.storeInstructions) {
      systemPrompt += `\n\n## Инструкции магазина\n${input.storeInstructions}`;
    }

    const replyText = await runChatCompletion({
        operation: 'generate-review-reply',
        systemPrompt: systemPrompt,
        userContent,
        storeId: input.storeId,
        ownerId: input.ownerId,
        entityType: 'review',
        entityId: input.reviewId,
    });

    return { replyText };
}
