/**
 * Client Directory Sync Service
 *
 * Syncs store data to "Список клиентов" sheet with stable upsert:
 * - Updates existing rows in place (matched by store ID in column A)
 * - Writes new stores at explicit row numbers (no append API)
 * - Detects and clears duplicate rows
 * - Preserves manually entered data (INN in column C)
 * - Links to Google Drive folders via fuzzy name matching
 *
 * Uses ONLY batchUpdate with explicit A:S ranges — no appendRows,
 * no Google table detection, no column shifting.
 */

import { query } from '@/db/client';
import {
  readSheetData,
  batchUpdateRows,
  listFilesInFolder,
  type DriveFile
} from '../sheets-client';
import { getGoogleCredentialsConfig } from '../sync-service';
import type { GoogleSheetsConfig } from '../types';
import type {
  StoreData,
  StoreMetrics,
  ClientDirectorySyncResult,
  DriveFolderMatch
} from './types';
import { COLUMN_INDICES } from './types';
import {
  findMatchingFolder,
  buildFolderMatch
} from './drive-matcher';
import {
  formatClientRow,
  extractManualFields,
  buildRowRange,
  getClientDirectoryHeaders
} from './row-formatter';

// Sheet name for client directory
const CLIENT_DIRECTORY_SHEET = 'Список клиентов';

// Google Drive folder with client folders
const CLIENTS_FOLDER_ID = '1GelGC6stQVoc5OaJuachXNZtuJvOevyK';

// Number of columns in client directory (A through S)
const COLUMN_COUNT = 19;

/**
 * Get all stores from database
 */
async function getAllStores(): Promise<StoreData[]> {
  const result = await query<StoreData>(
    `SELECT
      id, name, inn, cost_cd, referral, is_active, deactivated_at, stage, created_at,
      api_token, content_api_token, feedbacks_api_token, chat_api_token
    FROM stores
    ORDER BY name`
  );
  return result.rows;
}

/**
 * Batch-fetch computed metrics for all stores.
 * Two queries: product metrics + negative review counts.
 */
async function getStoreMetrics(storeIds: string[]): Promise<Map<string, StoreMetrics>> {
  const metricsMap = new Map<string, StoreMetrics>();
  if (storeIds.length === 0) return metricsMap;

  // Query 1: chat work flag + active product count per store
  const productResult = await query<{
    store_id: string;
    has_chat_work: boolean;
    active_products: string;
  }>(
    `SELECT p.store_id,
       BOOL_OR(pr.work_in_chats) AS has_chat_work,
       COUNT(DISTINCT p.id) AS active_products
     FROM products p
     JOIN product_rules pr ON pr.product_id = p.id
     WHERE p.store_id = ANY($1)
       AND (pr.work_in_chats = TRUE OR pr.submit_complaints = TRUE)
     GROUP BY p.store_id`,
    [storeIds]
  );

  // Query 2: negative reviews (1-3★) for products with active rules
  const reviewResult = await query<{
    store_id: string;
    negative_count: string;
  }>(
    `SELECT r.store_id, COUNT(*) AS negative_count
     FROM reviews r
     JOIN products p ON r.product_id = p.id
     JOIN product_rules pr ON pr.product_id = p.id
     WHERE r.store_id = ANY($1)
       AND r.rating <= 3
       AND (pr.work_in_chats = TRUE OR pr.submit_complaints = TRUE)
     GROUP BY r.store_id`,
    [storeIds]
  );

  // Build lookup maps
  const productMap = new Map(productResult.rows.map(r => [r.store_id, r]));
  const reviewMap = new Map(reviewResult.rows.map(r => [r.store_id, r]));

  for (const storeId of storeIds) {
    const pm = productMap.get(storeId);
    const rm = reviewMap.get(storeId);
    metricsMap.set(storeId, {
      hasChatWork: pm?.has_chat_work ?? false,
      activeProducts: pm ? parseInt(pm.active_products, 10) : 0,
      negativeReviews: rm ? parseInt(rm.negative_count, 10) : 0
    });
  }

  return metricsMap;
}

/**
 * Build store ID → row number map from existing sheet data.
 * Detects duplicates: if a store ID appears in multiple rows,
 * keeps the first occurrence and marks the rest for clearing.
 */
function buildStoreRowMap(sheetData: string[][]): {
  map: Map<string, number>;
  duplicateRows: number[];
} {
  const map = new Map<string, number>();
  const duplicateRows: number[] = [];

  // Skip header row (index 0), rows are 1-indexed in sheets
  for (let i = 1; i < sheetData.length; i++) {
    const row = sheetData[i];
    const storeId = row[COLUMN_INDICES.STORE_ID];
    if (!storeId) continue;

    // Row number is i + 1 because sheets are 1-indexed
    const rowNumber = i + 1;

    if (map.has(storeId)) {
      // Duplicate — mark for clearing
      duplicateRows.push(rowNumber);
    } else {
      map.set(storeId, rowNumber);
    }
  }

  return { map, duplicateRows };
}

/**
 * Find the last row that contains any data.
 * Returns 1 (header row) if sheet is empty or has only headers.
 */
