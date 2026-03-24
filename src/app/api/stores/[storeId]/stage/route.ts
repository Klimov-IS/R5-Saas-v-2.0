import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';
import type { StoreStage } from '@/db/helpers';
import { triggerAsyncSync } from '@/services/google-sheets-sync';
import { query } from '@/db/client';

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

    // When transitioning TO chats_opened: reset chat_status_by_review = 'unknown'
    // for eligible reviews so the extension re-parses them (chats may now be available)
    let chatStatusReset = 0;
    if (stage === 'chats_opened' && store.stage !== 'chats_opened') {
      const resetResult = await query(
        `UPDATE reviews r
         SET chat_status_by_review = 'unknown'
         FROM products p
         JOIN product_rules pr ON pr.product_id = p.id
         WHERE r.product_id = p.id
           AND r.store_id = $1
           AND p.store_id = $1
           AND p.work_status = 'active'
           AND pr.work_in_chats = TRUE
           AND r.chat_status_by_review = 'unavailable'
           AND r.marketplace = 'wb'
           AND r.rating_excluded = FALSE
           AND r.review_status_wb NOT IN ('unpublished', 'excluded', 'deleted')
           AND r.date >= COALESCE(pr.work_from_date, '2023-10-01')
           AND (
             (r.rating = 1 AND pr.chat_rating_1 = TRUE) OR
             (r.rating = 2 AND pr.chat_rating_2 = TRUE) OR
             (r.rating = 3 AND pr.chat_rating_3 = TRUE) OR
             (r.rating = 4 AND pr.chat_rating_4 = TRUE)
           )`,
        [storeId]
      );
      chatStatusReset = resetResult.rowCount || 0;
      if (chatStatusReset > 0) {
        console.log(`[STAGE] Reset chat_status_by_review to 'unknown' for ${chatStatusReset} reviews (store ${storeId})`);
      }
    }

    // Trigger Google Sheets sync on store stage change (async, non-blocking)
    triggerAsyncSync();

    return NextResponse.json({
      data: updatedStore,
      message: 'Store stage updated successfully',
      ...(chatStatusReset > 0 ? { chatStatusReset } : {}),
    }, { status: 200 });

  } catch (error: any) {
    console.error('[API ERROR] PATCH /api/stores/[storeId]/stage:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
