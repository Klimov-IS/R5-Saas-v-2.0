'use server';
/**
 * @fileOverview Flow for generating a reply to a customer in a chat using Deepseek.
 * Migrated from Firebase to PostgreSQL.
 *
 * - generateChatReply - A function that handles the reply generation process.
 * - GenerateChatReplyInput - The input type for the generateChatReply function.
 * - GenerateChatReplyOutput - The return type for the generateChatReply function.
 */

import { runChatCompletion } from '../assistant-utils';
import * as dbHelpers from '@/db/helpers';
import { z } from 'zod';

const GenerateChatReplyInputSchema = z.object({
  context: z.string().describe("The full context including store info, product info, and chat history"),
  storeId: z.string().describe('Store ID for logging'),
  ownerId: z.string().describe('Owner ID for logging'),
  chatId: z.string().describe('Chat ID for logging'),
  storeInstructions: z.string().optional().describe('Store-specific AI instructions'),
});

export type GenerateChatReplyInput = z.infer<typeof GenerateChatReplyInputSchema>;

export interface GenerateChatReplyOutput {
    text: string;
}

export async function generateChatReply(input: GenerateChatReplyInput): Promise<GenerateChatReplyOutput> {
  const { context, storeId, ownerId, chatId, storeInstructions } = input;

  // Get settings from PostgreSQL
  const settings = await dbHelpers.getUserSettings();

  if (!settings) {
    throw new Error("Не найдены настройки AI.");
  }

  let systemPrompt = settings.prompt_chat_reply;

  if (!systemPrompt) {
    throw new Error("Системный промт для ответов в чатах не найден в настройках.");
  }

  // Inject store-specific instructions
  if (storeInstructions) {
    systemPrompt += `\n\n## Инструкции магазина\n${storeInstructions}`;
  }

  const text = await runChatCompletion({
    operation: 'generate-chat-reply',
    systemPrompt: systemPrompt,
    userContent: context,
    storeId,
    ownerId,
    entityType: 'chat',
    entityId: chatId,
  });

  return { text };
}
