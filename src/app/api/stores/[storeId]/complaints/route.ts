import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';
import { getComplaintsByStore } from '@/db/complaint-helpers';
import { query } from '@/db/client';
import { verifyApiToken, hasStoreAccess } from '@/lib/api-auth';
import { rateLimiter } from '@/lib/rate-limiter';

/**
 * @swagger
 * /api/stores/{storeId}/complaints:
 *   get:
 *     summary: Get complaints for Chrome Extension
 *     description: Returns list of complaints ready for submission on WB
 *     tags:
 *       - Extension API
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
 *         description: Store ID
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of records to skip (pagination)
 *       - in: query
 *         name: take
 *         schema:
 *           type: integer
 *           default: 100
 *           maximum: 200
 *         description: Number of records to return (max 200)
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       '200':
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *       '400':
 *         description: Invalid parameters
 *       '401':
 *         description: Unauthorized
 *       '403':
 *         description: Forbidden - token doesn't have access to this store
 *       '404':
 *         description: Store not found
 *       '429':
 *         description: Rate limit exceeded
 *       '500':
 *         description: Internal server error
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { storeId: string } }
) {
  const { storeId } = params;
  const { searchParams } = new URL(request.url);

  // Authentication - verify Bearer token
  const authHeader = request.headers.get('authorization');
  const apiToken = await verifyApiToken(authHeader);

  if (!apiToken) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        message: 'Invalid or missing API token',
        code: 'INVALID_TOKEN',
      },
      { status: 401 }
    );
  }

  // Verify store access
  if (!hasStoreAccess(apiToken, storeId)) {
    return NextResponse.json(
      {
        error: 'Forbidden',
        message: 'Token does not have access to this store',
        code: 'STORE_ACCESS_DENIED',
      },
      { status: 403 }
    );
  }

  // Rate limiting - 100 requests per minute per token
  const rateLimitKey = `api_token_${apiToken.id}`;
  const rateLimit = rateLimiter.check(rateLimitKey);

  if (!rateLimit.allowed) {
    const resetDate = new Date(rateLimit.resetAt).toISOString();
    return NextResponse.json(
      {
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Maximum 100 requests per minute.',
        code: 'RATE_LIMIT_EXCEEDED',
        resetAt: resetDate,
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': '100',
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': resetDate,
          'Retry-After': Math.ceil((rateLimit.resetAt - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  // Parse pagination parameters
  const skip = parseInt(searchParams.get('skip') || '0', 10);
  const take = Math.min(parseInt(searchParams.get('take') || '100', 10), 200); // Max 200

  // Validate parameters
  if (isNaN(skip) || skip < 0) {
    return NextResponse.json(
      {
        error: 'Bad Request',
        message: 'Invalid skip parameter',
        code: 'INVALID_PARAMS',
      },
      { status: 400 }
    );
  }

  if (isNaN(take) || take < 1 || take > 200) {
    return NextResponse.json(
      {
        error: 'Bad Request',
        message: 'Invalid take parameter (must be 1-200)',
        code: 'INVALID_PARAMS',
      },
      { status: 400 }
    );
  }

  try {
    // Check if store exists
    const store = await dbHelpers.getStoreById(storeId);
    if (!store) {
      return NextResponse.json(
        {
          error: 'Not Found',
          message: 'Store not found',
          code: 'STORE_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    // Get complaints with reviews data (JOIN to get review details)
    const result = await query<{
      id: string;
      review_id: string;
      product_id: string;
      complaint_text: string;
      reason_id: number;
      reason_name: string;
      status: string;
      regenerated_count: number;
      last_regenerated_at: string | null;
      generated_at: string;
      // Review fields
      wb_product_id: string;
      rating: number;
      review_date: string;
      review_text: string | null;
      author: string | null;
    }>(
      `SELECT
        rc.id,
        rc.review_id,
        rc.product_id,
        rc.complaint_text,
        rc.reason_id,
        rc.reason_name,
        rc.status,
        rc.regenerated_count,
        rc.last_regenerated_at,
        rc.generated_at,
        -- Review data
        p.wb_product_id,
        r.rating,
        r.date as review_date,
        r.text as review_text,
        r.author
      FROM review_complaints rc
      INNER JOIN reviews r ON r.id = rc.review_id
      INNER JOIN products p ON p.id = rc.product_id
      WHERE rc.store_id = $1
        AND rc.status IN ('draft', 'pending')
      ORDER BY rc.generated_at DESC
      LIMIT $2 OFFSET $3`,
      [storeId, take, skip]
    );

    // Format response for Chrome Extension
    // Extension expects specific format with reviewDate, productId, complaintText wrapped in markdown
    const complaints = result.rows.map((row) => {
      // Format complaintText as markdown code block with JSON
      const complaintData = {
        reasonId: row.reason_id.toString(),
        reasonName: row.reason_name,
        complaintText: row.complaint_text,
      };
      const formattedComplaintText = '```json\n' + JSON.stringify(complaintData) + '\n```';

      return {
        id: row.review_id, // Extension uses review_id as primary identifier
        productId: row.wb_product_id, // WB артикул (nmId)
        rating: row.rating,
        reviewDate: row.review_date, // ISO 8601 format
        reviewText: row.review_text || '',
        authorName: row.author || '',
        createdAt: row.generated_at,
        complaintText: formattedComplaintText, // Formatted for Extension
        status: row.status,
        attempts: row.regenerated_count,
        lastAttemptAt: row.last_regenerated_at,
      };
    });

    return NextResponse.json(complaints, {
      status: 200,
      headers: {
        'X-RateLimit-Limit': '100',
        'X-RateLimit-Remaining': rateLimit.remaining.toString(),
        'X-RateLimit-Reset': new Date(rateLimit.resetAt).toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Failed to fetch complaints via API:', error.message, error.stack);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error.message,
        code: 'DB_ERROR',
      },
      { status: 500 }
    );
  }
}
