import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';
import type { StoreStage } from '@/db/helpers';
import { triggerAsyncSync } from '@/services/google-sheets-sync';

/**
 * PATCH /api/stores/[storeId]/stage
 * Update store lifecycle stage
 *
 * Body: { stage: StoreStage }
 *
 * Used for managing client lifecycle stages from the stores management page.
 * Supports optimistic updates on the frontend.
 *
 * Sprint 006 Phase 2 - Store Lifecycle Management
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
    const { stage } = body;

    // Validate stage
    const validStages: StoreStage[] = [
      'contract',
      'access_received',
      'cabinet_connected',
      'complaints_submitted',
      'chats_opened',
      'monitoring',
      'client_paused',
      'client_lost',
    ];

    if (!stage || !validStages.includes(stage)) {
      return NextResponse.json(
        {
          error: 'Invalid stage value',
          details: `Stage must be one of: ${validStages.join(', ')}`
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

    // Update stage
    const updatedStore = await dbHelpers.updateStore(storeId, { stage });

    if (!updatedStore) {
      return NextResponse.json(
        { error: 'Failed to update store stage' },
        { status: 500 }
      );
    }

    // Trigger Google Sheets sync on store stage change (async, non-blocking)
    triggerAsyncSync();

    return NextResponse.json({
      data: updatedStore,
      message: 'Store stage updated successfully'
    }, { status: 200 });

  } catch (error: any) {
    console.error('[API ERROR] PATCH /api/stores/[storeId]/stage:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