function findLastDataRow(sheetData: string[][]): number {
  let lastRow = 1; // At minimum, row 1 for headers

  for (let i = 1; i < sheetData.length; i++) {
    const row = sheetData[i];
    if (row && row.some(cell => cell)) {
      lastRow = i + 1; // 1-based row number
    }
  }

  return lastRow;
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
 * Sync client directory to Google Sheets.
 *
 * Strategy: explicit batchUpdate only (no appendRows).
 * Every write targets a specific A{row}:R{row} range.
 * This prevents column shifting from Google's table detection.
 */
export async function syncClientDirectory(): Promise<ClientDirectorySyncResult> {
  const startTime = Date.now();

  console.log('[ClientDirectorySync] Starting sync...');

  try {
    // 1. Get config (uses credentials + secondary spreadsheet ID)
    const config = getGoogleCredentialsConfig();
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
        `'${CLIENT_DIRECTORY_SHEET}'!A:S`
      );
      console.log(`[ClientDirectorySync] Found ${existingData.length} existing rows`);
    } catch (error) {
      console.log('[ClientDirectorySync] Sheet empty or not found, will create with headers');
    }

    // 3. Build store ID → row number map with dedup detection
    const { map: storeRowMap, duplicateRows } = buildStoreRowMap(existingData);
    console.log(`[ClientDirectorySync] Mapped ${storeRowMap.size} existing stores`);
    if (duplicateRows.length > 0) {
      console.warn(`[ClientDirectorySync] Found ${duplicateRows.length} duplicate rows: ${duplicateRows.join(', ')}`);
    }

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

    // 5. Batch-fetch metrics for all stores
    const storeIds = stores.map(s => s.id);
    const metricsMap = await getStoreMetrics(storeIds);
    console.log(`[ClientDirectorySync] Fetched metrics for ${metricsMap.size} stores`);

    // 6. Get client folders from Google Drive
    let clientFolders: DriveFile[] = [];
    try {
      clientFolders = await listFilesInFolder(config, CLIENTS_FOLDER_ID);
      console.log(`[ClientDirectorySync] Found ${clientFolders.length} client folders in Drive`);
    } catch (error) {
      console.warn('[ClientDirectorySync] Failed to list client folders:', error);
    }

    // 7. Calculate next available row for new stores
    const lastDataRow = findLastDataRow(existingData);
    let nextRow = lastDataRow + 1;

    // 8. Build all updates in a single array
    const updates: Array<{ range: string; values: string[][] }> = [];
    let updatedCount = 0;
    let appendedCount = 0;
    const folderContentsCache = new Map<string, DriveFile[]>();

    // 8a. Always write headers at row 1
    updates.push({
      range: buildRowRange(CLIENT_DIRECTORY_SHEET, 1),
      values: [getClientDirectoryHeaders()]
    });

    // 8b. Process each store
    for (const store of stores) {
      const driveMatch = await matchStoreToDrive(
        store,
        clientFolders,
        config,
        folderContentsCache
      );

      const metrics = metricsMap.get(store.id) || { hasChatWork: false, activeProducts: 0, negativeReviews: 0 };
      const existingRowNum = storeRowMap.get(store.id);

      if (existingRowNum) {
        // UPDATE: Store exists in sheet — update at its current row
        const existingRow = existingData[existingRowNum - 1] || [];
        const manual = extractManualFields(existingRow);

        updates.push({
          range: buildRowRange(CLIENT_DIRECTORY_SHEET, existingRowNum),
          values: [formatClientRow(store, driveMatch, manual, metrics)]
        });
        updatedCount++;
      } else {
        // NEW: Store not in sheet — write at next available row
        updates.push({
          range: buildRowRange(CLIENT_DIRECTORY_SHEET, nextRow),
          values: [formatClientRow(store, driveMatch, undefined, metrics)]
        });
        nextRow++;
        appendedCount++;
      }
    }

    // 8c. Clear duplicate rows
    const emptyRow = Array(COLUMN_COUNT).fill('');
    for (const rowNum of duplicateRows) {
      updates.push({
        range: buildRowRange(CLIENT_DIRECTORY_SHEET, rowNum),
        values: [emptyRow]
      });
    }

    // 8d. Clear orphan rows — stores deleted from DB but still in sheet
    const dbStoreIds = new Set(stores.map(s => s.id));
    let orphansCleared = 0;
    for (const [sheetStoreId, rowNum] of storeRowMap.entries()) {
      if (!dbStoreIds.has(sheetStoreId)) {
        updates.push({
          range: buildRowRange(CLIENT_DIRECTORY_SHEET, rowNum),
          values: [emptyRow]
        });
        orphansCleared++;
      }
    }

    console.log(`[ClientDirectorySync] Updates: ${updatedCount}, New: ${appendedCount}, Dupes cleared: ${duplicateRows.length}, Orphans cleared: ${orphansCleared}`);

    // 9. Single batchUpdate call for everything
    const result = await batchUpdateRows(sheetConfig, updates);
    console.log(`[ClientDirectorySync] Written ${result.updatedCells} cells via batchUpdate`);

    const duration = Date.now() - startTime;
    console.log(`[ClientDirectorySync] Sync completed in ${duration}ms`);

    return {
      success: true,
      storesProcessed: stores.length,
      rowsUpdated: updatedCount,
      rowsAppended: appendedCount,
      duration_ms: duration
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`[ClientDirectorySync] Sync failed after ${duration}ms:`, errorMessage);

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
        console.log(`[ClientDirectorySync] Background sync completed: ${result.rowsUpdated} updated, ${result.rowsAppended} new`);
      } else {
        console.error(`[ClientDirectorySync] Background sync failed: ${result.error}`);
      }
    })
    .catch(error => {
      console.error('[ClientDirectorySync] Background sync error:', error);
    });
}
