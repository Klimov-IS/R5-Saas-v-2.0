/**
 * Types for Complaint Backfill System
 *
 * Система автоматической догенерации жалоб при активации товара
 *
 * @module types/backfill
 */

// ============================================================================
// Enums & Constants
// ============================================================================

/**
 * Статус backfill задачи
 */
export type BackfillJobStatus =
  | 'pending'      // Ожидает обработки
  | 'in_progress'  // Выполняется
  | 'completed'    // Завершено успешно
  | 'paused'       // Приостановлено (дневной лимит)
  | 'failed';      // Ошибка (после max_retries)

/**
 * Причина создания backfill задачи
 */
export type BackfillTrigger =
  | 'product_activation'  // Товар активирован (is_active: false → true)
  | 'store_activation'    // Магазин активирован
  | 'rules_change'        // Изменены правила жалоб
  | 'manual';             // Ручной запуск

/**
 * Дневной лимит генерации жалоб
 */
export const DAILY_COMPLAINT_LIMIT = 2000;

/**
 * Размер batch для обработки
 */
export const BACKFILL_BATCH_SIZE = 100;

/**
 * Интервал между batch'ами (мс)
 */
export const BACKFILL_BATCH_DELAY = 2000;

// ============================================================================
// Types
// ============================================================================

/**
 * Backfill Job - задача на массовую генерацию жалоб
 */
export interface BackfillJob {
  id: string;

  // References
  product_id: string;
  store_id: string;
  owner_id: string;

  // Status
  status: BackfillJobStatus;
  priority: number;

  // Progress
  total_reviews: number;
  processed: number;
  failed: number;
  skipped: number;

  // Timing
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  last_processed_at: string | null;

  // Daily limit
  daily_generated: number;
  daily_limit_date: string | null;

  // Error handling
  last_error: string | null;
  retry_count: number;
  max_retries: number;

  // Metadata
  triggered_by: BackfillTrigger | null;
  metadata: Record<string, unknown>;
}

/**
 * Input для создания backfill job
 */
export interface CreateBackfillJobInput {
  product_id: string;
  store_id: string;
  owner_id: string;
  triggered_by: BackfillTrigger;
  priority?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Daily Limit - дневной лимит генерации
 */
export interface DailyLimit {
  store_id: string;
  date: string;
  generated: number;
  limit_value: number;
  created_at: string;
  updated_at: string;
}

/**
 * Статус backfill с расчётными полями (view)
 */
export interface BackfillJobStatusView {
  id: string;
  product_id: string;
  store_id: string;
  status: BackfillJobStatus;
  priority: number;

  // Progress
  total_reviews: number;
  processed: number;
  failed: number;
  skipped: number;
  remaining: number;
  progress_percent: number;

  // Timing
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  last_processed_at: string | null;

  // Daily limit
  daily_generated: number;
  store_daily_generated: number;
  store_daily_remaining: number;

  // Metadata
  triggered_by: BackfillTrigger | null;
  last_error: string | null;
  retry_count: number;
}

/**
 * Результат обработки batch
 */
export interface BackfillBatchResult {
  job_id: string;
  batch_size: number;
  generated: number;
  failed: number;
  skipped: number;
  duration_ms: number;
  remaining_today: number;
  is_completed: boolean;
  is_paused: boolean;
  error?: string;
}

/**
 * Общая статистика backfill
 */
export interface BackfillStats {
  total_jobs: number;
  pending: number;
  in_progress: number;
  completed: number;
  paused: number;
  failed: number;

  total_reviews_queued: number;
  total_processed: number;
  total_failed: number;

  stores_with_active_jobs: number;
}

// ============================================================================
// UI Labels
// ============================================================================

export const BACKFILL_STATUS_LABELS: Record<BackfillJobStatus, string> = {
  pending: 'Ожидает',
  in_progress: 'Выполняется',
  completed: 'Завершено',
  paused: 'Приостановлено',
  failed: 'Ошибка',
};

export const BACKFILL_TRIGGER_LABELS: Record<BackfillTrigger, string> = {
  product_activation: 'Активация товара',
  store_activation: 'Активация магазина',
  rules_change: 'Изменение правил',
  manual: 'Ручной запуск',
};

// ============================================================================
// Helper functions
// ============================================================================

/**
 * Проверяет, можно ли обрабатывать задачу
 */
export function canProcessJob(job: BackfillJob): boolean {
  return job.status === 'pending' || job.status === 'in_progress';
}

/**
 * Проверяет, завершена ли задача
 */
export function isJobCompleted(job: BackfillJob): boolean {
  return job.status === 'completed' || job.status === 'failed';
}

/**
 * Рассчитывает оставшееся количество отзывов
 */
export function getRemainingReviews(job: BackfillJob): number {
  return Math.max(0, job.total_reviews - job.processed - job.skipped);
}

/**
 * Рассчитывает прогресс в процентах
 */
export function getProgressPercent(job: BackfillJob): number {
  if (job.total_reviews === 0) return 0;
  return Math.round((job.processed / job.total_reviews) * 100);
}

/**
 * Оценивает время завершения (при текущей скорости)
 */
export function estimateCompletion(
  remaining: number,
  dailyLimit: number = DAILY_COMPLAINT_LIMIT
): { days: number; hours: number } {
  const days = Math.ceil(remaining / dailyLimit);
  const lastDayReviews = remaining % dailyLimit || dailyLimit;
  // Примерно 1 секунда на жалобу
  const hours = Math.ceil(lastDayReviews / 3600);

  return { days, hours };
}
