/**
 * Google Sheets Sync Service
 *
 * Exports all active product rules from all active stores to Google Sheets.
 * Full sync strategy: clear and rewrite on every sync.
 *
 * Triggers:
 * 1. CRON job daily at 6:00 MSK
 * 2. Manual API call (POST /api/admin/google-sheets/sync)
 * 3. After product rule update (async hook)
 * 4. After product status update (async hook)
 * 5. After store status update (async hook)
 */

import { query } from '@/db/client';
import type { Store, Product, ProductRule } from '@/db/helpers';
import { clearAndWriteRows, readSheetData, batchUpdateRows } from './sheets-client';
import { TABLE_HEADERS, formatProductRow } from './row-formatter';
import type { SyncResult, GoogleSheetsConfig } from './types';

// Column index for comments (0-based). System uses cols A-T (0-19), comments are in col U (index 20).
const COMMENTS_COL_INDEX = TABLE_HEADERS.length; // 20 → column U

/**
 * Get primary Google Sheets config from environment variables
 */
export function getGoogleSheetsConfig(): GoogleSheetsConfig {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME || 'Артикулы ТЗ';
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID is not configured');
  }
  if (!serviceAccountEmail) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL is not configured');
  }
  if (!privateKey) {
    throw new Error('GOOGLE_PRIVATE_KEY is not configured');
  }

  return {
    spreadsheetId,
    sheetName,
    serviceAccountEmail,
    privateKey
  };
}

/**
 * Get secondary Google Sheets configs (for employee sheets)
 * Returns array of configs for each sheet in the secondary spreadsheet
 */
export function getSecondaryGoogleSheetsConfigs(): GoogleSheetsConfig[] {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SECONDARY_SPREADSHEET_ID;
  const sheetNames = process.env.GOOGLE_SHEETS_SECONDARY_SHEETS;
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  // Secondary config is optional
  if (!spreadsheetId || !sheetNames || !serviceAccountEmail || !privateKey) {
    return [];
  }

  // Parse comma-separated sheet names
  const sheets = sheetNames.split(',').map(s => s.trim()).filter(Boolean);

  return sheets.map(sheetName => ({
    spreadsheetId,
    sheetName,
    serviceAccountEmail,
    privateKey
  }));
}

/**
 * Get all active stores
 */
async function getActiveStores(): Promise<Store[]> {
  const result = await query<Store>(
    `SELECT * FROM stores WHERE status = 'active' ORDER BY name`
  );
  return result.rows;
}

/**
 * Get active products with rules for a store
 */
async function getActiveProductsWithRules(storeId: string): Promise<Array<Product & { rule: ProductRule | null }>> {
  const result = await query<Product & { rule: string }>(
    `SELECT
      p.id, p.name, p.wb_product_id, p.vendor_code, p.price, p.image_url,
      p.store_id, p.owner_id, p.review_count, p.wb_api_data,
      p.last_review_update_date, p.is_active, p.work_status,
      p.created_at, p.updated_at,
      row_to_json(pr.*) as rule
    FROM products p
    LEFT JOIN product_rules pr ON p.id = pr.product_id
    WHERE p.store_id = $1
      AND p.work_status = 'active'
    ORDER BY p.name`,
    [storeId]
  );

  return result.rows.map(row => ({
    ...row,
    rule: row.rule ? (typeof row.rule === 'string' ? JSON.parse(row.rule) : row.rule) : null
  }));
}

/**
 * Sync all active product rules to Google Sheets
 * Writes to primary spreadsheet and all configured secondary sheets
 */
