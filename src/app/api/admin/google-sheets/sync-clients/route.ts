/**
 * POST /api/admin/google-sheets/sync-clients - Trigger client directory sync
 * GET /api/admin/google-sheets/sync-clients - Get sync status
 *
 * Admin endpoint for syncing store data to "Список клиентов" sheet
 * Uses incremental upsert strategy (update existing, append new)
 */

import { NextRequest, NextResponse } from 'next/server';
import { isGoogleSheetsConfigured, getGoogleSheetsConfig } from '@/services/google-sheets-sync';
import { syncClientDirectory } from '@/services/google-sheets-sync/client-directory';

// Track last sync result
let lastSyncResult: {
  timestamp: string;
  success: boolean;
  storesProcessed: number;
  rowsUpdated: number;
  rowsAppended: number;
  duration_ms: number;
  error?: string;
} | null = null;

/**
 * GET /api/admin/google-sheets/sync-clients
 *
 * Returns:
 * - Configuration status
 * - Last sync result (if any)
 */
export async function GET() {
  try {
    const configured = isGoogleSheetsConfigured();

    if (!configured) {
      return NextResponse.json({
        configured: false,
        message: 'Google Sheets sync is not configured. Set GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, and GOOGLE_PRIVATE_KEY environment variables.',
        lastSync: null
      });
    }

    const config = getGoogleSheetsConfig();

    return NextResponse.json({
      configured: true,
      config: {
        spreadsheetId: config.spreadsheetId,
        sheetName: 'Список клиентов',
        serviceAccountEmail: config.serviceAccountEmail
      },
      lastSync: lastSyncResult
    });
  } catch (error: any) {
    console.error('[API SYNC-CLIENTS] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/google-sheets/sync-clients
 *
 * Triggers incremental sync of store data to "Список клиентов" sheet
 */
export async function POST(request: NextRequest) {
  try {
    const configured = isGoogleSheetsConfigured();

    if (!configured) {
      return NextResponse.json({
        error: 'Google Sheets sync is not configured',
        details: 'Set GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, and GOOGLE_PRIVATE_KEY environment variables.'
      }, { status: 400 });
    }

    console.log('[API SYNC-CLIENTS] Manual sync triggered');

    const result = await syncClientDirectory();

    // Store result for status endpoint
    lastSyncResult = {
      timestamp: new Date().toISOString(),
      ...result
    };

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Synced ${result.storesProcessed} stores: ${result.rowsUpdated} updated, ${result.rowsAppended} appended`,
        result
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
        result
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('[API SYNC-CLIENTS] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
