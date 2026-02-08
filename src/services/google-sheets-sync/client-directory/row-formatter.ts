/**
 * Row formatting for Client Directory sheet
 */

import type { StoreData, DriveFolderMatch, ClientRow } from './types';
import { CLIENT_DIRECTORY_HEADERS } from './types';

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
 * Format store status for display
 */
function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'active': 'Активен',
    'inactive': 'Неактивен',
    'pending': 'Ожидание',
    'suspended': 'Приостановлен'
  };
  return statusMap[status] || status;
}

/**
 * Format store data into a row for the sheet
 */
export function formatClientRow(
  store: StoreData,
  driveMatch: DriveFolderMatch,
  existingInn: string = ''
): string[] {
  return [
    store.id,
    store.name,
    existingInn, // Preserve existing INN (filled manually)
    formatDate(store.created_at),
    formatStatus(store.status),
    formatApiStatus(store.api_token),
    formatApiStatus(store.content_api_token),
    formatApiStatus(store.feedbacks_api_token),
    formatApiStatus(store.chat_api_token),
    driveMatch.folderLink || '',
    driveMatch.reportLink || '',
    driveMatch.screenshotsLink || '',
    formatDateTime(new Date())
  ];
}

/**
 * Get headers for the client directory sheet
 */
export function getClientDirectoryHeaders(): string[] {
  return [...CLIENT_DIRECTORY_HEADERS];
}

/**
 * Parse existing row to extract INN (column C, index 2)
 */
export function extractInnFromRow(row: string[]): string {
  return row[2] || '';
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
 * @param startCol - 0-based start column
 * @param endCol - 0-based end column
 */
export function buildRowRange(
  sheetName: string,
  rowNumber: number,
  startCol: number = 0,
  endCol: number = 12 // M column
): string {
  const startLetter = columnToLetter(startCol);
  const endLetter = columnToLetter(endCol);
  return `'${sheetName}'!${startLetter}${rowNumber}:${endLetter}${rowNumber}`;
}
