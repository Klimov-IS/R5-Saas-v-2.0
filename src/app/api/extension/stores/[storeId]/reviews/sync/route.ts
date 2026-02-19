/**
 * POST /api/extension/stores/[storeId]/reviews/sync
 *
 * Syncs review statuses from Chrome extension to database
 * This makes DB the single source of truth with live status updates
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db/client';
import { getUserByApiToken } from '@/db/extension-helpers';

interface ReviewSyncPayload {
  reviews: Array<{
    id: string;
    product_id?: string;
    rating: number;
    text: string;
    author: string;
    date: string;

    // Extension-parsed statuses
    review_status_wb: 'visible' | 'unpublished' | 'excluded' | 'deleted' | 'unknown';
    product_status_by_review: 'purchased' | 'refused' | 'not_specified' | 'unknown';
    chat_status_by_review: 'unavailable' | 'available' | 'opened' | 'unknown';
    complaint_status: 'not_sent' | 'draft' | 'sent' | 'approved' | 'rejected' | 'pending';

    parsed_at: string;
    page_number: number;
  }>;
}

// CORS headers for localhost development
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Allow all origins in dev (тестовый сервер)
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { storeId: string } }
) {
  try {
    const { storeId } = params;

    // 1. Authenticate
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Missing or invalid Authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const user = await getUserByApiToken(token);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid token' },
        { status: 401 }
      );
    }

    // 2. Verify store access
    const storeCheck = await query<{ owner_id: string }>(
      `SELECT owner_id FROM stores WHERE id = $1`,
      [storeId]
    );

    if (storeCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Not found', message: `Store ${storeId} not found` },
        { status: 404 }
      );
    }

    if (storeCheck.rows[0].owner_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You do not have access to this store' },
        { status: 403 }
      );
    }

    // 3. Parse request body
    const body: ReviewSyncPayload = await request.json();

    if (!body.reviews || !Array.isArray(body.reviews)) {
      return NextResponse.json(
        { error: 'Invalid request: reviews array required' },
        { status: 400 }
      );
    }

    console.log(`[Extension API] Syncing ${body.reviews.length} reviews for store ${storeId}`);

    // 4. Upsert reviews (batch)
    let synced = 0;
    let updated = 0;
    let inserted = 0;

    for (const review of body.reviews) {
      try {
        // Check if review exists
        const existingReview = await query(
          `SELECT id, review_status_wb, complaint_status FROM reviews WHERE id = $1`,
          [review.id]
        );

        if (existingReview.rows.length > 0) {
          // UPDATE existing review
          await query(
            `
            UPDATE reviews
            SET
              review_status_wb = $1::review_status_wb,
              product_status_by_review = $2::product_status_by_review,
              chat_status_by_review = $3::chat_status_by_review,
              complaint_status = $4::complaint_status,
              parsed_at = $5,
              page_number = $6,
              updated_at = NOW()
            WHERE id = $7
            `,
            [
              review.review_status_wb,
              review.product_status_by_review,
              review.chat_status_by_review,
              review.complaint_status,
              review.parsed_at,
              review.page_number,
              review.id
            ]
          );
          updated++;
        } else {
          // INSERT new review (basic fields only, full sync from WB API will fill the rest)
          // We need to get product_id from vendor_code or skip if not found
          // For now, we'll skip INSERT if review doesn't exist (extension should only update existing reviews)
          console.warn(`[Extension API] Review ${review.id} not found in DB, skipping insert`);
          continue;
        }

        synced++;
      } catch (error: any) {
        console.error(`[Extension API] Error syncing review ${review.id}:`, error);
        // Continue with next review
      }
    }

    console.log(`[Extension API] Sync complete: ${synced} synced (${updated} updated, ${inserted} inserted)`);

    return NextResponse.json(
      {
        success: true,
        synced,
        updated,
        inserted
      },
      { headers: corsHeaders }
    );

  } catch (error: any) {
    console.error('[Extension API] Error syncing reviews:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
