/**
 * Row formatting for Client Directory sheet
 */

import type { StoreData, DriveFolderMatch, StoreMetrics } from './types';
import { CLIENT_DIRECTORY_HEADERS, COLUMN_INDICES } from './types';
import { STORE_STAGE_LABELS } from '@/types/stores';
import type { StoreStage } from '@/types/stores';

/**
 * Format date to DD.MM.YYYY
 */
function formatDate(date: Date | string | null): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();

  return `${day}.${month}.${year}`;
}

/**
 * Format datetime to DD.MM.YYYY HH:MM
 */
function formatDateTime(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

/**
 * Format combined API status: ✅ if any token exists, ❌ if none
 */
function formatHasAnyApi(store: StoreData): string {
  return (store.api_token || store.content_api_token || store.feedbacks_api_token || store.chat_api_token)
    ? '✅' : '❌';
}

/**
 * Format store active status for display
 */
function formatStatus(isActive: boolean): string {
  return isActive ? 'Активен' : 'Неактивен';
}

/**
 * Format store stage as Russian label
 */
function formatStage(stage: string | null): string {
  if (!stage) return '';
  return STORE_STAGE_LABELS[stage as StoreStage] || stage;
}

/**
 * Manual fields preserved from existing row data.
 * These columns are filled by managers and must not be overwritten.
 * Note: INN and cost_cd moved to DB (migration 036) — no longer manual.
 */
export interface ManualFields {
  contact: string;  // D — Контакт
  task: string;     // S — Задача
}

/**
 * Extract manual fields from an existing sheet row.
 * Returns empty strings for missing values.
 */
export function extractManualFields(row: string[]): ManualFields {
  return {
    contact: row[COLUMN_INDICES.CONTACT] || '',
    task: row[COLUMN_INDICES.TASK] || ''
  };
}

const EMPTY_METRICS: StoreMetrics = { hasChatWork: false, activeProducts: 0, negativeReviews: 0 };

/**
 * Format store data into a row for the sheet.
 * Column order: A-S (19 columns), matches CLIENT_DIRECTORY_HEADERS.
 */
export function formatClientRow(
  store: StoreData,
  driveMatch: DriveFolderMatch,
  manual: ManualFields = { contact: '', task: '' },
  metrics: StoreMetrics = EMPTY_METRICS
): string[] {
  return [
    store.id,                                    // A: ID магазина
    store.name,                                  // B: Название
    store.inn || '',                             // C: ИНН (from DB)
    manual.contact,                              // D: Контакт (manual)
    store.referral || '',                        // E: Реферал (from DB)
    store.cost_cd || '',                         // F: Стоимость ЦД (from DB)
    formatDate(store.created_at),                // G: Дата подключения
    formatHasAnyApi(store),                      // H: API (✅ if any token)
    driveMatch.folderLink || '',                 // I: Папка клиента
    driveMatch.reportLink || '',                 // J: Отчёт
    driveMatch.screenshotsLink || '',            // K: Скриншоты
    formatDateTime(new Date()),                  // L: Обновлено
    formatStatus(store.is_active),               // M: Статус
    formatDate(store.deactivated_at),            // N: Отключён (auto)
    formatStage(store.stage),                    // O: Этап (auto from DB)
    metrics.hasChatWork ? '✅' : '❌',            // P: Работа в чатах (auto)
    String(metrics.activeProducts),              // Q: Артикулы (auto)
    String(metrics.negativeReviews),             // R: Отзывы 1-3★ (auto)
    manual.task                                  // S: Задача (manual)
  ];
}

/**
 * Get headers for the client directory sheet
 */
export function getClientDirectoryHeaders(): string[] {
  return [...CLIENT_DIRECTORY_HEADERS];
}

/**
 * Convert column index to A1 notation letter
 */
export function columnToLetter(column: number): string {
  let result = '';
  let temp = column;

  while (temp >= 0) {
    result = String.fromCharCode((temp % 26) + 65) + result;
    temp = Math.floor(temp / 26) - 1;
  }

  return result;
}

/**
 * Build A1 notation range for a row
 * @param sheetName - Sheet name
 * @param rowNumber - 1-based row number
 * @param startCol - 0-based start column (default: 0 = A)
 * @param endCol - 0-based end column (default: 18 = S)
 */
export function buildRowRange(
  sheetName: string,
  rowNumber: number,
  startCol: number = 0,
  endCol: number = 18 // S column (19 columns: A-S)
): string {
  const startLetter = columnToLetter(startCol);
  const endLetter = columnToLetter(endCol);
  return `'${sheetName}'!${startLetter}${rowNumber}:${endLetter}${rowNumber}`;
}
