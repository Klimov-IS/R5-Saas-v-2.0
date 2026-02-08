/**
 * Google Sheets Sync Service
 *
 * Exports all active product rules from all active stores to Google Sheets.
 *
 * @module services/google-sheets-sync
 */

export {
  syncProductRulesToSheets,
  triggerAsyncSync,
  isGoogleSheetsConfigured,
  getGoogleSheetsConfig
} from './sync-service';

export { TABLE_HEADERS, formatProductRow, formatAllProductRows } from './row-formatter';
export { clearAndWriteRows, clearTokenCache, batchUpdateRows, appendRows, readSheetData } from './sheets-client';
export type { SyncResult, GoogleSheetsConfig, SheetRow } from './types';

// Client Directory sync (Список клиентов)
export {
  syncClientDirectory,
  triggerAsyncClientDirectorySync
} from './client-directory';
export type { ClientDirectorySyncResult } from './client-directory';
