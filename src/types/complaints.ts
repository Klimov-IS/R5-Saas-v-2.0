/**
 * Review Complaint types for review_complaints table
 *
 * This table stores AI-generated complaints with full analytics and lifecycle tracking.
 * Relationship: 1:1 with reviews (one complaint per review)
 */

/**
 * Complaint status lifecycle
 *
 * ВАЖНО: Статус 'sent' удалён (2026-02-03)
 * При отправке жалобы сразу ставится 'pending' (на рассмотрении)
 * Это соответствует реальному поведению WB: после нажатия "Отправить"
 * жалоба сразу переходит в статус "Проверяем жалобу"
 */
export type ComplaintStatus =
  | 'draft'           // Черновик (можно редактировать/регенерировать)
  | 'pending'         // На рассмотрении WB ("Проверяем жалобу")
  | 'approved'        // WB одобрил жалобу
  | 'rejected'        // WB отклонил жалобу
  | 'reconsidered'    // WB пересмотрел жалобу
  | 'not_applicable'; // Нельзя подать (отзыв удалён/недоступен)

/**
 * Wildberries complaint reason categories (11-20)
 */
export enum WBComplaintReason {
  NOT_ABOUT_PRODUCT = 11,        // Отзыв не относится к товару
  COMPETITOR_REVIEW = 12,        // Отзыв оставили конкуренты
  SPAM_TEXT = 13,                // Спам-реклама в тексте
  SPAM_PHOTO = 14,               // Спам-реклама в фото
  INAPPROPRIATE_CONTENT = 15,    // Нецензурное содержимое
  PROFANITY_THREATS = 16,        // Нецензурная лексика, угрозы, оскорбления
  PHOTO_NOT_ABOUT_PRODUCT = 17,  // Фото не о товаре
  POLITICAL_CONTENT = 18,        // Политический контекст
  MALICIOUS_LINKS = 19,          // Вредоносные ссылки
  OTHER = 20,                    // Другое
}

/**
 * Mapping of WB complaint reason IDs to names (Russian)
 */
export const WB_COMPLAINT_REASON_NAMES: Record<WBComplaintReason, string> = {
  [WBComplaintReason.NOT_ABOUT_PRODUCT]: 'Отзыв не относится к товару',
  [WBComplaintReason.COMPETITOR_REVIEW]: 'Отзыв оставили конкуренты',
  [WBComplaintReason.SPAM_TEXT]: 'Спам-реклама в тексте',
  [WBComplaintReason.SPAM_PHOTO]: 'Спам-реклама в фото',
  [WBComplaintReason.INAPPROPRIATE_CONTENT]: 'Нецензурное содержимое',
  [WBComplaintReason.PROFANITY_THREATS]: 'Нецензурная лексика, угрозы, оскорбления',
  [WBComplaintReason.PHOTO_NOT_ABOUT_PRODUCT]: 'Фото не о товаре',
  [WBComplaintReason.POLITICAL_CONTENT]: 'Политический контекст',
  [WBComplaintReason.MALICIOUS_LINKS]: 'Вредоносные ссылки',
  [WBComplaintReason.OTHER]: 'Другое',
};

/**
 * AI model used for complaint generation
 */
export type AIModel = 'deepseek-chat' | 'openai-gpt-4' | 'openai-gpt-3.5-turbo';

/**
 * Full ReviewComplaint type matching database schema
 */
export interface ReviewComplaint {
  // Primary & Foreign Keys
  id: string;
  review_id: string;  // UNIQUE - 1:1 relationship
  store_id: string;
  owner_id: string;
  product_id: string;

  // Complaint Content
  complaint_text: string;
  reason_id: number;  // WBComplaintReason enum value (11-20)
  reason_name: string;

  // Complaint Status Lifecycle
  status: ComplaintStatus;

  // Draft stage
  generated_at: string;  // ISO timestamp
  regenerated_count: number;
  last_regenerated_at: string | null;  // ISO timestamp

  // Sent stage
  sent_at: string | null;  // ISO timestamp
  sent_by_user_id: string | null;

  // WB moderation result
  moderated_at: string | null;  // ISO timestamp
  wb_response: string | null;

  // AI Generation Metadata (cost tracking)
  ai_model: AIModel;
  ai_prompt_tokens: number | null;
  ai_completion_tokens: number | null;
  ai_total_tokens: number | null;
  ai_cost_usd: number | null;  // DECIMAL(10,6)
  generation_duration_ms: number | null;

  // Review snapshot (historical reference)
  review_rating: number;
  review_text: string;
  review_date: string;  // ISO timestamp

