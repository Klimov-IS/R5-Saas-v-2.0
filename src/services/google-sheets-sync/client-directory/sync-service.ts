/**
 * Client Directory Sync Service
 *
 * Syncs store data to "Список клиентов" sheet with incremental upsert:
 * - Updates existing rows (matched by store ID)
 * - Appends new rows for new stores
 * - Preserves manually entered data (INN)
 * - Links to Google Drive folders via fuzzy name matching
 */

import { query } from '@/db/client';
import {
  readSheetData,
  batchUpdateRows,
  appendRows,
  listFilesInFolder,
  clearAndWriteRows,
  type DriveFile
} from '../sheets-client';
import { getGoogleSheetsConfig } from '../sync-service';
import type { GoogleSheetsConfig } from '../types';
import type {
  StoreData,
  ClientDirectorySyncResult,
  DriveFolderMatch
} from './types';
import { CLIENT_DIRECTORY_HEADERS, COLUMN_INDICES } from './types';
import {
  findMatchingFolder,
  buildFolderMatch
} from './drive-matcher';
import {
  formatClientRow,
  extractInnFromRow,
  buildRowRange,
  getClientDirectoryHeaders
} from './row-formatter';

// Sheet name for client directory
const CLIENT_DIRECTORY_SHEET = 'Список клиентов';

// Google Drive folder with client folders
const CLIENTS_FOLDER_ID = '1GelGC6stQVoc5OaJuachXNZtuJvOevyK';

/**
 * Get all stores from database
 */
async function getAllStores(): Promise<StoreData[]> {
  const result = await query<StoreData>(
    `SELECT
      id, name, status, created_at,
      api_token, content_api_token, feedbacks_api_token, chat_api_token
    FROM stores
    ORDER BY name`
  );
  return result.rows;
}

/**
 * Build store ID to row number map from existing sheet data
 */
function buildStoreRowMap(sheetData: string[][]): Map<string, number> {
  const map = new Map<string, number>();

  // Skip header row (index 0), rows are 1-indexed in sheets
  for (let i = 1; i < sheetData.length; i++) {
    const row = sheetData[i];
    const storeId = row[COLUMN_INDICES.STORE_ID];
    if (storeId) {
      // Row number is i + 1 because sheets are 1-indexed
      map.set(storeId, i + 1);
    }
  }

  return map;
}

/**
 * Get folder contents with caching for the session
 */
async function getFolderContentsWithCache(
  config: GoogleSheetsConfig,
  folderId: string,
  cache: Map<string, DriveFile[]>
): Promise<DriveFile[]> {
  if (cache.has(folderId)) {
    return cache.get(folderId)!;
  }

  try {
    const files = await listFilesInFolder(config, folderId);
    cache.set(folderId, files);
    return files;
  } catch (error) {
    console.error(`[ClientDirectorySync] Failed to list folder ${folderId}:`, error);
    cache.set(folderId, []);
    return [];
  }
}

/**
 * Match store to Drive folder and get links
 */
async function matchStoreToDrive(
  store: StoreData,
  clientFolders: DriveFile[],
  config: GoogleSheetsConfig,
  folderContentsCache: Map<string, DriveFile[]>
): Promise<DriveFolderMatch> {
  // Find matching folder
  const matchedFolder = findMatchingFolder(store.name, clientFolders);

  if (!matchedFolder) {
    return {
      folderId: null,
      folderLink: null,
      reportId: null,
      reportLink: null,
      screenshotsId: null,
      screenshotsLink: null
    };
  }

  // Get folder contents to find report and screenshots
  const contents = await getFolderContentsWithCache(
    config,
    matchedFolder.id,
    folderContentsCache
  );

  return buildFolderMatch(matchedFolder, contents);
}

/**
 * Sync client directory to Google Sheets (upsert strategy)
 */
