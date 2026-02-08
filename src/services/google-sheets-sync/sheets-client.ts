/**
 * Google Sheets API Client for Node.js
 * Uses native Node.js crypto for JWT signing
 */

import crypto from 'crypto';
import type { GoogleSheetsConfig } from './types';

const GOOGLE_TOKEN_URI = 'https://oauth2.googleapis.com/token';
const GOOGLE_SHEETS_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';
const GOOGLE_DRIVE_BASE_URL = 'https://www.googleapis.com/drive/v3';

// Request both Sheets and Drive scopes
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.readonly'
].join(' ');

let cachedToken: { token: string; expires: number } | null = null;

/**
 * Generate JWT for Google Service Account authentication
 */
function generateJWT(config: GoogleSheetsConfig): string {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600; // 1 hour

  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const payload = {
    iss: config.serviceAccountEmail,
    scope: SCOPES,
    aud: GOOGLE_TOKEN_URI,
    exp: expiry,
    iat: now
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');

  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  // Sign with RS256 using Node.js crypto
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signatureInput);
  const signature = sign.sign(config.privateKey, 'base64url');

  return `${signatureInput}.${signature}`;
}

/**
 * Get access token from Google OAuth
 */
async function getAccessToken(config: GoogleSheetsConfig): Promise<string> {
  // Check cache
  if (cachedToken && cachedToken.expires > Date.now()) {
    return cachedToken.token;
  }

  const jwt = generateJWT(config);

  const response = await fetch(GOOGLE_TOKEN_URI, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${response.status} ${error}`);
  }

  const data = await response.json();

  // Cache token (expires in 1 hour, cache for 50 minutes)
  cachedToken = {
    token: data.access_token,
    expires: Date.now() + 50 * 60 * 1000
  };

  return data.access_token;
}

/**
 * Clear sheet and write all rows (full sync)
 */
export async function clearAndWriteRows(
  config: GoogleSheetsConfig,
  headers: string[],
  rows: string[][]
): Promise<{ updatedRows: number }> {
  const token = await getAccessToken(config);
  const sheetName = config.sheetName;

  console.log(`[GoogleSheets] Clearing sheet "${sheetName}"...`);

  // 1. Clear the sheet
  const clearUrl = `${GOOGLE_SHEETS_BASE_URL}/${config.spreadsheetId}/values/${encodeURIComponent(sheetName)}:clear`;
  const clearResponse = await fetch(clearUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!clearResponse.ok) {
    const error = await clearResponse.text();
    throw new Error(`Failed to clear sheet: ${clearResponse.status} ${error}`);
  }

  console.log(`[GoogleSheets] Sheet cleared. Writing ${rows.length + 1} rows...`);

  // 2. Write headers + data
  const allRows = [headers, ...rows];
  const updateUrl = `${GOOGLE_SHEETS_BASE_URL}/${config.spreadsheetId}/values/${encodeURIComponent(sheetName)}!A1?valueInputOption=USER_ENTERED`;

  const updateResponse = await fetch(updateUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: allRows
    })
  });

  if (!updateResponse.ok) {
    const error = await updateResponse.text();
    throw new Error(`Failed to write data: ${updateResponse.status} ${error}`);
  }

  const result = await updateResponse.json();
  console.log(`[GoogleSheets] ✅ Successfully wrote ${result.updatedRows} rows`);

  return {
    updatedRows: result.updatedRows || rows.length + 1
  };
}

/**
 * Clear cached token (for testing)
 */
export function clearTokenCache(): void {
  cachedToken = null;
}

// ============================================
// Google Drive API Functions
// ============================================

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime?: string;
  modifiedTime?: string;
  size?: string;
  webViewLink?: string;
}

/**
 * List files in a Google Drive folder
 * @param config - Google API config
 * @param folderId - Google Drive folder ID (from URL)
 * @param pageSize - Max files to return (default 100)
 */
export async function listFilesInFolder(
  config: GoogleSheetsConfig,
  folderId: string,
  pageSize: number = 100
): Promise<DriveFile[]> {
  const token = await getAccessToken(config);

  const query = `'${folderId}' in parents and trashed = false`;
  const fields = 'files(id,name,mimeType,createdTime,modifiedTime,size,webViewLink)';

  const url = `${GOOGLE_DRIVE_BASE_URL}/files?q=${encodeURIComponent(query)}&fields=${encodeURIComponent(fields)}&pageSize=${pageSize}&orderBy=name`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list files: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.files || [];
}

/**
 * Get file metadata by ID
 */
export async function getFileMetadata(
  config: GoogleSheetsConfig,
  fileId: string
): Promise<DriveFile> {
  const token = await getAccessToken(config);

  const fields = 'id,name,mimeType,createdTime,modifiedTime,size,webViewLink';
  const url = `${GOOGLE_DRIVE_BASE_URL}/files/${fileId}?fields=${encodeURIComponent(fields)}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get file metadata: ${response.status} ${error}`);
  }

  return response.json();
}

/**
 * Read Google Sheets data by spreadsheet ID
 * @param config - Google API config
 * @param spreadsheetId - Spreadsheet ID
 * @param range - A1 notation range (e.g., "Sheet1!A1:Z1000")
 */
export async function readSheetData(
  config: GoogleSheetsConfig,
  spreadsheetId: string,
  range: string
): Promise<string[][]> {
  const token = await getAccessToken(config);

  const url = `${GOOGLE_SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(range)}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to read sheet: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.values || [];
}

/**
 * Batch update multiple rows at specific ranges (for upsert operations)
 * @param config - Google API config
 * @param updates - Array of { range, values } to update
 */
export async function batchUpdateRows(
  config: GoogleSheetsConfig,
  updates: Array<{ range: string; values: string[][] }>
): Promise<{ updatedCells: number }> {
  if (updates.length === 0) {
    return { updatedCells: 0 };
  }

  const token = await getAccessToken(config);

  const url = `${GOOGLE_SHEETS_BASE_URL}/${config.spreadsheetId}/values:batchUpdate`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      valueInputOption: 'USER_ENTERED',
      data: updates
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to batch update: ${response.status} ${error}`);
  }

  const result = await response.json();
  return {
    updatedCells: result.totalUpdatedCells || 0
  };
}

/**
 * Append rows to the end of a sheet (for new entries)
 * @param config - Google API config
 * @param rows - Rows to append
 */
export async function appendRows(
  config: GoogleSheetsConfig,
  rows: string[][]
): Promise<{ appendedRows: number }> {
  if (rows.length === 0) {
    return { appendedRows: 0 };
  }

  const token = await getAccessToken(config);
  const sheetName = config.sheetName;

  const url = `${GOOGLE_SHEETS_BASE_URL}/${config.spreadsheetId}/values/${encodeURIComponent(sheetName)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: rows
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to append rows: ${response.status} ${error}`);
  }

  const result = await response.json();
  return {
    appendedRows: result.updates?.updatedRows || rows.length
  };
}
