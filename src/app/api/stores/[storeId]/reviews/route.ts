import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';

function formatReview(review: any) {
    return {
        id: review.id,
        product_id: review.product_id,
        store_id: review.store_id,
        rating: review.rating,
        text: review.text,
        pros: review.pros,
        cons: review.cons,
        author: review.author,
        date: review.date,
        answer: review.answer || null,
        draft_reply: review.draft_reply || null,
        complaint_text: review.complaint_text || null,
        complaint_sent_date: review.complaint_sent_date || null,
        has_answer: !!review.answer,
        has_complaint: !!review.complaint_sent_date,
        has_complaint_draft: !!review.complaint_text && !review.complaint_sent_date,
        review_status_wb: review.review_status_wb || 'unknown',
        product_status_by_review: review.product_status_by_review || 'unknown',
        chat_status_by_review: review.chat_status_by_review || 'unknown',
        complaint_status: review.complaint_status || 'not_sent',
        complaint_generated_at: review.complaint_generated_at || null,
        complaint_reason_id: review.complaint_reason_id || null,
        complaint_category: review.complaint_category || null,
        purchase_date: review.purchase_date || null,
        parsed_at: review.parsed_at || null,
        page_number: review.page_number || null,
        is_product_active: review.is_product_active !== undefined ? review.is_product_active : true,
    };
}

export async function GET(request: NextRequest, { params }: { params: { storeId: string } }) {
    const { storeId } = params;
    const { searchParams } = new URL(request.url);

    const take = parseInt(searchParams.get('take') || '50', 10);
    const cursor = searchParams.get('cursor') || '';
    const cursorId = searchParams.get('cursorId') || '';
    const rating = searchParams.get('rating') || 'all';
    const hasAnswer = searchParams.get('hasAnswer') || 'all';
    const hasComplaint = searchParams.get('hasComplaint') || 'all';
    const productId = searchParams.get('productId') || '';
    const productIdsParam = searchParams.get('productIds') || '';
    const productIds = productIdsParam && productIdsParam !== 'all'
        ? productIdsParam.split(',').map(id => id.trim()).filter(Boolean)
        : [];
    const activeOnly = searchParams.get('activeOnly') === 'true';
    const productStatus = searchParams.get('productStatus') || 'all';
    const search = searchParams.get('search') || '';
    const reviewStatusWB = searchParams.get('reviewStatusWB') || 'all';
    const productStatusByReview = searchParams.get('productStatusByReview') || 'all';
    const complaintStatus = searchParams.get('complaintStatus') || 'all';
    const chatStatusByReview = searchParams.get('chatStatusByReview') || 'all';

    // Legacy offset pagination support (deprecated)
    const skip = searchParams.get('skip');

    const filterOptions: dbHelpers.ReviewsFilterOptions = {
        limit: take,
        rating,
        hasAnswer,
        hasComplaint,
        productId,
        productIds: productIds.length > 0 ? productIds : undefined,
        activeOnly,
        productStatus,
        search,
        reviewStatusWB,
        productStatusByReview,
        complaintStatus,
        chatStatusByReview,
    };

    try {
        // Legacy mode: skip/take offset pagination (backward compatible)
        if (skip !== null && !cursor) {
            const { reviews, totalCount } = await dbHelpers.getReviewsByStoreWithPagination(storeId, {
                ...filterOptions,
                offset: parseInt(skip, 10),
            });

            return NextResponse.json({
                data: reviews.map(formatReview),
                totalCount,
            }, { status: 200 });
        }

        // New mode: keyset cursor pagination (fast, O(1))
        const result = await dbHelpers.getReviewsWithCursor(storeId, {
            ...filterOptions,
            cursor: cursor || undefined,
            cursorId: cursorId || undefined,
        });

        return NextResponse.json({
            data: result.reviews.map(formatReview),
            nextCursor: result.nextCursor,
            nextCursorId: result.nextCursorId,
            hasMore: result.hasMore,
        }, { status: 200 });

    } catch (error: any) {
        console.error("Failed to fetch reviews via API:", error.message, error.stack);
        return NextResponse.json({
            error: 'Internal server error',
            details: error.message
        }, { status: 500 });
    }
}
