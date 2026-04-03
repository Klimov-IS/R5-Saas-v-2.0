/**
 * Cabinet Helpers — SQL queries for the "Кабинет" tab
 * Sprint 003, Phase 1 (MVP) — all queries on existing tables, zero migrations
 */

import { query } from './client';

// ── Types ──

export interface CabinetData {
  store: CabinetStore;
  metrics: CabinetMetrics;
  ratingBreakdown: Record<number, number>;
  complaints: CabinetComplaints;
  rules: CabinetRules;
  ai: CabinetAI;
  telegram: CabinetTelegram;
}

export interface CabinetStore {
  id: string;
  name: string;
  marketplace: string;
  status: string;
  created_at: string;
  syncs: {
    products: { status: string | null; date: string | null; };
    reviews: { status: string | null; date: string | null; };
    chats: { status: string | null; date: string | null; };
  };
}

export interface CabinetMetrics {
  products: { total: number; active: number; };
  reviews: { total: number; negative: number; };
  chats: { total: number; active: number; tagCounts: Record<string, number>; };
  deletions: { total: number; };
}

export interface CabinetComplaints {
  filed: number;
  approved: number;
  rejected: number;
  pending: number;
  draft: number;
  approvalRate: number;
}

export interface CabinetRules {
  complaintRatings: number[];
  chatRatings: number[];
  chatStrategy: string | null;
  compensation: {
    enabled: boolean;
    type: string | null;
    maxAmount: string | null;
  };
  autoSequences: { active: number; total: number; };
}

export interface CabinetAI {
  hasInstructions: boolean;
  instructionsLength: number;
  instructionsPreview: string;
  faqCount: number;
  guidesCount: number;
}

export interface CabinetTelegram {
  connected: boolean;
  notificationsEnabled: boolean;
  lastNotification: string | null;
  queueCount: number;
}

// ── Helper ──

const toNum = (v: any): number => parseInt(v, 10) || 0;

// ── Main function ──

