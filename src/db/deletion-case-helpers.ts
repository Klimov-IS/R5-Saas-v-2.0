/**
 * Deletion Case Tracking Helpers
 *
 * Database helpers for managing review deletion workflow.
 * Tracks entire journey: offer → agreement → refund → deletion → revenue (600₽)
 *
 * Created: 2026-01-16 (Stage 3)
 */

import { query } from './client';

// ============================================================================
// Types
// ============================================================================

export type DeletionCaseStatus =
  | 'offer_generated'
  | 'offer_sent'
  | 'client_replied'
  | 'agreed'
  | 'refund_processing'
  | 'refund_completed'
  | 'deletion_pending'
  | 'deletion_confirmed'
  | 'failed'
  | 'cancelled';

export interface DeletionCase {
  id: string;
  store_id: string;
  owner_id: string;
  chat_id: string;
  review_id: string | null;
  product_id: string | null;

  status: DeletionCaseStatus;

  // Offer details
  offer_amount: number;
  compensation_type: string;
  offer_message: string;
  offer_strategy: string | null;

  // Client interaction
  client_name: string;
  client_response: string | null;
  client_agreed_at: string | null;

  // Review details
  review_rating: number | null;
  review_text: string | null;
  review_status_before: string | null;
  review_deleted_at: string | null;

  // Financial tracking
  refund_processed_at: string | null;
  refund_amount: number | null;
  revenue_charged: number | null;
  revenue_charged_at: string | null;

  // AI metadata
  ai_confidence: number | null;
  ai_estimated_success: number | null;
  triggers_detected: string[] | null;

  // Workflow tracking
  offer_generated_at: string;
  offer_sent_at: string | null;
  last_updated_at: string;

  // Failure tracking
  failed_at: string | null;
  failure_reason: string | null;

  metadata: any | null;

  created_at: string;
  updated_at: string;
}

// ============================================================================
// Create & Update Functions
// ============================================================================

/**
 * Create new deletion case after AI generated offer
 */
export async function createDeletionCase(data: {
  store_id: string;
  owner_id: string;
  chat_id: string;
  review_id?: string | null;
  product_id?: string | null;

  offer_amount: number;
  compensation_type: 'cashback' | 'refund';
  offer_message: string;
  offer_strategy?: string;

  client_name: string;
  review_rating?: number;
  review_text?: string;

  ai_confidence?: number;
  ai_estimated_success?: number;
  triggers_detected?: string[];

  metadata?: any;
}): Promise<DeletionCase> {
  const sql = `
    INSERT INTO review_deletion_cases (
      store_id, owner_id, chat_id, review_id, product_id,
      status, offer_amount, compensation_type, offer_message, offer_strategy,
      client_name, review_rating, review_text,
      ai_confidence, ai_estimated_success, triggers_detected,
      metadata
    ) VALUES (
      $1, $2, $3, $4, $5,
      'offer_generated', $6, $7, $8, $9,
      $10, $11, $12,
      $13, $14, $15,
      $16
    )
    RETURNING *
  `;

  const result = await query<DeletionCase>(sql, [
    data.store_id,
    data.owner_id,
    data.chat_id,
    data.review_id || null,
    data.product_id || null,
    data.offer_amount,
    data.compensation_type,
    data.offer_message,
    data.offer_strategy || null,
    data.client_name,
    data.review_rating || null,
    data.review_text || null,
    data.ai_confidence || null,
    data.ai_estimated_success || null,
    data.triggers_detected || null,
    data.metadata ? JSON.stringify(data.metadata) : null,
  ]);

  return result.rows[0];
}

/**
 * Update deletion case status
 */
