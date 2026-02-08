/**
 * Google Drive folder matching for stores
 * Uses fuzzy name matching to link stores to their Drive folders
 */

import type { DriveFile } from '../sheets-client';
import type { DriveFolderMatch } from './types';

/**
 * Normalize store/folder name for comparison
 * Removes legal forms (ООО, ИП, etc.), quotes, extra spaces
 */
export function normalizeStoreName(name: string): string {
  return name
    .toLowerCase()
    // Remove quotes of all types
    .replace(/["'«»""'']/g, '')
    // Remove legal form prefixes
    .replace(/^(ооо|ип|зао|пао|оао|ао)\s*/gi, '')
    // Remove legal forms anywhere
    .replace(/\s+(ооо|ип|зао|пао|оао|ао)(\s+|$)/gi, ' ')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find the best matching folder for a store name
 * @param storeName - Store name from database
 * @param folders - List of Drive folders
 * @returns The best matching folder or null
 */
export function findMatchingFolder(
  storeName: string,
  folders: DriveFile[]
): DriveFile | null {
  const normalizedStore = normalizeStoreName(storeName);

  // Priority 1: Exact normalized match
  for (const folder of folders) {
    const normalizedFolder = normalizeStoreName(folder.name);
    if (normalizedFolder === normalizedStore) {
      return folder;
    }
  }

  // Priority 2: Store name contains folder name or vice versa
  for (const folder of folders) {
    const normalizedFolder = normalizeStoreName(folder.name);
    if (
      normalizedFolder.includes(normalizedStore) ||
      normalizedStore.includes(normalizedFolder)
    ) {
      return folder;
    }
  }

  // Priority 3: Word-based matching (>60% words match)
  const storeWords = normalizedStore.split(' ').filter(w => w.length > 2);
  if (storeWords.length > 0) {
    let bestMatch: DriveFile | null = null;
    let bestScore = 0;

    for (const folder of folders) {
      const folderWords = normalizeStoreName(folder.name).split(' ').filter(w => w.length > 2);
      if (folderWords.length === 0) continue;

      const matchingWords = storeWords.filter(sw =>
        folderWords.some(fw => fw === sw || fw.includes(sw) || sw.includes(fw))
      );

      const score = matchingWords.length / Math.max(storeWords.length, folderWords.length);

      if (score > 0.6 && score > bestScore) {
        bestScore = score;
        bestMatch = folder;
      }
    }

    if (bestMatch) {
      return bestMatch;
    }
  }

  return null;
}

/**
 * Find report file in folder contents
 * Looking for files starting with "Отчёт:" or "Отчет:"
 */
export function findReportFile(files: DriveFile[]): DriveFile | null {
  for (const file of files) {
    const name = file.name.toLowerCase();
    if (name.startsWith('отчёт:') || name.startsWith('отчет:')) {
      return file;
    }
  }
  return null;
}

/**
 * Find screenshots folder in folder contents
 */
export function findScreenshotsFolder(files: DriveFile[]): DriveFile | null {
  for (const file of files) {
    const name = file.name.toLowerCase();
    if (
      file.mimeType === 'application/vnd.google-apps.folder' &&
      (name === 'скриншоты' || name.includes('screenshot'))
    ) {
      return file;
    }
  }
  return null;
}

/**
 * Build folder match result with links
 */
export function buildFolderMatch(
  folder: DriveFile | null,
  folderContents: DriveFile[]
): DriveFolderMatch {
  if (!folder) {
    return {
      folderId: null,
      folderLink: null,
      reportId: null,
      reportLink: null,
      screenshotsId: null,
      screenshotsLink: null
    };
  }

  const report = findReportFile(folderContents);
  const screenshots = findScreenshotsFolder(folderContents);

  return {
    folderId: folder.id,
    folderLink: folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`,
    reportId: report?.id || null,
    reportLink: report?.webViewLink || (report ? `https://docs.google.com/spreadsheets/d/${report.id}` : null),
    screenshotsId: screenshots?.id || null,
    screenshotsLink: screenshots?.webViewLink || (screenshots ? `https://drive.google.com/drive/folders/${screenshots.id}` : null)
  };
}
