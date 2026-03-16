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
 * Client row data for sheet
 */
export interface ClientRow {
  storeId: string;
  name: string;
  inn: string;
  connectedAt: string;
  apiMain: string;
  apiContent: string;
  apiFeedbacks: string;
  apiChat: string;
  folderLink: string;
  reportLink: string;
  screenshotsLink: string;
  updatedAt: string;
  status: string;
  stage: string;
  task: string;
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
 */
export const COLUMN_INDICES = {
  STORE_ID: 0,      // A
  NAME: 1,          // B
  INN: 2,           // C  (manual — preserved)
  CONNECTED_AT: 3,  // D
  API_MAIN: 4,      // E
  API_CONTENT: 5,   // F
  API_FEEDBACKS: 6, // G
  API_CHAT: 7,      // H
  FOLDER_LINK: 8,   // I
  REPORT_LINK: 9,   // J
  SCREENSHOTS: 10,  // K
  UPDATED_AT: 11,   // L
  STATUS: 12,       // M
  STAGE: 13,        // N  (manual — preserved)
  TASK: 14          // O  (manual — preserved)
} as const;

/**
 * Headers for the client directory sheet
 */
export const CLIENT_DIRECTORY_HEADERS = [
  'ID магазина',
  'Название',
  'ИНН',
  'Дата подключения',
  'API Main',
  'API Content',
  'API Feedbacks',
  'API Chat',
  'Папка клиента',
  'Отчёт',
  'Скриншоты',
  'Обновлено',
  'Статус',
  'Этап',
  'Задача'
];
