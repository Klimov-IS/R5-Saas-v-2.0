'use server';
/**
 * @fileOverview Flow for generating a reply to a customer's product question.
 * Migrated from Firebase to PostgreSQL.
 *
 * - generateQuestionReply - A function that handles the reply generation process.
 * - GenerateQuestionReplyInput - The input type for the generateQuestionReply function.
 * - GenerateQuestionReplyOutput - The return type for the generateQuestionReply function.
 */
import { runChatCompletion } from '../assistant-utils';
import { z } from 'zod';
import * as dbHelpers from '@/db/helpers';

const GenerateQuestionReplyInputSchema = z.object({
    storeName: z.string().describe('The name of the store.'),
    questionText: z.string().describe("The customer's question text."),
    productName: z.string().describe('The name of the product being asked about.'),
    productVendorCode: z.string().describe('The vendor code (article) of the product.'),
    productCharacteristics: z.string().optional().describe('A JSON string of product characteristics (name-value pairs).'),
    storeId: z.string().describe('Store ID for logging'),
    ownerId: z.string().describe('Owner ID for logging'),
    questionId: z.string().describe('Question ID for logging'),
});
export type GenerateQuestionReplyInput = z.infer<typeof GenerateQuestionReplyInputSchema>;

const GenerateQuestionReplyOutputSchema = z.object({
  replyText: z.string().describe('The generated reply to the customer.'),
});
export type GenerateQuestionReplyOutput = z.infer<typeof GenerateQuestionReplyOutputSchema>;


export async function generateQuestionReply(input: GenerateQuestionReplyInput): Promise<GenerateQuestionReplyOutput> {
  const { storeName, questionText, productName, productVendorCode, productCharacteristics, storeId, ownerId, questionId } = input;

  const userContent = `
**Store Name:** ${storeName}

**Question Context:**
- **Question:** "${questionText}"

**Product Context:**
- **Product Name:** ${productName}
- **Vendor Code:** ${productVendorCode}
- **Characteristics:** ${productCharacteristics || 'N/A'}
  `;

  // Get settings from PostgreSQL
  const settings = await dbHelpers.getUserSettings();

  if (!settings) {
    throw new Error("Не найдены настройки AI.");
  }
  const systemPrompt = settings.prompt_question_reply;

  if (!systemPrompt) {
    throw new Error("Системный промт для ответов на вопросы не найден в настройках.");
  }

  const replyText = await runChatCompletion({
    operation: 'generate-question-reply',
    systemPrompt: systemPrompt,
    userContent,
    storeId,
    ownerId,
    entityType: 'question',
    entityId: questionId,
  });

  return { replyText };
}
