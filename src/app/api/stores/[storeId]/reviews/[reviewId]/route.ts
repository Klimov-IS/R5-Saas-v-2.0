import { NextRequest, NextResponse } from 'next/server';
import { getReviewById, updateReviewDraftReply } from '@/db/helpers';

/**
 * GET /api/stores/[storeId]/reviews/[reviewId]
 * Get single review details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { storeId: string; reviewId: string } }
) {
  try {
    const { reviewId } = params;

    const review = await getReviewById(reviewId);

    if (!review) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: review }, { status: 200 });
  } catch (error: any) {
    console.error('[API ERROR] GET /api/stores/[storeId]/reviews/[reviewId]:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/stores/[storeId]/reviews/[reviewId]
 * Update review draft reply or complaint
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { storeId: string; reviewId: string } }
) {
  try {
    const { reviewId } = params;
    const body = await request.json();
    const { draftReply, complaintText } = body;

    let updatedReview;

    if (draftReply !== undefined) {
      if (typeof draftReply !== 'string') {
        return NextResponse.json(
          { error: 'draftReply must be a string' },
          { status: 400 }
        );
      }
      updatedReview = await updateReviewDraftReply(reviewId, draftReply);
    } else if (complaintText !== undefined) {
      if (typeof complaintText !== 'string') {
        return NextResponse.json(
          { error: 'complaintText must be a string' },
          { status: 400 }
        );
      }
      const { updateReviewComplaint } = await import('@/db/helpers');
      updatedReview = await updateReviewComplaint(reviewId, complaintText);
    } else {
      return NextResponse.json(
        { error: 'Either draftReply or complaintText is required' },
        { status: 400 }
      );
    }

    if (!updatedReview) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: updatedReview }, { status: 200 });
  } catch (error: any) {
    console.error('[API ERROR] PUT /api/stores/[storeId]/reviews/[reviewId]:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
