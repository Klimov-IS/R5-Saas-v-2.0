'use server';
/**
 * @fileOverview Advanced chat classification for deletion workflow
 *
 * Classifies chats into expanded tag taxonomy including deletion opportunity detection.
 * Integrates regex-based trigger phrase detection with AI-powered context analysis.
 *
 * Business Goal: 600₽ ROI per successfully deleted review
 * Created: 2026-01-16 (Stage 2)
 */

import { runChatCompletion } from '../assistant-utils';
import { z } from 'zod';
import * as dbHelpers from '@/db/helpers';
import { detectDeletionIntent } from '@/db/chat-deletion-helpers';

// ============================================================================
// Input/Output Schemas
// ============================================================================

const ClassifyChatDeletionInputSchema = z.object({
  chatHistory: z.string().describe('The full conversation history as a single string.'),
  lastMessageText: z.string().describe('The last message text for quick regex analysis.'),
  storeId: z.string().describe('Store ID for logging'),
  ownerId: z.string().describe('Owner ID for logging'),
  chatId: z.string().describe('Chat ID for logging'),
  productName: z.string().optional().describe('Product name for context'),
  // Product rules context (optional)
  productRules: z.object({
    work_in_chats: z.boolean(),
    offer_compensation: z.boolean(),
    chat_strategy: z.enum(['upgrade_to_5', 'delete', 'both']).optional(),
    max_compensation: z.string().optional(),
  }).optional(),
  storeInstructions: z.string().optional().describe('Store-specific AI instructions'),
});
export type ClassifyChatDeletionInput = z.infer<typeof ClassifyChatDeletionInputSchema>;

/**
 * Extended tag taxonomy for deletion workflow
 */
const ClassifyChatDeletionOutputSchema = z.object({
  tag: z.enum([
    // Original tags
    'active',
    'successful',
    'unsuccessful',
    'no_reply',
    'untagged',
    'completed',
    // Deletion workflow tags
    'deletion_candidate',    // AI identified deletion opportunity
    'deletion_offered',      // Compensation offer sent (managed by workflow)
    'deletion_agreed',       // Client agreed to delete (managed by workflow)
    'deletion_confirmed',    // Review deleted (managed by workflow)
    'refund_requested',      // Client wants refund
    'spam',                  // Spam or competitor messages
  ]).describe('The classified tag for the chat.'),
  confidence: z.number().min(0).max(1).describe('Classification confidence (0-1)'),
  reasoning: z.string().optional().describe('AI reasoning for debugging'),
  triggers: z.array(z.string()).optional().describe('Detected trigger phrases'),
});
export type ClassifyChatDeletionOutput = z.infer<typeof ClassifyChatDeletionOutputSchema>;

// ============================================================================
// Main Classification Function
// ============================================================================

/**
 * Classify chat with deletion workflow awareness
 *
 * Two-stage approach:
 * 1. Fast regex-based detection (80%+ confidence triggers)
 * 2. AI-powered deep analysis for edge cases
 *
 * @param input - Chat context with history and metadata
 * @returns Classification result with tag and confidence
 */
