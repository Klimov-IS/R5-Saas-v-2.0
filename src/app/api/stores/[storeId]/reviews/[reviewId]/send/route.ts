import { NextRequest, NextResponse } from 'next/server';
import { getReviewById, markReviewReplySent, getStoreById } from '@/db/helpers';
import { createOzonClient } from '@/lib/ozon-api';

/**
 * POST /api/stores/[storeId]/reviews/[reviewId]/send
 * Send review reply to marketplace API (WB or OZON)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { storeId: string; reviewId: string } }
) {
  try {
    const { storeId, reviewId } = params;
    const body = await request.json();
    const { replyText } = body;

    if (!replyText || typeof replyText !== 'string') {
      return NextResponse.json(
        { error: 'replyText is required and must be a string' },
        { status: 400 }
      );
    }

    // Get review
    const review = await getReviewById(reviewId);
    if (!review) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      );
    }

    // Get store to get API credentials
    const store = await getStoreById(storeId);
    if (!store) {
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 404 }
      );
    }

    // OZON stores: use OZON Review Comment API
    if (store.marketplace === 'ozon') {
      if (!store.ozon_client_id || !store.ozon_api_key) {
        return NextResponse.json(
          { error: 'OZON credentials not configured for this store' },
          { status: 400 }
        );
      }

      // OZON review IDs are stored as "ozon_{uuid}" — extract the original UUID
      const ozonReviewId = reviewId.startsWith('ozon_') ? reviewId.slice(5) : reviewId;

      const client = createOzonClient(store.ozon_client_id, store.ozon_api_key);
      const result = await client.createReviewComment(ozonReviewId, replyText);

      // Update local database
      const updatedReview = await markReviewReplySent(reviewId, replyText);

      return NextResponse.json({
        success: true,
        data: { ...updatedReview, ozon_comment_id: result.commentId },
      }, { status: 200 });
    }

    // WB stores: use WB Feedbacks API
    const wbToken = store.feedbacks_api_token || store.api_token;
    if (!wbToken) {
      return NextResponse.json(
        { error: 'Feedbacks API token not configured for this store' },
        { status: 400 }
      );
    }

    const wbResponse = await fetch('https://feedbacks-api.wildberries.ru/api/v1/feedbacks', {
      method: 'PATCH',
      headers: {
        'Authorization': wbToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: review.wb_feedback_id,
        text: replyText,
      }),
    });

    if (!wbResponse.ok) {
      const errorText = await wbResponse.text();
      console.error(`WB Reviews PATCH API error: ${wbResponse.status} ${errorText}`);
      return NextResponse.json(
        { error: `Ошибка API Wildberries: ${wbResponse.status}`, details: errorText },
        { status: wbResponse.status }
      );
    }

    // Update local database
    const updatedReview = await markReviewReplySent(reviewId, replyText);

    if (!updatedReview) {
      return NextResponse.json(
        { error: 'Failed to update review in database' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedReview,
    }, { status: 200 });

  } catch (error: any) {
    console.error('[API ERROR] POST /api/stores/[storeId]/reviews/[reviewId]/send:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
