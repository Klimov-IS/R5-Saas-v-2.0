'use server';
/**
 * @fileOverview Flow for generating a complaint about a customer review.
 * Migrated from Firebase to PostgreSQL.
 *
 * - generateReviewComplaint - A function that handles the complaint generation process.
 * - GenerateReviewComplaintInput - The input type for the generateReviewComplaint function.
 * - GenerateReviewComplaintOutput - The return type for the generateReviewComplaint function.
 */
import { runChatCompletion } from '../assistant-utils';
import { z } from 'zod';
import * as dbHelpers from '@/db/helpers';

const GenerateReviewComplaintInputSchema = z.object({
    productName: z.string().describe('The name of the product being reviewed.'),
    productVendorCode: z.string().describe('The vendor code (article) of the product.'),
    productCharacteristics: z.string().optional().describe('A JSON string of all product characteristics (name-value pairs).'),
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
});
export type GenerateReviewComplaintOutput = z.infer<typeof GenerateReviewComplaintOutputSchema>;


export async function generateReviewComplaint(input: GenerateReviewComplaintInput): Promise<GenerateReviewComplaintOutput> {
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

    // Get settings from PostgreSQL
    const settings = await dbHelpers.getUserSettings();

    if (!settings) {
        throw new Error("Не найдены настройки AI.");
    }
    const systemPrompt = settings.prompt_review_complaint;

    if (!systemPrompt) {
        throw new Error("Системный промт для жалоб на отзывы не найден в настройках.");
    }

    const complaintText = await runChatCompletion({
        operation: 'generate-review-complaint',
        systemPrompt: systemPrompt,
        userContent,
        storeId: input.storeId,
        ownerId: input.ownerId,
        entityType: 'review',
        entityId: input.reviewId,
    });

    return { complaintText };
}
