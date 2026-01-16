/**
 * POST /api/extension/stores/[storeId]/reviews/generate-complaints-batch
 *
 * Generates complaints in batch for multiple reviews (on-demand workflow)
 * Used by Chrome extension to generate complaints only when needed
 */

import { NextRequest, NextResponse } from 'next/server';
import { getReviewById, getStoreById, getProductById } from '@/db/helpers';
import {
  getComplaintByReviewId,
  createComplaint,
} from '@/db/complaint-helpers';
import { generateReviewComplaint } from '@/ai/flows/generate-review-complaint-flow';
import { getUserByApiToken } from '@/db/extension-helpers';
import { selectRelevantCharacteristics } from '@/ai/utils/product-characteristics-filter';
import { query } from '@/db/client';

interface GenerateComplaintsBatchPayload {
  review_ids: string[];
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

    // 2. Parse request body
    const body: GenerateComplaintsBatchPayload = await request.json();

    if (!body.review_ids || !Array.isArray(body.review_ids)) {
      return NextResponse.json(
        { error: 'Invalid request: review_ids array required' },
        { status: 400 }
      );
    }

    console.log(`[Extension API] Generating complaints for ${body.review_ids.length} reviews`);

    // 3. Verify store access
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

    // 4. Get store
    const store = await getStoreById(storeId);
    if (!store) {
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 404 }
      );
    }

    // 5. Generate complaints for each review
    const generated = [];
    const failed = [];

    for (const reviewId of body.review_ids) {
      try {
        // Get review
        const review = await getReviewById(reviewId);
        if (!review) {
          failed.push({
            review_id: reviewId,
            error: 'Review not found'
          });
          continue;
        }

        // Check if complaint already exists
        const existingComplaint = await getComplaintByReviewId(reviewId);

        // Skip if complaint already exists and is not draft
        if (existingComplaint && existingComplaint.status !== 'draft') {
          failed.push({
            review_id: reviewId,
            error: `Complaint already exists with status '${existingComplaint.status}'`
          });
          continue;
        }

        // Get product details
        const product = await getProductById(review.product_id);
        const productName = product?.name || 'Товар';
        const productVendorCode = product?.vendor_code || '';

        // Filter and select relevant characteristics
        const fullReviewText = [review.text, review.pros, review.cons]
          .filter(Boolean)
          .join(' ');

        const productCharacteristics = selectRelevantCharacteristics(
          product?.wb_api_data?.characteristics,
          fullReviewText,
          7 // Max 7 characteristics
        );

        // Generate AI complaint
        const aiResult = await generateReviewComplaint({
          productName,
          productVendorCode,
          productCharacteristics,
          compensationMethod: undefined,
          reviewAuthor: review.author,
          reviewText: review.text || '',
          reviewRating: review.rating,
          reviewPros: review.pros || undefined,
          reviewCons: review.cons || undefined,
          reviewDate: review.date,
          storeId,
          ownerId: store.owner_id,
          reviewId,
        });

        // Create complaint in DB (status = 'draft')
        const savedComplaint = await createComplaint({
          review_id: reviewId,
          store_id: storeId,
          owner_id: store.owner_id,
          product_id: review.product_id,
          complaint_text: aiResult.complaintText,
          reason_id: aiResult.reasonId,
          reason_name: aiResult.reasonName,
          review_rating: review.rating,
          review_text: review.text || '',
          review_date: review.date,
          product_name: productName,
          product_vendor_code: productVendorCode,
          product_is_active: product?.is_active !== false,
          ai_model: 'deepseek-chat',
          ai_prompt_tokens: aiResult.promptTokens,
          ai_completion_tokens: aiResult.completionTokens,
          ai_total_tokens: aiResult.totalTokens,
          ai_cost_usd: aiResult.costUsd,
          generation_duration_ms: aiResult.durationMs,
        });

        generated.push({
          review_id: reviewId,
          complaint_text: aiResult.complaintText,
          reason_id: aiResult.reasonId,
          reason_name: aiResult.reasonName,
          cost_usd: aiResult.costUsd
        });

        console.log(`[Extension API] Generated complaint for review ${reviewId}`);

      } catch (error: any) {
        console.error(`[Extension API] Error generating complaint for review ${reviewId}:`, error);
        failed.push({
          review_id: reviewId,
          error: error.message || 'Unknown error'
        });
      }
    }

    console.log(`[Extension API] Batch complete: ${generated.length} generated, ${failed.length} failed`);

    return NextResponse.json({
      success: true,
      generated,
      failed
    });

  } catch (error: any) {
    console.error('[Extension API] Error generating complaints batch:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
