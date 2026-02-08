/**
 * Store Onboarding Service
 *
 * Automatically creates Google Drive resources when a new store is created:
 * 1. Client folder in the shared Clients folder
 * 2. Report spreadsheet copied from template
 * 3. Screenshots subfolder
 * 4. Updates client directory sheet with links
 */

import {
  createFolder,
  copyFile,
  listFilesInFolder,
  clearTokenCache,
  type DriveFile
} from '@/services/google-sheets-sync/sheets-client';
import { getGoogleSheetsConfig } from '@/services/google-sheets-sync/sync-service';
import { syncClientDirectory } from '@/services/google-sheets-sync/client-directory';
import { normalizeStoreName, findMatchingFolder } from '@/services/google-sheets-sync/client-directory/drive-matcher';
import type { OnboardingResult, OnboardingConfig } from './types';

// Configuration from environment variables
const CLIENTS_FOLDER_ID = process.env.GOOGLE_DRIVE_CLIENTS_FOLDER_ID || '1GelGC6stQVoc5OaJuachXNZtuJvOevyK';
const REPORT_TEMPLATE_ID = process.env.GOOGLE_DRIVE_REPORT_TEMPLATE_ID || '1YCH-OOh7Gaqt4ksFMG2BOmWydnD-JiG6SkaltP91m-A';

/**
 * Sleep helper for retry logic
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry wrapper with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxRetries) {
        throw lastError;
      }

      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`[ONBOARDING] Retry ${attempt}/${maxRetries} after ${delay}ms: ${lastError.message}`);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Check if folder already exists for this store
 */
async function findExistingFolder(
  storeName: string,
  existingFolders: DriveFile[]
): Promise<DriveFile | null> {
  return findMatchingFolder(storeName, existingFolders);
}

/**
 * Main onboarding function - creates all resources for a new store
 */
export async function onboardStore(
  storeId: string,
  storeName: string
): Promise<OnboardingResult> {
  const startTime = Date.now();

  console.log(`[ONBOARDING] Starting onboarding for store: ${storeName} (${storeId})`);

  try {
    // Clear token cache to ensure fresh token with new scopes
    clearTokenCache();

    const config = getGoogleSheetsConfig();

    // 1. Check if folder already exists (idempotency)
    console.log(`[ONBOARDING] Checking for existing folder...`);
    const existingFolders = await withRetry(() =>
      listFilesInFolder(config, CLIENTS_FOLDER_ID)
    );

    let clientFolder = await findExistingFolder(storeName, existingFolders);
    let folderCreated = false;

    if (clientFolder) {
      console.log(`[ONBOARDING] Found existing folder: ${clientFolder.id}`);
    } else {
      // 2. Create client folder
      console.log(`[ONBOARDING] Creating client folder: ${storeName}`);
      clientFolder = await withRetry(() =>
        createFolder(config, storeName, CLIENTS_FOLDER_ID)
      );
      folderCreated = true;
      console.log(`[ONBOARDING] Created folder: ${clientFolder.id}`);
    }

    // 3. Check for existing report in folder
    const folderContents = await withRetry(() =>
      listFilesInFolder(config, clientFolder!.id)
    );

    let reportFile: DriveFile | undefined;
    let screenshotsFolder: DriveFile | undefined;

    // Look for existing report
    for (const file of folderContents) {
      if (file.name.toLowerCase().startsWith('отчёт:') || file.name.toLowerCase().startsWith('отчет:')) {
        reportFile = file;
      }
      if (file.mimeType === 'application/vnd.google-apps.folder' &&
          (file.name.toLowerCase() === 'скриншоты' || file.name.toLowerCase().includes('screenshot'))) {
        screenshotsFolder = file;
      }
    }

    // 4. Copy report template if not exists
    if (!reportFile) {
      console.log(`[ONBOARDING] Copying report template...`);
      const reportName = `Отчёт: ${storeName}`;
      try {
        reportFile = await withRetry(() =>
          copyFile(config, REPORT_TEMPLATE_ID, reportName, clientFolder!.id)
        );
        console.log(`[ONBOARDING] Created report: ${reportFile.id}`);
      } catch (err) {
        // Template might not be shared with service account yet
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(`[ONBOARDING] ⚠️ Failed to copy report template (will continue without it)`);
        console.warn(`[ONBOARDING] ⚠️ Error: ${errMsg.slice(0, 150)}`);
        console.warn(`[ONBOARDING] ⚠️ FIX: Share template (${REPORT_TEMPLATE_ID}) with ${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL}`);
        // Continue without report - folder and screenshots will still be created
      }
    } else {
      console.log(`[ONBOARDING] Found existing report: ${reportFile.id}`);
    }

    // 5. Create screenshots folder if not exists
    if (!screenshotsFolder) {
      console.log(`[ONBOARDING] Creating screenshots folder...`);
      screenshotsFolder = await withRetry(() =>
        createFolder(config, 'Скриншоты', clientFolder!.id)
      );
      console.log(`[ONBOARDING] Created screenshots folder: ${screenshotsFolder.id}`);
    } else {
      console.log(`[ONBOARDING] Found existing screenshots folder: ${screenshotsFolder.id}`);
    }

    // 6. Trigger client directory sync to update the sheet
    console.log(`[ONBOARDING] Triggering client directory sync...`);
    // Don't await - let it run in background
    syncClientDirectory().catch(err => {
      console.error(`[ONBOARDING] Client directory sync failed:`, err);
    });

    const duration = Date.now() - startTime;
    const hasReport = !!reportFile;
    console.log(`[ONBOARDING] ✅ Onboarding completed for ${storeName} in ${duration}ms (report: ${hasReport ? 'yes' : 'no'})`);

    return {
      success: true,
      storeId,
      storeName,
      folderId: clientFolder.id,
      folderLink: clientFolder.webViewLink,
      reportId: reportFile?.id,
      reportLink: reportFile?.webViewLink,
      screenshotsId: screenshotsFolder.id,
      screenshotsLink: screenshotsFolder.webViewLink,
      duration_ms: duration
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`[ONBOARDING] ❌ Onboarding failed for ${storeName} after ${duration}ms:`, errorMessage);

    return {
      success: false,
      storeId,
      storeName,
      error: errorMessage,
      duration_ms: duration
    };
  }
}

/**
 * Fire-and-forget trigger for store onboarding
 * Use this after store creation - it won't block the API response
 */
export function triggerStoreOnboarding(storeId: string, storeName: string): void {
  console.log(`[ONBOARDING] Triggering async onboarding for: ${storeName}`);

  onboardStore(storeId, storeName)
    .then(result => {
      if (result.success) {
        console.log(`[ONBOARDING] Background onboarding completed: ${result.storeName}`);
        console.log(`[ONBOARDING]   Folder: ${result.folderLink}`);
        console.log(`[ONBOARDING]   Report: ${result.reportLink}`);
        console.log(`[ONBOARDING]   Screenshots: ${result.screenshotsLink}`);
      } else {
        console.error(`[ONBOARDING] Background onboarding failed: ${result.error}`);
      }
    })
    .catch(error => {
      console.error(`[ONBOARDING] Background onboarding error:`, error);
    });
}

/**
 * Check if onboarding is configured
 */
export function isOnboardingConfigured(): boolean {
  return !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_PRIVATE_KEY &&
    (process.env.GOOGLE_DRIVE_CLIENTS_FOLDER_ID || CLIENTS_FOLDER_ID) &&
    (process.env.GOOGLE_DRIVE_REPORT_TEMPLATE_ID || REPORT_TEMPLATE_ID)
  );
}
