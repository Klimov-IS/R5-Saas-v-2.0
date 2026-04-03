/**
 * Shared utility for sending auto-sequence messages.
 * Used by both the TG sequence start API (immediate first message)
 * and the cron processor (subsequent messages).
 */
import * as dbHelpers from '@/db/helpers';
import { getDaysUntilNextMessage, type SequenceMessage } from '@/lib/auto-sequence-templates';
import { sendMessageToMarketplace } from '@/core/services/message-sender';
import { CHAT_ALLOWED_STAGES } from '@/types/stores';

interface SendSequenceMessageParams {
  sequenceId: string;
  chatId: string;
  storeId: string;
  ownerId: string;
  currentStep: number;
  templates: SequenceMessage[];
}

/**
 * Send a single auto-sequence message and advance the sequence.
 *
 * Handles:
 * - Marketplace-aware dispatch via sendMessageToMarketplace (WB / OZON)
 * - Recording sent message in chat_messages
 * - Updating chat's last_message_* fields
 * - Advancing the sequence to the next step
 *
 * Does NOT check stop conditions — caller's responsibility.
 */
export async function sendSequenceMessage(
  params: SendSequenceMessageParams
): Promise<{ sent: boolean; error?: string; errorMessage?: string }> {
  const { sequenceId, chatId, storeId, ownerId, currentStep, templates } = params;

  const template = templates[currentStep];
  if (!template) {
    return { sent: false, error: 'No template at current step' };
  }

  const store = await dbHelpers.getStoreById(storeId);
  if (!store) {
    return { sent: false, error: 'Store not found' };
  }
  if (!store.is_active) {
    return { sent: false, error: 'permanent', errorMessage: 'Store is inactive (is_active=false)' };
  }
  if (!CHAT_ALLOWED_STAGES.includes(store.stage as any)) {
    return { sent: false, error: 'permanent', errorMessage: `Store stage=${store.stage} not in allowed stages` };
  }

  // Send message via shared marketplace dispatch (no replySign — helper fetches it for WB)
  const result = await sendMessageToMarketplace({
    store,
    chatId,
    message: template.text,
  });

  if (!result.sent) {
    console.error(
      `[AUTO-SEQ-SEND] ${result.error === 'permanent' ? 'PERMANENT' : 'TRANSIENT'} error ` +
      `step ${currentStep} for chat ${chatId} (seq ${sequenceId}): ${result.errorMessage}`
    );
    return { sent: false, error: result.error, errorMessage: result.errorMessage };
  }

  console.log(`[AUTO-SEQ-SEND] Sent step ${currentStep} for chat ${chatId} (seq ${sequenceId})`);

  // Record sent message in chat_messages
  const msgId = `auto_${sequenceId}_${currentStep}`;
  await dbHelpers.createChatMessage({
    id: msgId,
    chat_id: chatId,
    store_id: storeId,
    owner_id: ownerId,
    sender: 'seller',
    text: template.text,
    timestamp: new Date().toISOString(),
    is_auto_reply: true,
  });

  // Update chat's last message info
  await dbHelpers.updateChat(chatId, {
    last_message_text: template.text,
    last_message_sender: 'seller',
    last_message_date: new Date().toISOString(),
  });

  // Advance sequence — compute days until next message based on template schedule
  const daysAhead = getDaysUntilNextMessage(templates, currentStep + 1);
  await dbHelpers.advanceSequence(sequenceId, daysAhead || 1);

  return { sent: true };
}
