import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';
import { triggerAsyncSync } from '@/services/google-sheets-sync';

/**
 * PATCH /api/stores/[storeId]/status
 * Toggle store active status
 *
 * Body: { is_active: boolean }
 *
 * Used for quick status changes from the stores management page.
 * Supports optimistic updates on the frontend.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { storeId: string } }
) {
  try {
    // Authentication
    const authHeader = headers().get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing or invalid authorization header.' },
        { status: 401 }
      );
    }

    const apiKey = authHeader.split(' ')[1];
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Unauthorized: API key is missing.' },
        { status: 401 }
      );
    }

    const userSettings = await dbHelpers.verifyApiKey(apiKey);
    if (!userSettings) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid API key.' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { is_active } = body;

    // Validate
    if (typeof is_active !== 'boolean') {
      return NextResponse.json(
        {
          error: 'Invalid value',
          details: 'is_active must be a boolean (true or false)'
        },
        { status: 400 }
      );
    }

    // Get store
    const { storeId } = params;
    const store = await dbHelpers.getStoreById(storeId);

    if (!store) {
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 404 }
      );
    }

    // Update status + track deactivation date
    const updatedStore = await dbHelpers.updateStore(storeId, {
      is_active,
      deactivated_at: is_active ? null : new Date().toISOString()
    });

    if (!updatedStore) {
      return NextResponse.json(
        { error: 'Failed to update store status' },
        { status: 500 }
      );
    }

    // Trigger Google Sheets sync on store status change (async, non-blocking)
    triggerAsyncSync();

    return NextResponse.json({
      data: updatedStore,
      message: 'Store status updated successfully'
    }, { status: 200 });

  } catch (error: any) {
    console.error('[API ERROR] PATCH /api/stores/[storeId]/status:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
