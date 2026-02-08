/**
 * Client Directory Sync Module
 *
 * Exports store data to "Список клиентов" sheet with:
 * - Incremental upsert (update existing, append new)
 * - Google Drive folder matching
 * - INN preservation (manually entered data)
 */

export {
  syncClientDirectory,
  triggerAsyncClientDirectorySync
} from './sync-service';

export type {
  StoreData,
  ClientDirectorySyncResult,
  ClientDirectoryConfig,
  DriveFolderMatch,
  ClientRow
} from './types';

export {
  CLIENT_DIRECTORY_HEADERS,
  COLUMN_INDICES
} from './types';

export {
  normalizeStoreName,
  findMatchingFolder,
  findReportFile,
  findScreenshotsFolder
} from './drive-matcher';

export {
  formatClientRow,
  getClientDirectoryHeaders
} from './row-formatter';
