/**
 * Database helpers for review_complaints table
 *
 * CRUD operations and analytics for AI-generated complaints
 * Relationship: 1:1 with reviews (one complaint per review)
 */

import { query, transaction } from './client';
import type {
  ReviewComplaint,
  CreateReviewComplaintInput,
  UpdateReviewComplaintInput,
  MarkComplaintAsSentInput,
  UpdateComplaintModerationInput,
  ComplaintStats,
  ComplaintStatus,
} from '../types/complaints';

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Get complaint by review ID (1:1 relationship)
 */
export async function getComplaintByReviewId(reviewId: string): Promise<ReviewComplaint | null> {
  const result = await query<ReviewComplaint>(
    'SELECT * FROM review_complaints WHERE review_id = $1',
    [reviewId]
  );
  return result.rows[0] || null;
}

/**
 * Get complaint by complaint ID
 */
export async function getComplaintById(id: string): Promise<ReviewComplaint | null> {
  const result = await query<ReviewComplaint>(
    'SELECT * FROM review_complaints WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Get all complaints for a store
 */
export async function getComplaintsByStore(
  storeId: string,
  options?: {
    status?: ComplaintStatus;
    limit?: number;
    offset?: number;
  }
): Promise<ReviewComplaint[]> {
  let sql = 'SELECT * FROM review_complaints WHERE store_id = $1';
  const params: any[] = [storeId];
  let paramIndex = 2;

  if (options?.status) {
    sql += ` AND status = $${paramIndex}`;
    params.push(options.status);
    paramIndex++;
  }

  sql += ' ORDER BY generated_at DESC';

  if (options?.limit) {
    sql += ` LIMIT $${paramIndex}`;
    params.push(options.limit);
    paramIndex++;
  }

  if (options?.offset) {
    sql += ` OFFSET $${paramIndex}`;
    params.push(options.offset);
  }

  const result = await query<ReviewComplaint>(sql, params);
  return result.rows;
}

/**
 * Bulk create complaints (optimized for mass generation)
 * Creates multiple complaints in a single SQL query (100x faster than individual INSERTs)
 */
export async function bulkCreateComplaints(inputs: CreateReviewComplaintInput[]): Promise<number> {
  if (inputs.length === 0) return 0;

  // Build VALUES clause with parameterized queries
  const valuesPlaceholders = inputs.map((_, i) => {
    const offset = i * 22; // 22 parameters per complaint
    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12}, $${offset + 13}, $${offset + 14}, $${offset + 15}, $${offset + 16}, $${offset + 17}, $${offset + 18}, $${offset + 19}, $${offset + 20}, $${offset + 21}, $${offset + 22}, NOW(), NOW())`;
  }).join(',\n      ');

  // Flatten all parameters
  const params = inputs.flatMap(input => [
    input.review_id,
    input.store_id,
    input.owner_id,
    input.product_id,
    input.complaint_text,
    input.reason_id,
    input.reason_name,
    'draft', // status
    new Date().toISOString(), // generated_at
    0, // regenerated_count
    input.review_rating,
    input.review_text,
    input.review_date,
    input.product_name || null,
    input.product_vendor_code || null,
    input.product_is_active !== false,
    input.ai_model || 'deepseek-chat',
    input.ai_prompt_tokens || null,
    input.ai_completion_tokens || null,
    input.ai_total_tokens || null,
    input.ai_cost_usd || null,
    input.generation_duration_ms || null,
  ]);

  // Execute bulk insert
  const result = await query(
    `INSERT INTO review_complaints (
      review_id, store_id, owner_id, product_id,
      complaint_text, reason_id, reason_name,
      status, generated_at, regenerated_count,
      review_rating, review_text, review_date,
      product_name, product_vendor_code, product_is_active,
      ai_model, ai_prompt_tokens, ai_completion_tokens,
      ai_total_tokens, ai_cost_usd, generation_duration_ms,
      created_at, updated_at
    ) VALUES
      ${valuesPlaceholders}`,
    params
  );

  // Update denormalized fields in reviews table (bulk update)
  const reviewIds = inputs.map(i => i.review_id);
  await query(
    `UPDATE reviews
     SET has_complaint = TRUE, has_complaint_draft = TRUE
     WHERE id = ANY($1::text[])`,
    [reviewIds]
  );

  return result.rowCount ?? 0;
}

/**
 * Create a new complaint (first generation)
 */
export async function createComplaint(input: CreateReviewComplaintInput): Promise<ReviewComplaint> {
  const result = await query<ReviewComplaint>(
    `INSERT INTO review_complaints (
      review_id, store_id, owner_id, product_id,
      complaint_text, reason_id, reason_name,
      status, generated_at, regenerated_count,
      review_rating, review_text, review_date,
      product_name, product_vendor_code, product_is_active,
      ai_model, ai_prompt_tokens, ai_completion_tokens,
      ai_total_tokens, ai_cost_usd, generation_duration_ms,
      created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
      $14, $15, $16, $17, $18, $19, $20, $21, $22, NOW(), NOW()
    )
    RETURNING *`,
    [
      input.review_id,
      input.store_id,
      input.owner_id,
      input.product_id,
      input.complaint_text,
      input.reason_id,
      input.reason_name,
      'draft', // Always starts as draft
      new Date().toISOString(), // generated_at
      0, // regenerated_count starts at 0
      input.review_rating,
      input.review_text,
      input.review_date,
      input.product_name || null,
      input.product_vendor_code || null,
      input.product_is_active !== false,
      input.ai_model || 'deepseek-chat',
      input.ai_prompt_tokens || null,
      input.ai_completion_tokens || null,
      input.ai_total_tokens || null,
      input.ai_cost_usd || null,
      input.generation_duration_ms || null,
    ]
  );

  // Update denormalized fields in reviews table
  await query(
    `UPDATE reviews
     SET has_complaint = TRUE, has_complaint_draft = TRUE
     WHERE id = $1`,
    [input.review_id]
  );

  return result.rows[0];
}

/**
 * Update complaint (regenerate or manual edit)
 * Only allowed if status = 'draft'
 */
export async function updateComplaint(
  reviewId: string,
  updates: UpdateReviewComplaintInput
): Promise<ReviewComplaint | null> {
  // First check if complaint exists and is editable
  const existing = await getComplaintByReviewId(reviewId);
  if (!existing) {
    throw new Error('Complaint not found');
  }
  if (existing.status !== 'draft') {
    throw new Error('Cannot update complaint that is not in draft status');
  }

  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.complaint_text !== undefined) {
    fields.push(`complaint_text = $${paramIndex++}`);
    values.push(updates.complaint_text);
  }

  if (updates.reason_id !== undefined) {
    fields.push(`reason_id = $${paramIndex++}`);
    values.push(updates.reason_id);
  }

  if (updates.reason_name !== undefined) {
    fields.push(`reason_name = $${paramIndex++}`);
    values.push(updates.reason_name);
  }

  if (updates.regenerated_count !== undefined) {
    fields.push(`regenerated_count = $${paramIndex++}`);
    values.push(updates.regenerated_count);
  }

  if (updates.last_regenerated_at !== undefined) {
    fields.push(`last_regenerated_at = $${paramIndex++}`);
    values.push(updates.last_regenerated_at);
  }

  // AI metadata updates
  if (updates.ai_prompt_tokens !== undefined) {
    fields.push(`ai_prompt_tokens = $${paramIndex++}`);
    values.push(updates.ai_prompt_tokens);
  }

  if (updates.ai_completion_tokens !== undefined) {
    fields.push(`ai_completion_tokens = $${paramIndex++}`);
    values.push(updates.ai_completion_tokens);
  }

  if (updates.ai_total_tokens !== undefined) {
    fields.push(`ai_total_tokens = $${paramIndex++}`);
    values.push(updates.ai_total_tokens);
  }

  if (updates.ai_cost_usd !== undefined) {
    fields.push(`ai_cost_usd = $${paramIndex++}`);
    values.push(updates.ai_cost_usd);
  }

  if (updates.generation_duration_ms !== undefined) {
    fields.push(`generation_duration_ms = $${paramIndex++}`);
    values.push(updates.generation_duration_ms);
  }

  if (fields.length === 0) {
    return existing;
  }

  fields.push(`updated_at = NOW()`);
  values.push(reviewId);

  const result = await query<ReviewComplaint>(
    `UPDATE review_complaints
     SET ${fields.join(', ')}
     WHERE review_id = $${paramIndex}
     RETURNING *`,
    values
  );

  return result.rows[0] || null;
}

/**
 * Regenerate complaint (increment counter and update content)
 */
export async function regenerateComplaint(
  reviewId: string,
  newComplaintText: string,
  reasonId: number,
  reasonName: string,
  aiMetadata?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    costUsd?: number;
    durationMs?: number;
  }
): Promise<ReviewComplaint | null> {
  const existing = await getComplaintByReviewId(reviewId);
  if (!existing) {
    throw new Error('Complaint not found');
  }
  if (existing.status !== 'draft') {
    throw new Error('Cannot regenerate complaint that is not in draft status');
  }

  return updateComplaint(reviewId, {
    complaint_text: newComplaintText,
    reason_id: reasonId,
    reason_name: reasonName,
    regenerated_count: existing.regenerated_count + 1,
    last_regenerated_at: new Date().toISOString(),
    ai_prompt_tokens: aiMetadata?.promptTokens || null,
    ai_completion_tokens: aiMetadata?.completionTokens || null,
    ai_total_tokens: aiMetadata?.totalTokens || null,
    ai_cost_usd: aiMetadata?.costUsd || null,
    generation_duration_ms: aiMetadata?.durationMs || null,
  });
}

/**
 * Mark complaint as sent (freeze it - no more edits)
 */
export async function markComplaintAsSent(
  reviewId: string,
  input: MarkComplaintAsSentInput
): Promise<ReviewComplaint | null> {
  const existing = await getComplaintByReviewId(reviewId);
  if (!existing) {
    throw new Error('Complaint not found');
  }
  if (existing.status !== 'draft') {
    throw new Error('Complaint is already sent or processed');
  }

  const result = await query<ReviewComplaint>(
    `UPDATE review_complaints
     SET status = 'sent',
         sent_at = NOW(),
         sent_by_user_id = $1,
         updated_at = NOW()
     WHERE review_id = $2
     RETURNING *`,
    [input.sent_by_user_id, reviewId]
  );

  // Update denormalized fields in reviews table
  await query(
    `UPDATE reviews
     SET has_complaint = TRUE,
         has_complaint_draft = FALSE,
         complaint_sent_date = NOW()
     WHERE id = $1`,
    [reviewId]
  );

  return result.rows[0] || null;
}

/**
 * Update complaint moderation status (from WB API sync)
 */
export async function updateComplaintModeration(
  reviewId: string,
  input: UpdateComplaintModerationInput
): Promise<ReviewComplaint | null> {
  const result = await query<ReviewComplaint>(
    `UPDATE review_complaints
     SET status = $1,
         moderated_at = $2,
         wb_response = $3,
         updated_at = NOW()
     WHERE review_id = $4
     RETURNING *`,
    [input.status, input.moderated_at, input.wb_response || null, reviewId]
  );

  return result.rows[0] || null;
}

/**
 * Delete complaint (cascade delete not needed, just remove record)
 */
export async function deleteComplaint(reviewId: string): Promise<boolean> {
  const result = await query(
    'DELETE FROM review_complaints WHERE review_id = $1',
    [reviewId]
  );

  // Update denormalized fields in reviews table
  if ((result.rowCount ?? 0) > 0) {
    await query(
      `UPDATE reviews
       SET has_complaint = FALSE,
           has_complaint_draft = FALSE
       WHERE id = $1`,
      [reviewId]
    );
  }

  return (result.rowCount ?? 0) > 0;
}

// ============================================================================
// Analytics & Queries
// ============================================================================

/**
 * Get complaint statistics for a store
 */
export async function getComplaintStats(storeId: string): Promise<ComplaintStats> {
  const result = await query<{
    total: string;
    draft: string;
    sent: string;
    pending: string;
    approved: string;
    rejected: string;
    total_tokens: string;
    total_cost: string;
    avg_duration: string;
  }>(
    `SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'draft') as draft,
      COUNT(*) FILTER (WHERE status = 'sent') as sent,
      COUNT(*) FILTER (WHERE status = 'pending') as pending,
      COUNT(*) FILTER (WHERE status = 'approved') as approved,
      COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
      COALESCE(SUM(ai_total_tokens), 0) as total_tokens,
      COALESCE(SUM(ai_cost_usd), 0) as total_cost,
      COALESCE(AVG(generation_duration_ms), 0) as avg_duration
    FROM review_complaints
    WHERE store_id = $1`,
    [storeId]
  );

  const row = result.rows[0];
  const total = parseInt(row.total, 10);
  const approved = parseInt(row.approved, 10);
  const rejected = parseInt(row.rejected, 10);
  const moderated = approved + rejected;

  return {
    total,
    draft: parseInt(row.draft, 10),
    sent: parseInt(row.sent, 10),
    pending: parseInt(row.pending, 10),
    approved,
    rejected,
    total_tokens: parseInt(row.total_tokens, 10),
    total_cost_usd: parseFloat(row.total_cost),
    avg_cost_per_complaint: total > 0 ? parseFloat(row.total_cost) / total : 0,
    avg_generation_duration_ms: parseFloat(row.avg_duration),
    approval_rate: moderated > 0 ? (approved / moderated) * 100 : 0,
    rejection_rate: moderated > 0 ? (rejected / moderated) * 100 : 0,
  };
}

/**
 * Get complaints by reason (category analysis)
 */
export async function getComplaintsByReason(storeId: string): Promise<Array<{
  reason_id: number;
  reason_name: string;
  count: number;
  approved: number;
  rejected: number;
  approval_rate: number;
}>> {
  const result = await query<{
    reason_id: number;
    reason_name: string;
    count: string;
    approved: string;
    rejected: string;
  }>(
    `SELECT
      reason_id,
      reason_name,
      COUNT(*) as count,
      COUNT(*) FILTER (WHERE status = 'approved') as approved,
      COUNT(*) FILTER (WHERE status = 'rejected') as rejected
    FROM review_complaints
    WHERE store_id = $1
      AND status IN ('approved', 'rejected')
    GROUP BY reason_id, reason_name
    ORDER BY count DESC`,
    [storeId]
  );

  return result.rows.map(row => {
    const count = parseInt(row.count, 10);
    const approved = parseInt(row.approved, 10);
    const rejected = parseInt(row.rejected, 10);
    const total = approved + rejected;

    return {
      reason_id: row.reason_id,
      reason_name: row.reason_name,
      count,
      approved,
      rejected,
      approval_rate: total > 0 ? (approved / total) * 100 : 0,
    };
  });
}

/**
 * Get daily AI cost tracking
 */
export async function getDailyAICosts(
  storeId: string,
  days: number = 30
): Promise<Array<{
  date: string;
  complaints_generated: number;
  total_tokens: number;
  total_cost_usd: number;
}>> {
  const result = await query<{
    date: string;
    complaints_generated: string;
    total_tokens: string;
    total_cost_usd: string;
  }>(
    `SELECT
      DATE(generated_at) as date,
      COUNT(*) as complaints_generated,
      COALESCE(SUM(ai_total_tokens), 0) as total_tokens,
      COALESCE(SUM(ai_cost_usd), 0) as total_cost_usd
    FROM review_complaints
    WHERE store_id = $1
      AND generated_at >= CURRENT_DATE - INTERVAL '${days} days'
    GROUP BY DATE(generated_at)
    ORDER BY date DESC`,
    [storeId]
  );

  return result.rows.map(row => ({
    date: row.date,
    complaints_generated: parseInt(row.complaints_generated, 10),
    total_tokens: parseInt(row.total_tokens, 10),
    total_cost_usd: parseFloat(row.total_cost_usd),
  }));
}

/**
 * Find reviews eligible for auto-complaint generation
 * Based on documented rules in complaint-auto-generation-rules.md
 */
export async function findEligibleReviewsForComplaints(options?: {
  limit?: number;
  storeId?: string;
}): Promise<Array<{
  review_id: string;
  store_id: string;
  owner_id: string;
  product_id: string;
  rating: number;
  text: string;
  pros: string | null;
  cons: string | null;
  date: string;
  product_name: string | null;
  product_vendor_code: string | null;
  store_name: string;
  store_is_active: boolean;
}>> {
  let sql = `
    SELECT
      r.id as review_id,
      r.store_id,
      r.owner_id,
      r.product_id,
      r.rating,
      r.text,
      r.pros,
      r.cons,
      r.date,
      p.name as product_name,
      p.vendor_code as product_vendor_code,
      s.name as store_name,
      s.status as store_is_active
    FROM reviews r
    INNER JOIN products p ON r.product_id = p.id
    INNER JOIN stores s ON r.store_id = s.id
    WHERE
      -- 1. Rating 1-3 stars
      r.rating IN (1, 2, 3)

      -- 2. Not older than October 1, 2023
      AND r.date >= '2023-10-01'

      -- 3. Product is active
      AND r.is_product_active = TRUE

      -- 4. Store is active
      AND s.status = 'active'

      -- 5. Review status check (currently all reviews are 'unknown', so this is a placeholder for future)
      -- In the future, exclude: 'excluded', 'unpublished' statuses
      AND (r.review_status_wb IS NULL OR r.review_status_wb = 'unknown' OR r.review_status_wb = 'visible')

      -- 6. No complaint exists yet
      AND NOT EXISTS (
        SELECT 1 FROM review_complaints c
        WHERE c.review_id = r.id
      )
  `;

  const params: any[] = [];
  let paramIndex = 1;

  if (options?.storeId) {
    sql += ` AND r.store_id = $${paramIndex}`;
    params.push(options.storeId);
    paramIndex++;
  }

  sql += ' ORDER BY r.date DESC'; // Prioritize recent reviews

  if (options?.limit) {
    sql += ` LIMIT $${paramIndex}`;
    params.push(options.limit);
  }

  const result = await query<any>(sql, params);
  return result.rows;
}

/**
 * Get complaint backlog count (reviews waiting for complaints)
 */
export async function getComplaintBacklogCount(storeId?: string): Promise<number> {
  let sql = `
    SELECT COUNT(*) as count
    FROM reviews r
    INNER JOIN stores s ON r.store_id = s.id
    WHERE r.rating IN (1, 2, 3)
      AND r.date >= '2023-10-01'
      AND r.is_product_active = TRUE
      AND s.status = 'active'
      AND (r.review_status_wb IS NULL OR r.review_status_wb = 'unknown' OR r.review_status_wb = 'visible')
      AND NOT EXISTS (
        SELECT 1 FROM review_complaints c WHERE c.review_id = r.id
      )
  `;

  const params: any[] = [];
  if (storeId) {
    sql += ' AND r.store_id = $1';
    params.push(storeId);
  }

  const result = await query<{ count: string }>(sql, params);
  return parseInt(result.rows[0].count, 10);
}
