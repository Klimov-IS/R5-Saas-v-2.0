/**
 * Review status types matching database ENUMs
 */

// Review visibility status on Wildberries
export type ReviewStatusWB =
  | 'visible'       // Виден
  | 'unpublished'   // Снят с публикации
  | 'excluded'      // Исключён из рейтинга
  | 'deleted'       // Удалён покупателем (обнаружен при full sync)
  | 'unknown';      // Неизвестно

// Product purchase status from review
export type ProductStatusByReview =
  | 'purchased'      // Выкуп
  | 'refused'        // Отказ
  | 'not_specified'  // Не указано
  | 'unknown';       // Неизвестно

// Chat availability status
export type ChatStatusByReview =
  | 'unavailable'  // Недоступен (кнопка disabled)
  | 'available'    // Доступен (серая кнопка — можно открыть)
  | 'opened'       // Открыт (чёрная кнопка — чат уже существует)
  | 'unknown';     // Неизвестно

// Complaint processing status
export type ComplaintStatus =
  | 'not_sent'         // Без черновика (жалоба не сгенерирована)
  | 'draft'            // Черновик (сгенерирован, но не отправлен)
  | 'sent'             // Отправлена (вручную отмечено)
  | 'approved'         // Одобрена (от WB)
  | 'rejected'         // Отклонена (от WB)
  | 'pending'          // На рассмотрении
  | 'reconsidered'     // Пересмотрена (от WB)
  | 'not_applicable';  // Нельзя подать (отзыв удалён/недоступен)

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
  deleted_from_wb_at: string | null;
  rating_excluded: boolean;

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
  visible: 'Отзыв: Виден',
  unpublished: 'Отзыв: Снят с публикации',
  excluded: 'Отзыв: Исключён',
  deleted: 'Отзыв: Удалён',
  unknown: 'Отзыв: Неизвестно',
};

export const PRODUCT_STATUS_LABELS: Record<ProductStatusByReview, string> = {
  purchased: 'Товар: Выкуп',
  refused: 'Товар: Отказ',
  not_specified: 'Товар: Не указан',
  unknown: 'Товар: Неизвестно',
};

export const CHAT_STATUS_LABELS: Record<ChatStatusByReview, string> = {
  unavailable: 'Чат: Недоступен',
  available: 'Чат: Доступен',
  opened: 'Чат: Открыт',
  unknown: 'Чат: Неизвестно',
};

export const CHAT_STATUS_COLORS: Record<ChatStatusByReview, { bg: string; color: string; border: string }> = {
  unavailable: { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  available: { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
  opened: { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  unknown: { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
};

export const COMPLAINT_STATUS_LABELS: Record<ComplaintStatus, string> = {
  not_sent: 'Без черновика',
  draft: 'Черновик',
  sent: 'Отправлена',
  approved: 'Одобрена',
  rejected: 'Отклонена',
  pending: 'На рассмотрении',
  reconsidered: 'Пересмотрена',
  not_applicable: 'Нельзя подать',
};

/**
 * Status colors for badges
 */
export const REVIEW_STATUS_COLORS: Record<ReviewStatusWB, { bg: string; color: string; border: string }> = {
  visible: { bg: '#d1fae5', color: '#065f46', border: '#10b981' },
  unpublished: { bg: '#fef3c7', color: '#92400e', border: '#f59e0b' },
  excluded: { bg: '#fee2e2', color: '#991b1b', border: '#ef4444' },
  deleted: { bg: '#fce4ec', color: '#880e4f', border: '#e91e63' },
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
  draft: { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' },
  sent: { bg: '#f0f9ff', color: '#0369a1', border: '#bae6fd' },
  approved: { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0' },
  rejected: { bg: '#fef2f2', color: '#991b1b', border: '#fecaca' },
  pending: { bg: '#fefce8', color: '#854d0e', border: '#fef08a' },
  reconsidered: { bg: '#faf5ff', color: '#6b21a8', border: '#e9d5ff' },
  not_applicable: { bg: '#f3e5f5', color: '#6a1b9a', border: '#ce93d8' },
};
