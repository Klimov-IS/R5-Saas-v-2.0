/**
 * SequenceRepository — SQL encapsulation for auto-sequence operations.
 *
 * PR-13: Extract from SequenceService
 */
import { query } from '@/db/client';
import type { PoolClient } from 'pg';

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
 * @param params Sequence creation parameters
 * @param client Optional PoolClient for transaction support
 * @returns The created sequence row or null on failure.
 */
export async function createSequence(params: CreateSequenceParams, client?: PoolClient) {
  const { chatId, storeId, ownerId, sequenceType, templates, nextSendAt } = params;
  const sql = `INSERT INTO chat_auto_sequences
      (chat_id, store_id, owner_id, sequence_type, messages, max_steps, next_send_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`;
  const values = [chatId, storeId, ownerId, sequenceType, JSON.stringify(templates), templates.length, nextSendAt];
  const result = client
    ? await client.query(sql, values)
    : await query(sql, values);
  return result.rows[0] || null;
}
