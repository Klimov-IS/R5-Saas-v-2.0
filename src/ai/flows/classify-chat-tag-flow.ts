'use server';
/**
 * @fileOverview Flow for classifying a chat into a specific tag based on its content.
 * Migrated from Firebase to PostgreSQL.
 *
 * - classifyChatTag - A function that handles the chat classification.
 * - ClassifyChatTagInput - The input type for the classifyChatTag function.
 * - ClassifyChatTagOutput - The return type for the classifyChatTag function.
 */

import { runChatCompletion } from '../assistant-utils';
import { z } from 'zod';
import * as dbHelpers from '@/db/helpers';

const ClassifyChatTagInputSchema = z.object({
  chatHistory: z.string().describe('The full conversation history as a single string.'),
  storeId: z.string().describe('Store ID for logging'),
  ownerId: z.string().describe('Owner ID for logging'),
  chatId: z.string().describe('Chat ID for logging'),
  storeInstructions: z.string().optional().describe('Store-specific AI instructions'),
});
export type ClassifyChatTagInput = z.infer<typeof ClassifyChatTagInputSchema>;

const ClassifyChatTagOutputSchema = z.object({
  tag: z.enum([
    // Original 6 tags
    'active',
    'successful',
    'unsuccessful',
    'untagged',
    'no_reply',
    'completed',
    // Deletion workflow tags (6 new)
    'deletion_candidate',
    'deletion_offered',
    'deletion_agreed',
    'deletion_confirmed',
    'refund_requested',
    'spam'
  ]).describe('The classified tag for the chat.'),
});
export type ClassifyChatTagOutput = z.infer<typeof ClassifyChatTagOutputSchema>;


export async function classifyChatTag(input: ClassifyChatTagInput): Promise<ClassifyChatTagOutput> {
  // Prevent calling AI for empty chats
  if (!input.chatHistory || input.chatHistory.trim().length < 10) {
    return { tag: 'untagged' };
  }

  try {
    // Get settings from PostgreSQL
    const settings = await dbHelpers.getUserSettings();

    if (!settings) {
      throw new Error("Не найдены настройки AI.");
    }

    let systemPrompt = settings.prompt_chat_tag;

    if (!systemPrompt) {
      throw new Error("Системный промт для тегирования чатов не найден в настройках.");
    }

    // Inject store-specific instructions
    if (input.storeInstructions) {
      systemPrompt += `\n\n## Инструкции магазина\n${input.storeInstructions}`;
    }

    const rawOutput = await runChatCompletion({
      operation: 'classify-chat-tag',
      systemPrompt: systemPrompt,
      userContent: `**История переписки:**\n${input.chatHistory}`,
      isJsonMode: true,
      storeId: input.storeId,
      ownerId: input.ownerId,
      entityType: 'chat',
      entityId: input.chatId,
    });

    const parsedOutput = JSON.parse(rawOutput);
    const result = ClassifyChatTagOutputSchema.safeParse(parsedOutput);

    if (!result.success) {
      console.error("AI classifyChatTag validation failed:", result.error);
      return { tag: 'untagged' };
    }

    return result.data;
  } catch (error) {
    console.error('Error running chat tag classification:', error);
    // Fallback to untagged in case of any error during the assistant run
    return { tag: 'untagged' };
  }
}
