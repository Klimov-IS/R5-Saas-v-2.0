/**
 * SequenceRepository — SQL encapsulation for auto-sequence operations.
 *
 * PR-13: Extract from SequenceService
 */
import { query } from '@/db/client';

export interface CreateSequenceParams {
  chatId: string;
  storeId: string;
  ownerId: string;
  sequenceType: string;
  templates: any[];
  nextSendAt: string;
}

/**
 * Insert a new auto-sequence row.
 * @returns The created sequence row or null on failure.
 */
export async function createSequence(params: CreateSequenceParams) {
  const { chatId, storeId, ownerId, sequenceType, templates, nextSendAt } = params;
  const result = await query(
    `INSERT INTO chat_auto_sequences
      (chat_id, store_id, owner_id, sequence_type, messages, max_steps, next_send_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
    [chatId, storeId, ownerId, sequenceType, JSON.stringify(templates), templates.length, nextSendAt]
  );
  return result.rows[0] || null;
}
