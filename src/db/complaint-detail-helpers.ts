/**
 * Complaint Detail Helpers
 *
 * Database helpers for the complaint_details table — source of truth
 * for actually filed & WB-approved complaints.
 * Data comes from Chrome Extension (mirrors Google Sheets "Жалобы V 2.0").
 *
 * @version 1.0.0
 * @date 2026-02-20
 */

import { query } from './client';

// ============================================================================
// Types
// ============================================================================

export interface ComplaintDetail {
  id: string;
  store_id: string;
  owner_id: string;
  check_date: string;
  cabinet_name: string;
  articul: string;
  review_ext_id: string | null;
  feedback_rating: number;
  feedback_date: string;
  complaint_submit_date: string | null;
  status: string;
  has_screenshot: boolean;
  file_name: string;
  drive_link: string | null;
  complaint_category: string;
  complaint_text: string;
  filed_by: string | null;
  review_id: string | null;
  review_complaint_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateComplaintDetailInput {
  store_id: string;
  owner_id: string;
  check_date: string;           // YYYY-MM-DD (already parsed from DD.MM.YYYY)
  cabinet_name: string;
  articul: string;
  review_ext_id?: string | null;
  feedback_rating: number;
  feedback_date: string;         // WB original format string
  complaint_submit_date?: string | null;
  status?: string;
  has_screenshot?: boolean;
  file_name: string;
  drive_link?: string | null;
  complaint_category: string;
  complaint_text: string;
  filed_by?: string | null;
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Create a new complaint detail record.
 * Uses ON CONFLICT on (store_id, articul, feedback_date, file_name) for dedup.
 * Returns { detail, created: true } for new records, { detail, created: false } for duplicates.
 */
export async function createComplaintDetail(
  input: CreateComplaintDetailInput
): Promise<{ detail: ComplaintDetail; created: boolean }> {
  const result = await query<ComplaintDetail>(
    `INSERT INTO complaint_details (
      store_id, owner_id, check_date, cabinet_name, articul,
      review_ext_id, feedback_rating, feedback_date, complaint_submit_date,
      status, has_screenshot, file_name, drive_link,
      complaint_category, complaint_text, filed_by
    ) VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
    ON CONFLICT (store_id, articul, feedback_date, file_name) DO UPDATE SET
      updated_at = NOW()
    RETURNING *`,
    [
      input.store_id,
      input.owner_id,
      input.check_date,
      input.cabinet_name,
      input.articul,
      input.review_ext_id || null,
      input.feedback_rating,
      input.feedback_date,
      input.complaint_submit_date || null,
      input.status || 'approved',
      input.has_screenshot ?? true,
      input.file_name,
      input.drive_link || null,
      input.complaint_category,
      input.complaint_text,
      input.filed_by || null,
    ]
  );

  const detail = result.rows[0];
  // If updated_at ≈ created_at (within 1s), it was a new insert
  const created = Math.abs(
    new Date(detail.created_at).getTime() - new Date(detail.updated_at).getTime()
  ) < 1000;

  return { detail, created };
}

/**
 * Get complaint details by store with optional filters.
 */
export async function getComplaintDetailsByStore(
  storeId: string,
  options?: {
    limit?: number;
    offset?: number;
    articul?: string;
    category?: string;
    fromDate?: string;  // YYYY-MM-DD
    toDate?: string;    // YYYY-MM-DD
  }
): Promise<ComplaintDetail[]> {
  const params: any[] = [storeId];
  const conditions: string[] = ['store_id = $1'];
  let paramIdx = 2;

  if (options?.articul) {
    conditions.push(`articul = $${paramIdx}`);
    params.push(options.articul);
    paramIdx++;
  }
  if (options?.category) {
    conditions.push(`complaint_category = $${paramIdx}`);
    params.push(options.category);
    paramIdx++;
  }
  if (options?.fromDate) {
    conditions.push(`check_date >= $${paramIdx}::date`);
    params.push(options.fromDate);
    paramIdx++;
  }
  if (options?.toDate) {
    conditions.push(`check_date <= $${paramIdx}::date`);
    params.push(options.toDate);
    paramIdx++;
  }

  const limit = options?.limit || 100;
  const offset = options?.offset || 0;

  params.push(limit);
  const limitIdx = paramIdx++;
  params.push(offset);
  const offsetIdx = paramIdx;

  const result = await query<ComplaintDetail>(
    `SELECT * FROM complaint_details
     WHERE ${conditions.join(' AND ')}
     ORDER BY check_date DESC, created_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );

  return result.rows;
}

/**
 * Get single complaint detail by ID.
 */
export async function getComplaintDetailById(
  id: string
): Promise<ComplaintDetail | null> {
  const result = await query<ComplaintDetail>(
    'SELECT * FROM complaint_details WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Count complaint details by store (for stats/pagination).
 */
export async function countComplaintDetailsByStore(
  storeId: string
): Promise<number> {
  const result = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM complaint_details WHERE store_id = $1',
    [storeId]
  );
  return parseInt(result.rows[0]?.count || '0');
}