export async function classifyChatDeletion(
  input: ClassifyChatDeletionInput
): Promise<ClassifyChatDeletionOutput> {
  // Prevent calling AI for empty chats
  if (!input.chatHistory || input.chatHistory.trim().length < 10) {
    return {
      tag: 'untagged',
      confidence: 1.0,
      reasoning: 'Empty chat history',
      triggers: [],
    };
  }

  // Stage 1: Fast regex-based detection
  const regexAnalysis = detectDeletionIntent(input.lastMessageText);

  // High confidence regex match → Skip AI, return immediately
  if (regexAnalysis.isDeletionCandidate && regexAnalysis.confidence >= 0.90) {
    return {
      tag: 'deletion_candidate',
      confidence: regexAnalysis.confidence,
      reasoning: 'High-confidence regex match',
      triggers: regexAnalysis.triggers,
    };
  }

  // Spam detection (regex-based, always high confidence)
  if (regexAnalysis.triggers.includes('spam_caps')) {
    return {
      tag: 'spam',
      confidence: 1.0,
      reasoning: 'Spam detected (ALL CAPS)',
      triggers: ['spam_caps'],
    };
  }

  // Stage 2: AI-powered classification for complex cases
  try {
    // Get settings from PostgreSQL
    const settings = await dbHelpers.getUserSettings();

    if (!settings) {
      throw new Error("Не найдены настройки AI.");
    }

    // Use deletion-specific prompt if available, fallback to general chat tag prompt
    let systemPrompt = settings.prompt_chat_deletion_tag || settings.prompt_chat_tag;

    if (!systemPrompt) {
      console.warn("No AI prompt found, falling back to regex-only classification");

      // Fallback to regex result with lower confidence
      if (regexAnalysis.isDeletionCandidate) {
        return {
          tag: 'deletion_candidate',
          confidence: regexAnalysis.confidence,
          reasoning: 'Regex-only (no AI prompt configured)',
          triggers: regexAnalysis.triggers,
        };
      }

      return {
        tag: 'active',
        confidence: 0.5,
        reasoning: 'No AI prompt configured, defaulting to active',
        triggers: [],
      };
    }

    // Inject store-specific instructions
    if (input.storeInstructions) {
      systemPrompt += `\n\n## Инструкции магазина\n${input.storeInstructions}`;
    }

    // Build context for AI
    let userContent = `**История переписки:**\n${input.chatHistory}`;

    // Add product context if available
    if (input.productName) {
      userContent += `\n\n**Товар:** ${input.productName}`;
    }

    // Add product rules context
    if (input.productRules) {
      userContent += `\n\n**Настройки товара:**`;
      userContent += `\n- Работа в чатах: ${input.productRules.work_in_chats ? 'включена' : 'отключена'}`;
      userContent += `\n- Предложение компенсации: ${input.productRules.offer_compensation ? 'разрешено' : 'запрещено'}`;
      if (input.productRules.chat_strategy) {
        userContent += `\n- Стратегия: ${input.productRules.chat_strategy}`;
      }
      if (input.productRules.max_compensation) {
        userContent += `\n- Макс. компенсация: ${input.productRules.max_compensation} руб`;
      }
    }

    // Add regex hints to AI
    if (regexAnalysis.triggers.length > 0) {
      userContent += `\n\n**Обнаруженные триггеры:** ${regexAnalysis.triggers.join(', ')}`;
      userContent += `\n**Уверенность (regex):** ${(regexAnalysis.confidence * 100).toFixed(0)}%`;
    }

    // Call Deepseek AI
    const rawOutput = await runChatCompletion({
      operation: 'classify-chat-deletion',
      systemPrompt: systemPrompt,
      userContent: userContent,
      isJsonMode: true,
      storeId: input.storeId,
      ownerId: input.ownerId,
      entityType: 'chat',
      entityId: input.chatId,
    });

    // Parse and validate AI response
    const parsedOutput = JSON.parse(rawOutput);
    const result = ClassifyChatDeletionOutputSchema.safeParse(parsedOutput);

    if (!result.success) {
      console.error("AI classify-chat-deletion validation failed:", result.error);

      // Fallback to regex result if available
      if (regexAnalysis.isDeletionCandidate) {
        return {
          tag: 'deletion_candidate',
          confidence: regexAnalysis.confidence,
          reasoning: 'AI validation failed, using regex result',
          triggers: regexAnalysis.triggers,
        };
      }

      return {
        tag: 'untagged',
        confidence: 0.3,
        reasoning: 'AI validation failed, no regex match',
        triggers: [],
      };
    }

    // Merge AI result with regex triggers
    return {
      ...result.data,
      triggers: [
        ...(result.data.triggers || []),
        ...regexAnalysis.triggers,
      ],
    };

  } catch (error) {
    console.error('Error running chat deletion classification:', error);

    // Fallback to regex result if AI fails
    if (regexAnalysis.isDeletionCandidate) {
      return {
        tag: 'deletion_candidate',
        confidence: regexAnalysis.confidence,
        reasoning: `AI error: ${error instanceof Error ? error.message : 'Unknown'}`,
        triggers: regexAnalysis.triggers,
      };
    }

    // Last resort: tag as active for manual review
    return {
      tag: 'active',
      confidence: 0.5,
      reasoning: 'Error during classification, needs manual review',
      triggers: [],
    };
  }
}

// ============================================================================
// Bulk Classification
// ============================================================================

/**
 * Classify multiple chats in batch
 *
 * @param chatIds - Array of chat IDs to classify
 * @param storeId - Store ID
 * @returns Array of classification results
 */
export async function bulkClassifyChatsForDeletion(
  chatIds: string[],
  storeId: string
): Promise<Array<{
  chatId: string;
  result: ClassifyChatDeletionOutput;
  error?: string;
}>> {
  const results: Array<{
    chatId: string;
    result: ClassifyChatDeletionOutput;
    error?: string;
  }> = [];

  for (const chatId of chatIds) {
    try {
      // Get chat with full context
      const chat = await dbHelpers.getChatById(chatId);

      if (!chat) {
        results.push({
          chatId,
          result: {
            tag: 'untagged',
            confidence: 0,
            reasoning: 'Chat not found',
          },
          error: 'Chat not found',
        });
        continue;
      }

      // Get chat messages for history
      const messages = await dbHelpers.getChatMessages(chatId);
      const chatHistory = messages
        .map(msg => {
          const sender = msg.sender === 'client' ? 'Клиент' : 'Продавец';
          return `${sender}: ${msg.text || '(без текста)'}`;
        })
        .join('\n');

      // Get product rules if available
      let productRules = null;
      if (chat.product_nm_id) {
        // Try to get product and its rules
        // Note: This requires product lookup by wb_product_id
        // Implementation depends on available helpers
      }

      // Classify
      const result = await classifyChatDeletion({
        chatHistory,
        lastMessageText: chat.last_message_text || '',
        storeId: chat.store_id,
        ownerId: chat.owner_id,
        chatId: chat.id,
        productName: chat.product_name || undefined,
        productRules: productRules || undefined,
      });

      // Update chat tag in database
      await dbHelpers.updateChatTag(chatId, result.tag);

      results.push({
        chatId,
        result,
      });

    } catch (error) {
      console.error(`Error classifying chat ${chatId}:`, error);
      results.push({
        chatId,
        result: {
          tag: 'untagged',
          confidence: 0,
          reasoning: 'Classification error',
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}