  // Product snapshot (analytics)
  product_name: string | null;
  product_vendor_code: string | null;
  product_is_active: boolean;

  // Timestamps
  created_at: string;  // ISO timestamp
  updated_at: string;  // ISO timestamp
}

/**
 * Partial type for creating a new complaint
 */
export interface CreateReviewComplaintInput {
  review_id: string;
  store_id: string;
  owner_id: string;
  product_id: string;

  // Complaint content from AI
  complaint_text: string;
  reason_id: number;
  reason_name: string;

  // Review snapshot
  review_rating: number;
  review_text: string;
  review_date: string;

  // Product snapshot
  product_name?: string | null;
  product_vendor_code?: string | null;
  product_is_active?: boolean;

  // AI metadata (optional for legacy complaints)
  ai_model?: AIModel;
  ai_prompt_tokens?: number | null;
  ai_completion_tokens?: number | null;
  ai_total_tokens?: number | null;
  ai_cost_usd?: number | null;
  generation_duration_ms?: number | null;
}

/**
 * Partial type for updating a complaint (regenerate/edit)
 */
export interface UpdateReviewComplaintInput {
  complaint_text?: string;
  reason_id?: number;
  reason_name?: string;
  regenerated_count?: number;
  last_regenerated_at?: string;

  // AI metadata for regeneration
  ai_prompt_tokens?: number | null;
  ai_completion_tokens?: number | null;
  ai_total_tokens?: number | null;
  ai_cost_usd?: number | null;
  generation_duration_ms?: number | null;
}

/**
 * Partial type for marking complaint as sent
 */
export interface MarkComplaintAsSentInput {
  sent_by_user_id: string;
}

/**
 * Partial type for WB moderation result
 */
export interface UpdateComplaintModerationInput {
  status: 'approved' | 'rejected' | 'pending';
  moderated_at: string;
  wb_response?: string | null;
}

/**
 * Statistics for complaints (for analytics dashboard)
 */
export interface ComplaintStats {
  total: number;
  draft: number;
  pending: number;
  approved: number;
  rejected: number;
  reconsidered: number;
  not_applicable: number;

  // Cost tracking
  total_tokens: number;
  total_cost_usd: number;
  avg_cost_per_complaint: number;

  // Performance
  avg_generation_duration_ms: number;

  // Effectiveness
  approval_rate: number;  // approved / (approved + rejected)
  rejection_rate: number; // rejected / (approved + rejected)
}

/**
 * UI Labels for complaint status
 */
export const COMPLAINT_STATUS_LABELS: Record<ComplaintStatus, string> = {
  draft: '📝 Черновик',
  pending: '⏳ На рассмотрении',
  approved: '✅ Одобрена WB',
  rejected: '❌ Отклонена WB',
  reconsidered: '🔄 Пересмотрена',
  not_applicable: '🚫 Нельзя подать',
};

/**
 * UI Colors for complaint status badges
 */
export const COMPLAINT_STATUS_COLORS: Record<ComplaintStatus, { bg: string; color: string; border: string }> = {
  draft: { bg: '#fef3c7', color: '#92400e', border: '#f59e0b' },
  pending: { bg: '#dbeafe', color: '#1e40af', border: '#3b82f6' },
  approved: { bg: '#d1fae5', color: '#065f46', border: '#10b981' },
  rejected: { bg: '#fee2e2', color: '#991b1b', border: '#ef4444' },
  reconsidered: { bg: '#e0e7ff', color: '#3730a3', border: '#6366f1' },
  not_applicable: { bg: '#f3e5f5', color: '#6a1b9a', border: '#ce93d8' },
};

/**
 * Helper function to calculate cost
 * Deepseek pricing: $0.14 per 1M input tokens, $0.28 per 1M output tokens
 */
export function calculateComplaintCost(
  promptTokens: number,
  completionTokens: number
): number {
  const INPUT_COST_PER_1M = 0.14;
  const OUTPUT_COST_PER_1M = 0.28;

  const inputCost = (promptTokens / 1_000_000) * INPUT_COST_PER_1M;
  const outputCost = (completionTokens / 1_000_000) * OUTPUT_COST_PER_1M;

  return inputCost + outputCost;
}

/**
 * Helper function to check if complaint is editable
 */
export function isComplaintEditable(status: ComplaintStatus): boolean {
  return status === 'draft';
}

/**
 * Helper function to check if complaint is frozen (immutable)
 */
export function isComplaintFrozen(status: ComplaintStatus): boolean {
  return status !== 'draft';
}
