/**
 * POST /api/admin/google-sheets/sync - Trigger manual Google Sheets sync
 * GET /api/admin/google-sheets/sync - Get sync status
 *
 * Admin endpoint for syncing product rules to Google Sheets
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  syncProductRulesToSheets,
  isGoogleSheetsConfigured,
  getGoogleSheetsConfig
} from '@/services/google-sheets-sync';

// Track last sync result
let lastSyncResult: {
  timestamp: string;
  success: boolean;
  rowsWritten: number;
  storesProcessed: number;
  productsProcessed: number;
  duration_ms: number;
  error?: string;
} | null = null;

/**
 * GET /api/admin/google-sheets/sync
 *
 * Returns:
 * - Configuration status (configured/not configured)
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

    // Get config (without private key)
    const config = getGoogleSheetsConfig();

    return NextResponse.json({
      configured: true,
      config: {
        spreadsheetId: config.spreadsheetId,
        sheetName: config.sheetName,
        serviceAccountEmail: config.serviceAccountEmail
      },
      lastSync: lastSyncResult
    });
  } catch (error: any) {
    console.error('[API GOOGLE-SHEETS] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/google-sheets/sync
 *
 * Triggers a full sync of all active product rules to Google Sheets
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

    console.log('[API GOOGLE-SHEETS] Manual sync triggered');

    const result = await syncProductRulesToSheets();

    // Store result for status endpoint
    lastSyncResult = {
      timestamp: new Date().toISOString(),
      ...result
    };

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Successfully synced ${result.productsProcessed} products from ${result.storesProcessed} stores`,
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
    console.error('[API GOOGLE-SHEETS] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