export async function syncProductRulesToSheets(): Promise<SyncResult> {
  const startTime = Date.now();

  console.log('[GoogleSheetsSync] Starting full sync...');

  try {
    // 1. Get configs
    const primaryConfig = getGoogleSheetsConfig();
    const secondaryConfigs = getSecondaryGoogleSheetsConfigs();

    console.log(`[GoogleSheetsSync] Primary target: ${primaryConfig.spreadsheetId} / "${primaryConfig.sheetName}"`);
    if (secondaryConfigs.length > 0) {
      console.log(`[GoogleSheetsSync] Secondary targets: ${secondaryConfigs.length} sheets`);
    }

    // 2. Get all active stores
    const stores = await getActiveStores();
    console.log(`[GoogleSheetsSync] Found ${stores.length} active stores`);

    if (stores.length === 0) {
      console.log('[GoogleSheetsSync] No active stores found. Writing empty sheets.');
      await clearAndWriteRows(primaryConfig, TABLE_HEADERS, []);

      // Also clear secondary sheets
      for (const config of secondaryConfigs) {
        await clearAndWriteRows(config, TABLE_HEADERS, []);
      }

      return {
        success: true,
        rowsWritten: 1, // Just headers
        storesProcessed: 0,
        productsProcessed: 0,
        duration_ms: Date.now() - startTime
      };
    }

    // 3. Get all active products with rules for each store
    const allRows: string[][] = [];
    let totalProducts = 0;

    for (const store of stores) {
      const products = await getActiveProductsWithRules(store.id);
      console.log(`[GoogleSheetsSync] Store "${store.name}": ${products.length} active products`);

      for (const product of products) {
        allRows.push(formatProductRow(store.name, product, product.rule));
        totalProducts++;
      }
    }

    console.log(`[GoogleSheetsSync] Total rows to write: ${allRows.length}`);

    // 4. Read existing comments (column U) from primary sheet before clearing
    let commentMap = new Map<string, string>(); // "storeName|article" → comment
    try {
      const existingData = await readSheetData(
        primaryConfig,
        primaryConfig.spreadsheetId,
        `'${primaryConfig.sheetName}'!A:U`
      );

      // Build comment map using composite key (store name + article)
      // Skip header row (index 0)
      for (let i = 1; i < existingData.length; i++) {
        const row = existingData[i];
        const comment = row[COMMENTS_COL_INDEX];
        if (comment) {
          const storeName = row[0] || '';
          const article = row[1] || '';
          const key = `${storeName}|${article}`;
          commentMap.set(key, comment);
        }
      }

      if (commentMap.size > 0) {
        console.log(`[GoogleSheetsSync] Preserved ${commentMap.size} comments from column U`);
      }
    } catch (error) {
      console.warn('[GoogleSheetsSync] Could not read existing comments (sheet may be empty):', error instanceof Error ? error.message : error);
    }

    // 5. Write to primary Google Sheets
    const { updatedRows } = await clearAndWriteRows(primaryConfig, TABLE_HEADERS, allRows);

    // 6. Restore comments to primary sheet
    if (commentMap.size > 0) {
      const commentUpdates: Array<{ range: string; values: string[][] }> = [];

      for (let i = 0; i < allRows.length; i++) {
        const row = allRows[i];
        const key = `${row[0]}|${row[1]}`; // storeName|article
        const comment = commentMap.get(key);
        if (comment) {
          // Row i+2 because: +1 for header, +1 for 1-based sheets indexing
          const rowNum = i + 2;
          commentUpdates.push({
            range: `'${primaryConfig.sheetName}'!U${rowNum}`,
            values: [[comment]]
          });
        }
      }

      if (commentUpdates.length > 0) {
        await batchUpdateRows(primaryConfig, commentUpdates);
        console.log(`[GoogleSheetsSync] Restored ${commentUpdates.length} comments`);
      }
    }

    // 7. Write to all secondary sheets (same data, no comments)
    for (const config of secondaryConfigs) {
      console.log(`[GoogleSheetsSync] Syncing to secondary sheet: "${config.sheetName}"...`);
      await clearAndWriteRows(config, TABLE_HEADERS, allRows);
    }

    const duration = Date.now() - startTime;
    const totalSheets = 1 + secondaryConfigs.length;
    console.log(`[GoogleSheetsSync] ✅ Sync completed in ${duration}ms`);
    console.log(`[GoogleSheetsSync] Stats: ${stores.length} stores, ${totalProducts} products, ${updatedRows} rows, ${totalSheets} sheets`);

    return {
      success: true,
      rowsWritten: updatedRows,
      storesProcessed: stores.length,
      productsProcessed: totalProducts,
      duration_ms: duration
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`[GoogleSheetsSync] ❌ Sync failed after ${duration}ms:`, errorMessage);

    return {
      success: false,
      rowsWritten: 0,
      storesProcessed: 0,
      productsProcessed: 0,
      duration_ms: duration,
      error: errorMessage
    };
  }
}

/**
 * Debounce state for triggerAsyncSync.
 * Coalesces rapid-fire calls (e.g., 10 rule changes in 1 minute) into a single sync.
 */
let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let syncRunning = false;
let syncPendingAfterCurrent = false;

const SYNC_DEBOUNCE_MS = 5000; // 5 seconds

/**
 * Trigger async sync (non-blocking, debounced)
 * Use this as a hook after rule/status updates.
 * Multiple calls within 5 seconds are coalesced into a single sync.
 */
export function triggerAsyncSync(): void {
  // If sync is currently running, schedule one more after it finishes
  if (syncRunning) {
    syncPendingAfterCurrent = true;
    console.log('[GoogleSheetsSync] Sync already running, will re-sync after completion');
    return;
  }

  // Clear existing debounce timer and set a new one
  if (syncDebounceTimer) {
    clearTimeout(syncDebounceTimer);
  }

  syncDebounceTimer = setTimeout(() => {
    syncDebounceTimer = null;
    syncRunning = true;

    syncProductRulesToSheets()
      .then(result => {
        if (result.success) {
          console.log(`[GoogleSheetsSync] Background sync completed: ${result.rowsWritten} rows`);
        } else {
          console.error(`[GoogleSheetsSync] Background sync failed: ${result.error}`);
        }
      })
      .catch(error => {
        console.error('[GoogleSheetsSync] Background sync error:', error);
      })
      .finally(() => {
        syncRunning = false;

        // If another change came in while we were syncing, trigger one more
        if (syncPendingAfterCurrent) {
          syncPendingAfterCurrent = false;
          console.log('[GoogleSheetsSync] Running pending re-sync...');
          triggerAsyncSync();
        }
      });
  }, SYNC_DEBOUNCE_MS);

  console.log('[GoogleSheetsSync] Sync scheduled (debounce 5s)');
}

/**
 * Check if Google Sheets sync is configured
 */
export function isGoogleSheetsConfigured(): boolean {
  return !!(
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID &&
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY
  );
}