export async function syncClientDirectory(): Promise<ClientDirectorySyncResult> {
  const startTime = Date.now();

  console.log('[ClientDirectorySync] Starting incremental sync...');

  try {
    // 1. Get config
    const config = getGoogleSheetsConfig();
    const sheetConfig: GoogleSheetsConfig = {
      ...config,
      sheetName: CLIENT_DIRECTORY_SHEET
    };

    console.log(`[ClientDirectorySync] Target: ${config.spreadsheetId} / "${CLIENT_DIRECTORY_SHEET}"`);

    // 2. Read existing sheet data
    let existingData: string[][] = [];
    try {
      existingData = await readSheetData(
        config,
        config.spreadsheetId,
        `'${CLIENT_DIRECTORY_SHEET}'!A:M`
      );
      console.log(`[ClientDirectorySync] Found ${existingData.length} existing rows`);
    } catch (error) {
      console.log('[ClientDirectorySync] Sheet empty or not found, will create with headers');
    }

    // 3. Build store ID → row number map
    const storeRowMap = buildStoreRowMap(existingData);
    console.log(`[ClientDirectorySync] Mapped ${storeRowMap.size} existing stores`);

    // 4. Get all stores from DB
    const stores = await getAllStores();
    console.log(`[ClientDirectorySync] Found ${stores.length} stores in database`);

    if (stores.length === 0) {
      console.log('[ClientDirectorySync] No stores found');
      return {
        success: true,
        storesProcessed: 0,
        rowsUpdated: 0,
        rowsAppended: 0,
        duration_ms: Date.now() - startTime
      };
    }

    // 5. Get client folders from Google Drive
    let clientFolders: DriveFile[] = [];
    try {
      clientFolders = await listFilesInFolder(config, CLIENTS_FOLDER_ID);
      console.log(`[ClientDirectorySync] Found ${clientFolders.length} client folders in Drive`);
    } catch (error) {
      console.warn('[ClientDirectorySync] Failed to list client folders:', error);
    }

    // 6. Process each store
    const updates: Array<{ range: string; values: string[][] }> = [];
    const newRows: string[][] = [];
    const folderContentsCache = new Map<string, DriveFile[]>();

    for (const store of stores) {
      // Match to Drive folder
      const driveMatch = await matchStoreToDrive(
        store,
        clientFolders,
        config,
        folderContentsCache
      );

      const existingRowNum = storeRowMap.get(store.id);

      if (existingRowNum) {
        // UPDATE: Store exists in sheet
        const existingRow = existingData[existingRowNum - 1] || [];
        const existingInn = extractInnFromRow(existingRow);

        const newRow = formatClientRow(store, driveMatch, existingInn);
        const range = buildRowRange(CLIENT_DIRECTORY_SHEET, existingRowNum);

        updates.push({
          range,
          values: [newRow]
        });
      } else {
        // APPEND: New store
        const newRow = formatClientRow(store, driveMatch);
        newRows.push(newRow);
      }
    }

    console.log(`[ClientDirectorySync] Updates: ${updates.length}, Appends: ${newRows.length}`);

    // 7. Write headers if sheet was empty
    if (existingData.length === 0) {
      console.log('[ClientDirectorySync] Writing headers...');
      await clearAndWriteRows(sheetConfig, getClientDirectoryHeaders(), []);
    }

    // 8. Batch update existing rows
    let updatedCells = 0;
    if (updates.length > 0) {
      const result = await batchUpdateRows(sheetConfig, updates);
      updatedCells = result.updatedCells;
      console.log(`[ClientDirectorySync] Updated ${updatedCells} cells`);
    }

    // 9. Append new rows
    let appendedRows = 0;
    if (newRows.length > 0) {
      const result = await appendRows(sheetConfig, newRows);
      appendedRows = result.appendedRows;
      console.log(`[ClientDirectorySync] Appended ${appendedRows} rows`);
    }

    const duration = Date.now() - startTime;
    console.log(`[ClientDirectorySync] ✅ Sync completed in ${duration}ms`);

    return {
      success: true,
      storesProcessed: stores.length,
      rowsUpdated: updates.length,
      rowsAppended: newRows.length,
      duration_ms: duration
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`[ClientDirectorySync] ❌ Sync failed after ${duration}ms:`, errorMessage);

    return {
      success: false,
      storesProcessed: 0,
      rowsUpdated: 0,
      rowsAppended: 0,
      duration_ms: duration,
      error: errorMessage
    };
  }
}

/**
 * Trigger async sync (non-blocking)
 */
export function triggerAsyncClientDirectorySync(): void {
  syncClientDirectory()
    .then(result => {
      if (result.success) {
        console.log(`[ClientDirectorySync] Background sync completed: ${result.rowsUpdated} updated, ${result.rowsAppended} appended`);
      } else {
        console.error(`[ClientDirectorySync] Background sync failed: ${result.error}`);
      }
    })
    .catch(error => {
      console.error('[ClientDirectorySync] Background sync error:', error);
    });
}
