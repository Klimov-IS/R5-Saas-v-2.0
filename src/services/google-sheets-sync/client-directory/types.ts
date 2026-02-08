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
  status: string;
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
  status: string;
  apiMain: string;
  apiContent: string;
  apiFeedbacks: string;
  apiChat: string;
  folderLink: string;
  reportLink: string;
  screenshotsLink: string;
  updatedAt: string;
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
  INN: 2,           // C
  CONNECTED_AT: 3,  // D
  STATUS: 4,        // E
  API_MAIN: 5,      // F
  API_CONTENT: 6,   // G
  API_FEEDBACKS: 7, // H
  API_CHAT: 8,      // I
  FOLDER_LINK: 9,   // J
  REPORT_LINK: 10,  // K
  SCREENSHOTS: 11,  // L
  UPDATED_AT: 12    // M
} as const;

/**
 * Headers for the client directory sheet
 */
export const CLIENT_DIRECTORY_HEADERS = [
  'ID магазина',
  'Название',
  'ИНН',
  'Дата подключения',
  'Статус',
  'API Main',
  'API Content',
  'API Feedbacks',
  'API Chat',
  'Папка клиента',
  'Отчёт',
  'Скриншоты',
  'Обновлено'
];
