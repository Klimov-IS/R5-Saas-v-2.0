/**
 * POST /api/extension/stores/[storeId]/reviews/find-by-data
 *
 * Finds a review in the database by matching multiple fields (since WB no longer shows review IDs on page)
 * Returns the real WB review ID and complaint status if found
 *
 * CORS enabled for Chrome Extension development
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db/client';
import { getUserByApiToken } from '@/db/extension-helpers';

interface FindReviewPayload {
  // Support both naming conventions (old API and new parser)
  wb_product_id?: string;
  article?: string;           // New parser sends 'article'
  review_date?: string;       // ISO format: "2026-01-18T12:33:00"
  date?: string;              // New parser sends 'date'
  rating: number;
  review_text_preview?: string; // First 50-100 characters
  text?: string;              // New parser sends 'text'
}

// CORS headers for Chrome Extension
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // In production, restrict to specific origins
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400', // 24 hours
};

/**
 * OPTIONS handler for CORS preflight
 */
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
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
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.substring(7);
    const user = await getUserByApiToken(token);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid token' },
        { status: 401, headers: corsHeaders }
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
        { status: 404, headers: corsHeaders }
      );
    }

    if (storeCheck.rows[0].owner_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You do not have access to this store' },
        { status: 403, headers: corsHeaders }
      );
    }

    // 3. Parse request body - support both naming conventions
    const body: FindReviewPayload = await request.json();

    // Normalize field names (support both old and new naming)
    const productId = body.wb_product_id || body.article;
    const reviewDate = body.review_date || body.date;
    const reviewText = body.review_text_preview || body.text;

    if (!productId || !reviewDate || !body.rating || !reviewText) {
      return NextResponse.json(
        { error: 'Invalid request: article (or wb_product_id), date (or review_date), rating, and text (or review_text_preview) required' },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(`[Extension API] Finding review by data for store ${storeId}:`, {
      product: productId,
      date: reviewDate,
      rating: body.rating,
      textPreview: reviewText.substring(0, 30) + '...'
    });

    // 4. Search for review in database
    // Match by: wb_product_id, rating, date (±2 minutes), and text preview
    const result = await query<{
      review_id: string;
      review_text: string;
      rating: number;
      review_date: Date;
      complaint_id: string | null;
      complaint_text: string | null;
      complaint_status: string | null;
    }>(
      `
      SELECT
        r.id as review_id,
        r.text as review_text,
        r.rating,
        r.date as review_date,
        rc.id as complaint_id,
        rc.complaint_text,
        rc.status as complaint_status
      FROM reviews r
      INNER JOIN products p ON p.id = r.product_id
      LEFT JOIN review_complaints rc ON rc.review_id = r.id
      WHERE r.store_id = $1
        AND p.wb_product_id = $2
        AND r.rating = $3
        AND r.date BETWEEN $4::timestamp - interval '2 minutes'
                      AND $4::timestamp + interval '2 minutes'
        AND LEFT(LOWER(r.text), 50) = LEFT(LOWER($5), 50)
      ORDER BY ABS(EXTRACT(EPOCH FROM (r.date - $4::timestamp))) ASC
      LIMIT 1
      `,
      [storeId, productId, body.rating, reviewDate, reviewText]
    );

    if (result.rows.length === 0) {
      console.log(`[Extension API] Review not found for:`, { productId, reviewDate, rating: body.rating });
      return NextResponse.json(
        {
          found: false,
          message: 'Review not found in database. It may not have been synced yet from WB API.'
        },
        { status: 404, headers: corsHeaders }
      );
    }

    const review = result.rows[0];

    console.log(`[Extension API] ✅ Review found: ${review.review_id}, has_complaint: ${!!review.complaint_id}`);

    // 5. Return review with complaint info (with CORS headers)
    return NextResponse.json({
      found: true,
      data: {
        id: review.review_id,
        rating: review.rating,
        review_date: review.review_date,
        has_complaint: !!review.complaint_id,
        complaint: review.complaint_id ? {
          id: review.complaint_id,
          text: review.complaint_text,
          status: review.complaint_status
        } : null
      }
    }, { headers: corsHeaders });

  } catch (error: any) {
    console.error('[Extension API] Error finding review:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
