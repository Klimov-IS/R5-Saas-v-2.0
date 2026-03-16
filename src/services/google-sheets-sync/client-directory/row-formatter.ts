/**
 * Row formatting for Client Directory sheet
 */

import type { StoreData, DriveFolderMatch } from './types';
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
 * Format API token presence as emoji
 */
function formatApiStatus(token: string | null): string {
  return token ? '✅' : '❌';
}

/**
 * Format store active status for display
 */
function formatStatus(isActive: boolean): string {
  return isActive ? 'Активен' : 'Неактивен';
}

/**
 * Manual fields preserved from existing row data.
 * These columns are filled by managers and must not be overwritten.
 */
export interface ManualFields {
  inn: string;     // C — ИНН
  costCd: string;  // D — Стоимость ЦД
  task: string;    // P — Задача
}

/**
 * Extract manual fields from an existing sheet row.
 * Returns empty strings for missing values.
 */
export function extractManualFields(row: string[]): ManualFields {
  return {
    inn: row[COLUMN_INDICES.INN] || '',
    costCd: row[COLUMN_INDICES.COST_CD] || '',
    task: row[COLUMN_INDICES.TASK] || ''
  };
}

/**
 * Format store stage as Russian label
 */
function formatStage(stage: string | null): string {
  if (!stage) return '';
  return STORE_STAGE_LABELS[stage as StoreStage] || stage;
}

/**
 * Format store data into a row for the sheet.
 * Column order: A-O (15 columns), matches CLIENT_DIRECTORY_HEADERS.
 */
export function formatClientRow(
  store: StoreData,
  driveMatch: DriveFolderMatch,
  manual: ManualFields = { inn: '', costCd: '', task: '' }
): string[] {
  return [
    store.id,                                    // A: ID магазина
    store.name,                                  // B: Название
    manual.inn,                                  // C: ИНН (manual)
    manual.costCd,                               // D: Стоимость ЦД (manual)
    formatDate(store.created_at),                // E: Дата подключения
    formatApiStatus(store.api_token),            // F: API Main
    formatApiStatus(store.content_api_token),    // G: API Content
    formatApiStatus(store.feedbacks_api_token),  // H: API Feedbacks
    formatApiStatus(store.chat_api_token),       // I: API Chat
    driveMatch.folderLink || '',                 // J: Папка клиента
    driveMatch.reportLink || '',                 // K: Отчёт
    driveMatch.screenshotsLink || '',            // L: Скриншоты
    formatDateTime(new Date()),                  // M: Обновлено
    formatStatus(store.is_active),               // N: Статус
    formatStage(store.stage),                    // O: Этап (auto from DB)
    manual.task                                  // P: Задача (manual)
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
 * @param endCol - 0-based end column (default: 14 = O)
 */
export function buildRowRange(
  sheetName: string,
  rowNumber: number,
  startCol: number = 0,
  endCol: number = 15 // P column (16 columns: A-P)
): string {
  const startLetter = columnToLetter(startCol);
  const endLetter = columnToLetter(endCol);
  return `'${sheetName}'!${startLetter}${rowNumber}:${endLetter}${rowNumber}`;
}
