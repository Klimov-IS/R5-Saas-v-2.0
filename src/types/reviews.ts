/**
 * Review status types matching database ENUMs
 */

// Review visibility status on Wildberries
export type ReviewStatusWB =
  | 'visible'       // Виден
  | 'unpublished'   // Снят с публикации
  | 'excluded'      // Исключён из рейтинга
  | 'unknown';      // Неизвестно

// Product purchase status from review
export type ProductStatusByReview =
  | 'purchased'      // Выкуп
  | 'refused'        // Отказ
  | 'not_specified'  // Не указано
  | 'unknown';       // Неизвестно

// Chat availability status
export type ChatStatusByReview =
  | 'unavailable'  // Недоступен
  | 'available'    // Доступен
  | 'unknown';     // Неизвестно

// Complaint processing status
export type ComplaintStatus =
  | 'not_sent'  // Не отправлена
  | 'draft'     // Черновик (сгенерирован, но не отправлен)
  | 'sent'      // Отправлена (вручную отмечено)
  | 'approved'  // Одобрена (от WB)
  | 'rejected'  // Отклонена (от WB)
  | 'pending';  // На рассмотрении

/**
 * Product type (enriched from products API)
 */
export type Product = {
  id: string;
  nm_id: number;
  name: string;
  vendor_code: string;
  photo_links?: string[];
};

/**
 * Extended Review type with new status fields
 */
export type Review = {
  id: string;
  product_id: string;
  store_id: string;
  rating: number;
  text: string;
  pros: string | null;
  cons: string | null;
  author: string;
  date: string;
  answer: { text: string; state: string } | null;
  draft_reply: string | null;
  complaint_text: string | null;
  complaint_sent_date: string | null;

  // New status fields
  review_status_wb: ReviewStatusWB;
  product_status_by_review: ProductStatusByReview;
  chat_status_by_review: ChatStatusByReview;
  complaint_status: ComplaintStatus;
  complaint_generated_at: string | null;
  complaint_reason_id: number | null;
  complaint_category: string | null;
  purchase_date: string | null;
  parsed_at: string | null;
  page_number: number | null;

  // Denormalized flags
  has_answer: boolean;
  has_complaint: boolean;
  has_complaint_draft: boolean;
  is_product_active: boolean;

  // Enriched product data (added by frontend)
  product?: Product | null;
};

/**
 * Status label mappings for UI
 */
export const REVIEW_STATUS_LABELS: Record<ReviewStatusWB, string> = {
  visible: '👁️ Виден на WB',
  unpublished: '🚫 Снят с публикации',
  excluded: '⛔ Исключён из рейтинга',
  unknown: '❓ Статус отзыва неизвестен',
};

export const PRODUCT_STATUS_LABELS: Record<ProductStatusByReview, string> = {
  purchased: '✅ Выкуп',
  refused: '⛔ Отказ',
  not_specified: '❓ Статус покупки не указан',
  unknown: '❓ Статус покупки неизвестен',
};

export const CHAT_STATUS_LABELS: Record<ChatStatusByReview, string> = {
  unavailable: '🔒 Недоступен',
  available: '💬 Доступен',
  unknown: '❓ Неизвестно',
};

export const COMPLAINT_STATUS_LABELS: Record<ComplaintStatus, string> = {
  not_sent: '⚪ Не отправлена',
  draft: '📝 Черновик',
  sent: '📤 Отправлена',
  approved: '✅ Одобрена',
  rejected: '❌ Отклонена',
  pending: '⏳ На рассмотрении',
};

/**
 * Status colors for badges
 */
export const REVIEW_STATUS_COLORS: Record<ReviewStatusWB, { bg: string; color: string; border: string }> = {
  visible: { bg: '#d1fae5', color: '#065f46', border: '#10b981' },
  unpublished: { bg: '#fef3c7', color: '#92400e', border: '#f59e0b' },
  excluded: { bg: '#fee2e2', color: '#991b1b', border: '#ef4444' },
  unknown: { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
};

export const PRODUCT_STATUS_COLORS: Record<ProductStatusByReview, { bg: string; color: string; border: string }> = {
  purchased: { bg: '#dbeafe', color: '#1e40af', border: '#3b82f6' },
  refused: { bg: '#fce7f3', color: '#9f1239', border: '#ec4899' },
  not_specified: { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  unknown: { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
};

export const COMPLAINT_STATUS_COLORS: Record<ComplaintStatus, { bg: string; color: string; border: string }> = {
  not_sent: { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  draft: { bg: '#fef3c7', color: '#92400e', border: '#f59e0b' },
  sent: { bg: '#dbeafe', color: '#1e40af', border: '#3b82f6' },
  approved: { bg: '#d1fae5', color: '#065f46', border: '#10b981' },
  rejected: { bg: '#fee2e2', color: '#991b1b', border: '#ef4444' },
  pending: { bg: '#fef3c7', color: '#92400e', border: '#f59e0b' },
};
