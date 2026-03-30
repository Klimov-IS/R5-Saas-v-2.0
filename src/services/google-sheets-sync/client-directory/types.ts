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
  inn: string | null;
  cost_cd: string | null;
  referral: string | null;
  is_active: boolean;
  deactivated_at: Date | null;
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
 * Total: 19 columns (A-S)
 */
export const COLUMN_INDICES = {
  STORE_ID: 0,        // A
  NAME: 1,            // B
  INN: 2,             // C
  CONTACT: 3,         // D  (manual)
  REFERRAL: 4,        // E  (from DB)
  COST_CD: 5,         // F
  CONNECTED_AT: 6,    // G
  API: 7,             // H  (✅ if any token exists)
  FOLDER_LINK: 8,     // I
  REPORT_LINK: 9,     // J
  SCREENSHOTS: 10,    // K
  UPDATED_AT: 11,     // L
  STATUS: 12,         // M
  DEACTIVATED_AT: 13, // N  (auto — date when deactivated)
  STAGE: 14,          // O  (auto from DB)
  CHAT_WORK: 15,      // P  (auto — computed)
  PRODUCTS: 16,       // Q  (auto — computed)
  REVIEWS: 17,        // R  (auto — computed)
  TASK: 18            // S  (manual)
} as const;

/**
 * Headers for the client directory sheet
 */
export const CLIENT_DIRECTORY_HEADERS = [
  'ID магазина',
  'Название',
  'ИНН',
  'Контакт',
  'Реферал',
  'Стоимость ЦД',
  'Дата подключения',
  'API',
  'Папка клиента',
  'Отчёт',
  'Скриншоты',
  'Обновлено',
  'Статус',
  'Отключён',
  'Этап',
  'Работа в чатах',
  'Артикулы',
  'Отзывы 1-3★',
  'Задача'
];