export async function updateDeletionCaseStatus(
  caseId: string,
  status: DeletionCaseStatus,
  additionalData?: {
    client_response?: string;
    client_agreed_at?: Date;
    refund_processed_at?: Date;
    refund_amount?: number;
    review_deleted_at?: Date;
    revenue_charged?: number;
    revenue_charged_at?: Date;
    failed_at?: Date;
    failure_reason?: string;
    offer_sent_at?: Date;
  }
): Promise<DeletionCase | null> {
  const updates: string[] = ['status = $2'];
  const values: any[] = [caseId, status];
  let paramIndex = 3;

  if (additionalData?.client_response !== undefined) {
    updates.push(`client_response = $${paramIndex++}`);
    values.push(additionalData.client_response);
  }

  if (additionalData?.client_agreed_at) {
    updates.push(`client_agreed_at = $${paramIndex++}`);
    values.push(additionalData.client_agreed_at.toISOString());
  }

  if (additionalData?.refund_processed_at) {
    updates.push(`refund_processed_at = $${paramIndex++}`);
    values.push(additionalData.refund_processed_at.toISOString());
  }

  if (additionalData?.refund_amount !== undefined) {
    updates.push(`refund_amount = $${paramIndex++}`);
    values.push(additionalData.refund_amount);
  }

  if (additionalData?.review_deleted_at) {
    updates.push(`review_deleted_at = $${paramIndex++}`);
    values.push(additionalData.review_deleted_at.toISOString());
  }

  if (additionalData?.revenue_charged !== undefined) {
    updates.push(`revenue_charged = $${paramIndex++}`);
    values.push(additionalData.revenue_charged);
  }

  if (additionalData?.revenue_charged_at) {
    updates.push(`revenue_charged_at = $${paramIndex++}`);
    values.push(additionalData.revenue_charged_at.toISOString());
  }

  if (additionalData?.failed_at) {
    updates.push(`failed_at = $${paramIndex++}`);
    values.push(additionalData.failed_at.toISOString());
  }

  if (additionalData?.failure_reason) {
    updates.push(`failure_reason = $${paramIndex++}`);
    values.push(additionalData.failure_reason);
  }

  if (additionalData?.offer_sent_at) {
    updates.push(`offer_sent_at = $${paramIndex++}`);
    values.push(additionalData.offer_sent_at.toISOString());
  }

  const sql = `
    UPDATE review_deletion_cases
    SET ${updates.join(', ')}
    WHERE id = $1
    RETURNING *
  `;

  const result = await query<DeletionCase>(sql, values);
  return result.rows[0] || null;
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get deletion case by ID
 */
export async function getDeletionCaseById(id: string): Promise<DeletionCase | null> {
  const result = await query<DeletionCase>(
    'SELECT * FROM review_deletion_cases WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Get deletion case by chat ID
 */
export async function getDeletionCaseByChatId(chatId: string): Promise<DeletionCase | null> {
  const result = await query<DeletionCase>(
    'SELECT * FROM review_deletion_cases WHERE chat_id = $1 ORDER BY created_at DESC LIMIT 1',
    [chatId]
  );
  return result.rows[0] || null;
}

/**
 * Get all deletion cases for a store
 */
export async function getDeletionCasesByStore(
  storeId: string,
  options?: {
    status?: DeletionCaseStatus | DeletionCaseStatus[];
    limit?: number;
    offset?: number;
  }
): Promise<DeletionCase[]> {
  let sql = 'SELECT * FROM review_deletion_cases WHERE store_id = $1';
  const params: any[] = [storeId];
  let paramIndex = 2;

  if (options?.status) {
    const statuses = Array.isArray(options.status) ? options.status : [options.status];
    sql += ` AND status = ANY($${paramIndex++})`;
    params.push(statuses);
  }

  sql += ' ORDER BY created_at DESC';

  if (options?.limit) {
    sql += ` LIMIT $${paramIndex++}`;
    params.push(options.limit);
  }

  if (options?.offset) {
    sql += ` OFFSET $${paramIndex++}`;
    params.push(options.offset);
  }

  const result = await query<DeletionCase>(sql, params);
  return result.rows;
}

/**
 * Get deletion cases pending review deletion confirmation
 * (Used by CRON job to check WB API)
 */
export async function getPendingDeletionCases(storeId?: string): Promise<DeletionCase[]> {
  let sql = `
    SELECT * FROM review_deletion_cases
    WHERE status = 'deletion_pending'
      AND review_id IS NOT NULL
  `;

  const params: any[] = [];

  if (storeId) {
    sql += ' AND store_id = $1';
    params.push(storeId);
  }

  sql += ' ORDER BY client_agreed_at ASC';

  const result = await query<DeletionCase>(sql, params);
  return result.rows;
}

// ============================================================================
// Analytics Functions
// ============================================================================

/**
 * Get deletion funnel metrics for a store
 */
export async function getDeletionFunnelMetrics(
  storeId: string,
  timeRange?: { start: Date; end: Date }
): Promise<{
  offerGenerated: number;
  offerSent: number;
  clientReplied: number;
  agreed: number;
  refundCompleted: number;
  deletionConfirmed: number;
  failed: number;
  cancelled: number;
  totalRevenue: number;
  avgOfferAmount: number;
  avgTimeToAgreement: number | null; // Hours
  avgTimeToConfirmation: number | null; // Hours
  conversionRates: {
    sentToReplied: number;
    repliedToAgreed: number;
    agreedToConfirmed: number;
    overallSuccess: number;
  };
}> {
  let timeFilter = '';
  const params: any[] = [storeId];

  if (timeRange) {
    timeFilter = ' AND created_at >= $2 AND created_at <= $3';
    params.push(timeRange.start.toISOString(), timeRange.end.toISOString());
  }

  const sql = `
    SELECT
      COUNT(*) FILTER (WHERE status = 'offer_generated') as offer_generated,
      COUNT(*) FILTER (WHERE status = 'offer_sent') as offer_sent,
      COUNT(*) FILTER (WHERE status = 'client_replied') as client_replied,
      COUNT(*) FILTER (WHERE status = 'agreed') as agreed,
      COUNT(*) FILTER (WHERE status = 'refund_completed') as refund_completed,
      COUNT(*) FILTER (WHERE status = 'deletion_confirmed') as deletion_confirmed,
      COUNT(*) FILTER (WHERE status = 'failed') as failed,
      COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
      COALESCE(SUM(revenue_charged), 0) as total_revenue,
      COALESCE(AVG(offer_amount), 0) as avg_offer_amount,
      AVG(EXTRACT(EPOCH FROM (client_agreed_at - offer_sent_at)) / 3600) as avg_hours_to_agreement,
      AVG(EXTRACT(EPOCH FROM (review_deleted_at - client_agreed_at)) / 3600) as avg_hours_to_confirmation
    FROM review_deletion_cases
    WHERE store_id = $1 ${timeFilter}
  `;

  const result = await query<any>(sql, params);
  const data = result.rows[0];

  const offerSent = parseInt(data.offer_sent, 10);
  const clientReplied = parseInt(data.client_replied, 10);
  const agreed = parseInt(data.agreed, 10);
  const deletionConfirmed = parseInt(data.deletion_confirmed, 10);
  const offerGenerated = parseInt(data.offer_generated, 10);

  return {
    offerGenerated,
    offerSent,
    clientReplied,
    agreed: parseInt(data.agreed, 10),
    refundCompleted: parseInt(data.refund_completed, 10),
    deletionConfirmed,
    failed: parseInt(data.failed, 10),
    cancelled: parseInt(data.cancelled, 10),
    totalRevenue: parseInt(data.total_revenue, 10),
    avgOfferAmount: Math.round(parseFloat(data.avg_offer_amount)),
    avgTimeToAgreement: data.avg_hours_to_agreement ? parseFloat(data.avg_hours_to_agreement) : null,
    avgTimeToConfirmation: data.avg_hours_to_confirmation ? parseFloat(data.avg_hours_to_confirmation) : null,
    conversionRates: {
      sentToReplied: offerSent > 0 ? clientReplied / offerSent : 0,
      repliedToAgreed: clientReplied > 0 ? agreed / clientReplied : 0,
      agreedToConfirmed: agreed > 0 ? deletionConfirmed / agreed : 0,
      overallSuccess: offerGenerated > 0 ? deletionConfirmed / offerGenerated : 0,
    },
  };
}

/**
 * Get revenue summary for a store
 */
export async function getRevenueSummary(
  storeId: string,
  timeRange?: { start: Date; end: Date }
): Promise<{
  totalRevenue: number;        // Total 600₽ × confirmed deletions
  totalOfferAmount: number;    // Total compensation promised
  totalRefundAmount: number;   // Total compensation actually paid
  netProfit: number;           // Revenue - refunds
  caseCount: number;
  avgProfit: number;           // Net profit per case
}> {
  let timeFilter = '';
  const params: any[] = [storeId];

  if (timeRange) {
    timeFilter = ' AND created_at >= $2 AND created_at <= $3';
    params.push(timeRange.start.toISOString(), timeRange.end.toISOString());
  }

  const sql = `
    SELECT
      COALESCE(SUM(revenue_charged), 0) as total_revenue,
      COALESCE(SUM(offer_amount), 0) as total_offer_amount,
      COALESCE(SUM(refund_amount), 0) as total_refund_amount,
      COUNT(*) as case_count
    FROM review_deletion_cases
    WHERE store_id = $1
      AND status = 'deletion_confirmed'
      ${timeFilter}
  `;

  const result = await query<any>(sql, params);
  const data = result.rows[0];

  const totalRevenue = parseInt(data.total_revenue, 10);
  const totalRefundAmount = parseInt(data.total_refund_amount, 10);
  const caseCount = parseInt(data.case_count, 10);
  const netProfit = totalRevenue - totalRefundAmount;

  return {
    totalRevenue,
    totalOfferAmount: parseInt(data.total_offer_amount, 10),
    totalRefundAmount,
    netProfit,
    caseCount,
    avgProfit: caseCount > 0 ? Math.round(netProfit / caseCount) : 0,
  };
}

/**
 * Get cases by AI confidence range
 * (Useful for evaluating AI accuracy)
 */
export async function getCasesByConfidenceRange(
  storeId: string,
  minConfidence: number,
  maxConfidence: number
): Promise<{
  total: number;
  confirmed: number;
  failed: number;
  accuracyRate: number;
}> {
  const sql = `
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'deletion_confirmed') as confirmed,
      COUNT(*) FILTER (WHERE status = 'failed') as failed
    FROM review_deletion_cases
    WHERE store_id = $1
      AND ai_estimated_success >= $2
      AND ai_estimated_success < $3
      AND status IN ('deletion_confirmed', 'failed')
  `;

  const result = await query<any>(sql, [storeId, minConfidence, maxConfidence]);
  const data = result.rows[0];

  const total = parseInt(data.total, 10);
  const confirmed = parseInt(data.confirmed, 10);

  return {
    total,
    confirmed,
    failed: parseInt(data.failed, 10),
    accuracyRate: total > 0 ? confirmed / total : 0,
  };
}