export async function getCabinetData(storeId: string): Promise<CabinetData | null> {
  // Query 1: Store info (fast — primary key lookup)
  const storeResult = await query(
    `SELECT id, name, marketplace, status, created_at,
            ai_instructions, total_reviews, total_chats, chat_tag_counts,
            last_product_update_status, last_product_update_date,
            last_review_update_status, last_review_update_date,
            last_chat_update_status, last_chat_update_date,
            owner_id, COALESCE(review_count_5star, 0) as review_count_5star
     FROM stores WHERE id = $1`,
    [storeId]
  );

  if (storeResult.rows.length === 0) return null;
  const s = storeResult.rows[0];

  // Run remaining queries in parallel
  const [
    productResult,
    ratingResult,
    complaintResult,
    deletionResult,
    rulesResult,
    sequenceResult,
    faqResult,
    guidesResult,
    telegramResult,
    queueResult,
  ] = await Promise.all([
    // Query 2: Product counts
    query(
      `SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE pr.work_in_chats = TRUE OR pr.submit_complaints = TRUE) AS active
       FROM products p
       LEFT JOIN product_rules pr ON pr.product_id = p.id
       WHERE p.store_id = $1`,
      [storeId]
    ),

    // Query 3: Rating breakdown (Sprint-016: reviews table + stores.review_count_5star)
    query(
      `SELECT rating, COUNT(*) AS count
       FROM reviews
       WHERE store_id = $1
       GROUP BY rating
       ORDER BY rating DESC`,
      [storeId]
    ),

    // Query 4: Complaint stats
    query(
      `SELECT
        COUNT(*) FILTER (WHERE rc.status IN ('sent','approved','rejected','pending','reconsidered')) AS filed,
        COUNT(*) FILTER (WHERE rc.status = 'approved') AS approved,
        COUNT(*) FILTER (WHERE rc.status = 'rejected') AS rejected,
        COUNT(*) FILTER (WHERE rc.status IN ('pending','reconsidered')) AS pending,
        COUNT(*) FILTER (WHERE rc.status = 'draft') AS draft
       FROM review_complaints rc
       WHERE rc.store_id = $1`,
      [storeId]
    ),

    // Query 5: Deleted reviews count
    query(
      `SELECT COUNT(*) AS deleted_count
       FROM reviews
       WHERE store_id = $1 AND deleted_from_wb_at IS NOT NULL`,
      [storeId]
    ),

    // Query 6: Product rules aggregation
    query(
      `SELECT
        COUNT(*) FILTER (WHERE pr.complaint_rating_1) AS cr1,
        COUNT(*) FILTER (WHERE pr.complaint_rating_2) AS cr2,
        COUNT(*) FILTER (WHERE pr.complaint_rating_3) AS cr3,
        COUNT(*) FILTER (WHERE pr.complaint_rating_4) AS cr4,
        COUNT(*) FILTER (WHERE pr.chat_rating_1) AS chr1,
        COUNT(*) FILTER (WHERE pr.chat_rating_2) AS chr2,
        COUNT(*) FILTER (WHERE pr.chat_rating_3) AS chr3,
        COUNT(*) FILTER (WHERE pr.chat_rating_4) AS chr4,
        MODE() WITHIN GROUP (ORDER BY pr.chat_strategy) AS main_strategy,
        COUNT(*) FILTER (WHERE pr.offer_compensation) AS with_compensation,
        MAX(pr.max_compensation) AS max_compensation,
        MODE() WITHIN GROUP (ORDER BY pr.compensation_type) AS main_comp_type
       FROM product_rules pr
       JOIN products p ON p.id = pr.product_id
       WHERE p.store_id = $1 AND (pr.work_in_chats OR pr.submit_complaints)`,
      [storeId]
    ),

    // Query 7: Auto-sequences
    query(
      `SELECT
        COUNT(*) FILTER (WHERE cas.status = 'active') AS active,
        COUNT(*) AS total
       FROM chat_auto_sequences cas
       WHERE cas.store_id = $1`,
      [storeId]
    ),

    // Query 8a: FAQ count
    query(
      `SELECT COUNT(*) FILTER (WHERE is_active) AS active_count, COUNT(*) AS total_count
       FROM store_faq WHERE store_id = $1`,
      [storeId]
    ),

    // Query 8b: Guides count
    query(
      `SELECT COUNT(*) FILTER (WHERE is_active) AS active_count, COUNT(*) AS total_count
       FROM store_guides WHERE store_id = $1`,
      [storeId]
    ),

    // Query 9: Telegram
    query(
      `SELECT
        tu.is_notifications_enabled,
        tu.telegram_username,
        (SELECT MAX(tnl.sent_at) FROM telegram_notifications_log tnl
         WHERE tnl.store_id = $1) AS last_notification
       FROM telegram_users tu
       JOIN users u ON tu.user_id = u.id
       JOIN stores st ON st.owner_id = u.id
       WHERE st.id = $1
       LIMIT 1`,
      [storeId]
    ),

    // Query 10: TG queue count (review-linked, non-closed)
    query(
      `SELECT COUNT(DISTINCT rcl.chat_id) AS queue_count
       FROM review_chat_links rcl
       JOIN chats c ON rcl.chat_id = c.id AND rcl.store_id = c.store_id
       WHERE rcl.store_id = $1 AND c.status != 'closed'`,
      [storeId]
    ),
  ]);

  // ── Assemble response ──

  // Store
  const store: CabinetStore = {
    id: s.id,
    name: s.name,
    marketplace: s.marketplace,
    status: s.status,
    created_at: s.created_at,
    syncs: {
      products: { status: s.last_product_update_status, date: s.last_product_update_date },
      reviews: { status: s.last_review_update_status, date: s.last_review_update_date },
      chats: { status: s.last_chat_update_status, date: s.last_chat_update_date },
    },
  };

  // Metrics
  const pr = productResult.rows[0];
  const tagCounts = s.chat_tag_counts || {};
  const activeChatTags = ['deletion_candidate', 'deletion_offered', 'deletion_agreed'];
  const activeChats = activeChatTags.reduce((sum, tag) => sum + (toNum(tagCounts[tag]) || 0), 0);

  const metrics: CabinetMetrics = {
    products: { total: toNum(pr.total), active: toNum(pr.active) },
    reviews: {
      total: toNum(s.total_reviews),
      negative: ratingResult.rows
        .filter((r: any) => r.rating <= 3)
        .reduce((sum: number, r: any) => sum + toNum(r.count), 0),
    },
    chats: {
      total: toNum(s.total_chats),
      active: activeChats,
      tagCounts,
    },
    deletions: { total: toNum(deletionResult.rows[0]?.deleted_count) },
  };

  // Rating breakdown (1-4★ from reviews table, 5★ from stores.review_count_5star)
  const ratingBreakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const row of ratingResult.rows) {
    ratingBreakdown[row.rating] = toNum(row.count);
  }
  ratingBreakdown[5] = toNum(s.review_count_5star);

  // Complaints
  const cr = complaintResult.rows[0];
  const filed = toNum(cr.filed);
  const approved = toNum(cr.approved);
  const rejected = toNum(cr.rejected);
  const decided = approved + rejected;

  const complaints: CabinetComplaints = {
    filed,
    approved,
    rejected,
    pending: toNum(cr.pending),
    draft: toNum(cr.draft),
    approvalRate: decided > 0 ? Math.round((approved / decided) * 100) : 0,
  };

  // Rules
  const rr = rulesResult.rows[0];
  const complaintRatings: number[] = [];
  if (toNum(rr?.cr1) > 0) complaintRatings.push(1);
  if (toNum(rr?.cr2) > 0) complaintRatings.push(2);
  if (toNum(rr?.cr3) > 0) complaintRatings.push(3);
  if (toNum(rr?.cr4) > 0) complaintRatings.push(4);

  const chatRatings: number[] = [];
  if (toNum(rr?.chr1) > 0) chatRatings.push(1);
  if (toNum(rr?.chr2) > 0) chatRatings.push(2);
  if (toNum(rr?.chr3) > 0) chatRatings.push(3);
  if (toNum(rr?.chr4) > 0) chatRatings.push(4);

  const sr = sequenceResult.rows[0];

  const rules: CabinetRules = {
    complaintRatings,
    chatRatings,
    chatStrategy: rr?.main_strategy || null,
    compensation: {
      enabled: toNum(rr?.with_compensation) > 0,
      type: rr?.main_comp_type || null,
      maxAmount: rr?.max_compensation || null,
    },
    autoSequences: {
      active: toNum(sr?.active),
      total: toNum(sr?.total),
    },
  };

  // AI
  const aiInstructions = s.ai_instructions || '';
  const fq = faqResult.rows[0];
  const gd = guidesResult.rows[0];

  const ai: CabinetAI = {
    hasInstructions: aiInstructions.length > 0,
    instructionsLength: aiInstructions.length,
    instructionsPreview: aiInstructions.length > 100
      ? aiInstructions.substring(0, 100) + '...'
      : aiInstructions,
    faqCount: toNum(fq?.active_count),
    guidesCount: toNum(gd?.active_count),
  };

  // Telegram
  const tg = telegramResult.rows[0];
  const qc = queueResult.rows[0];

  const telegram: CabinetTelegram = {
    connected: !!tg,
    notificationsEnabled: tg?.is_notifications_enabled ?? false,
    lastNotification: tg?.last_notification || null,
    queueCount: toNum(qc?.queue_count),
  };

  return {
    store,
    metrics,
    ratingBreakdown,
    complaints,
    rules,
    ai,
    telegram,
  };
}
