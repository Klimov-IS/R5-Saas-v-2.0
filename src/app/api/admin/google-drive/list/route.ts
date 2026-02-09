import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getGoogleSheetsConfig } from '@/services/google-sheets-sync/sync-service';
import { listFilesInFolder, clearTokenCache } from '@/services/google-sheets-sync/sheets-client';

/**
 * GET /api/admin/google-drive/list?folderId=xxx
 * List files in a Google Drive folder
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get('folderId');

    if (!folderId) {
      return NextResponse.json({
        error: 'Missing folderId parameter'
      }, { status: 400 });
    }

    // Clear old token cache (might have old scopes)
    clearTokenCache();

    const config = getGoogleSheetsConfig();
    const files = await listFilesInFolder(config, folderId);

    return NextResponse.json({
      success: true,
      folderId,
      fileCount: files.length,
      files: files.map(f => ({
        id: f.id,
        name: f.name,
        type: f.mimeType,
        modified: f.modifiedTime,
        link: f.webViewLink
      }))
    });

  } catch (error: any) {
    console.error('[GoogleDrive] Error listing files:', error.message);
    return NextResponse.json({
      error: 'Failed to list files',
      details: error.message
    }, { status: 500 });
  }
}
