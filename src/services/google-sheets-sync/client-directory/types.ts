/**
 * Types for Client Directory Sync (Список клиентов)
 */

import type { GoogleSheetsConfig } from '../types';

/**
 * Configuration for client directory sync
 */
export interface ClientDirectoryConfig extends GoogleSheetsConfig {
  clientsFolderId: string;  // Google Drive folder with client folders
}

/**
 * Store data from database
 */
export interface StoreData {
  id: string;
  name: string;
  is_active: boolean;
  stage: string | null;
  created_at: Date;
  api_token: string | null;
  content_api_token: string | null;
  feedbacks_api_token: string | null;
  chat_api_token: string | null;
}

/**
 * Computed metrics per store (from batch queries)
 */
export interface StoreMetrics {
  hasChatWork: boolean;
  activeProducts: number;
  negativeReviews: number;
}

/**
 * Drive folder match result
 */
export interface DriveFolderMatch {
  folderId: string | null;
  folderLink: string | null;
  reportId: string | null;
  reportLink: string | null;
  screenshotsId: string | null;
  screenshotsLink: string | null;
}

/**
 * Sync result
 */
export interface ClientDirectorySyncResult {
  success: boolean;
  storesProcessed: number;
  rowsUpdated: number;
  rowsAppended: number;
  duration_ms: number;
  error?: string;
}

/**
 * Column indices in the sheet (0-based)
 * Total: 17 columns (A-Q)
 */
export const COLUMN_INDICES = {
  STORE_ID: 0,        // A
  NAME: 1,            // B
  INN: 2,             // C  (manual)
  CONTACT: 3,         // D  (manual)
  COST_CD: 4,         // E  (manual)
  CONNECTED_AT: 5,    // F
  API: 6,             // G  (✅ if any token exists)
  FOLDER_LINK: 7,     // H
  REPORT_LINK: 8,     // I
  SCREENSHOTS: 9,     // J
  UPDATED_AT: 10,     // K
  STATUS: 11,         // L
  STAGE: 12,          // M  (auto from DB)
  CHAT_WORK: 13,      // N  (auto — computed)
  PRODUCTS: 14,       // O  (auto — computed)
  REVIEWS: 15,        // P  (auto — computed)
  TASK: 16            // Q  (manual)
} as const;

/**
 * Headers for the client directory sheet
 */
export const CLIENT_DIRECTORY_HEADERS = [
  'ID магазина',
  'Название',
  'ИНН',
  'Контакт',
  'Стоимость ЦД',
  'Дата подключения',
  'API',
  'Папка клиента',
  'Отчёт',
  'Скриншоты',
  'Обновлено',
  'Статус',
  'Этап',
  'Работа в чатах',
  'Артикулы',
  'Отзывы 1-3★',
  'Задача'
];
