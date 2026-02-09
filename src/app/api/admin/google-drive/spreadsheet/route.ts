import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getGoogleSheetsConfig } from '@/services/google-sheets-sync/sync-service';
import { clearTokenCache } from '@/services/google-sheets-sync/sheets-client';

const GOOGLE_SHEETS_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

/**
 * GET /api/admin/google-drive/spreadsheet?id=xxx
 * Get spreadsheet metadata and data
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const spreadsheetId = searchParams.get('id');
    const sheetName = searchParams.get('sheet'); // Optional: specific sheet
    const includeFormulas = searchParams.get('formulas') === 'true';

    if (!spreadsheetId) {
      return NextResponse.json({
        error: 'Missing id parameter'
      }, { status: 400 });
    }

    clearTokenCache();
    const config = getGoogleSheetsConfig();

    // Get access token
    const tokenResponse = await getAccessToken(config);

    // Get spreadsheet metadata
    const metadataUrl = `${GOOGLE_SHEETS_BASE_URL}/${spreadsheetId}?fields=properties,sheets.properties`;
    const metadataRes = await fetch(metadataUrl, {
      headers: { 'Authorization': `Bearer ${tokenResponse}` }
    });

    if (!metadataRes.ok) {
      const error = await metadataRes.text();
      throw new Error(`Failed to get metadata: ${metadataRes.status} ${error}`);
    }

    const metadata = await metadataRes.json();

    // Get sheets info
    const sheets = metadata.sheets.map((s: any) => ({
      id: s.properties.sheetId,
      title: s.properties.title,
      index: s.properties.index,
      rowCount: s.properties.gridProperties?.rowCount,
      columnCount: s.properties.gridProperties?.columnCount
    }));

    // If specific sheet requested, get its data
    let sheetData = null;
    let formulas = null;

    if (sheetName) {
      // Get values
      const valuesUrl = `${GOOGLE_SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A1:Z100`;
      const valuesRes = await fetch(valuesUrl, {
        headers: { 'Authorization': `Bearer ${tokenResponse}` }
      });

      if (valuesRes.ok) {
        const values = await valuesRes.json();
        sheetData = values.values || [];
      }

      // Get formulas if requested
      if (includeFormulas) {
        const formulasUrl = `${GOOGLE_SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(sheetName)}!A1:Z100?valueRenderOption=FORMULA`;
        const formulasRes = await fetch(formulasUrl, {
          headers: { 'Authorization': `Bearer ${tokenResponse}` }
        });

        if (formulasRes.ok) {
          const formulasData = await formulasRes.json();
          formulas = formulasData.values || [];
        }
      }
    }

    return NextResponse.json({
      success: true,
      spreadsheetId,
      title: metadata.properties.title,
      locale: metadata.properties.locale,
      sheets,
      sheetData,
      formulas
    });

  } catch (error: any) {
    console.error('[GoogleDrive] Error reading spreadsheet:', error.message);
    return NextResponse.json({
      error: 'Failed to read spreadsheet',
      details: error.message
    }, { status: 500 });
  }
}

// Helper to get access token (copied from sheets-client for standalone use)
async function getAccessToken(config: any): Promise<string> {
  const crypto = await import('crypto');

  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;

  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: config.serviceAccountEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: expiry,
    iat: now
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signatureInput);
  const signature = sign.sign(config.privateKey, 'base64url');
  const jwt = `${signatureInput}.${signature}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  if (!response.ok) {
    throw new Error(`Token error: ${await response.text()}`);
  }

  const data = await response.json();
  return data.access_token;
}
