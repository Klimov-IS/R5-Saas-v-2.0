import { NextRequest, NextResponse } from 'next/server';
import { getReviewById, markReviewReplySent, getStoreById } from '@/db/helpers';

/**
 * POST /api/stores/[storeId]/reviews/[reviewId]/send
 * Send review reply to Wildberries API
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

    // Get review to get the WB feedback ID
    const review = await getReviewById(reviewId);
    if (!review) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      );
    }

    // Get store to get WB API token
    const store = await getStoreById(storeId);
    if (!store) {
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 404 }
      );
    }

    const wbToken = store.feedbacks_api_token || store.api_token;
    if (!wbToken) {
      return NextResponse.json(
        { error: 'Feedbacks API token not configured for this store' },
        { status: 400 }
      );
    }

    // Send reply to WB API
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
