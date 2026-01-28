import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';
import { query } from '@/db/client';

/**
 * @swagger
 * /api/stores/{storeId}/reviews/{reviewId}/complaint/sent:
 *   post:
 *     summary: Mark complaint as sent
 *     description: Updates complaint status to 'sent' after successful submission to WB. Idempotent - safe to call multiple times.
 *     tags:
 *       - Extension API
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
 *         description: Store ID
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema:
 *           type: string
 *         description: Review ID
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       '200':
 *         description: Complaint marked as sent successfully (or already sent - idempotent)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Complaint marked as sent"
 *                 data:
 *                   type: object
 *                   properties:
 *                     reviewId:
 *                       type: string
 *                     status:
 *                       type: string
 *                       example: "sent"
 *                     sentAt:
 *                       type: string
 *                       format: date-time
 *       '400':
 *         description: Invalid parameters
 *       '401':
 *         description: Unauthorized
 *       '404':
 *         description: Store or review not found
 *       '500':
 *         description: Internal server error
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { storeId: string; reviewId: string } }
) {
  const { storeId, reviewId } = params;

  try {
    // Validate store exists
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

    // Check if review exists and belongs to this store
    const reviewResult = await query<{
      id: string;
      store_id: string;
      product_id: string;
    }>(
      `SELECT id, store_id, product_id
       FROM reviews
       WHERE id = $1`,
      [reviewId]
    );

    if (reviewResult.rows.length === 0) {
      return NextResponse.json(
        {
          error: 'Not Found',
          message: 'Review not found',
          code: 'REVIEW_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    const review = reviewResult.rows[0];

    // Verify review belongs to the specified store
    if (review.store_id !== storeId) {
      return NextResponse.json(
        {
          error: 'Bad Request',
          message: 'Review does not belong to specified store',
          code: 'STORE_MISMATCH',
        },
        { status: 400 }
      );
    }

    // Check if complaint exists for this review
    const complaintResult = await query<{
      id: string;
      status: string;
      sent_at: string | null;
    }>(
      `SELECT id, status, sent_at
       FROM review_complaints
       WHERE review_id = $1 AND store_id = $2`,
      [reviewId, storeId]
    );

    if (complaintResult.rows.length === 0) {
      return NextResponse.json(
        {
          error: 'Not Found',
          message: 'Complaint not found for this review',
          code: 'COMPLAINT_NOT_FOUND',
        },
        { status: 404 }
      );
    }

    const complaint = complaintResult.rows[0];
    const now = new Date().toISOString();

    // IDEMPOTENT: If already sent, return success with existing data
    if (complaint.status === 'sent') {
      return NextResponse.json(
        {
          success: true,
          message: 'Complaint already marked as sent',
          data: {
            reviewId: reviewId,
            status: 'sent',
            sentAt: complaint.sent_at,
          },
        },
        { status: 200 }
      );
    }

    // Update complaint status to 'sent'
    await query(
      `UPDATE review_complaints
       SET
         status = 'sent',
         sent_at = $1,
         updated_at = $1
       WHERE id = $2`,
      [now, complaint.id]
    );

    // Update denormalized fields in reviews table
    await query(
      `UPDATE reviews
       SET
         has_complaint = true,
         complaint_status = 'sent',
         updated_at = $1
       WHERE id = $2`,
      [now, reviewId]
    );

    // Return success response
    return NextResponse.json(
      {
        success: true,
        message: 'Complaint marked as sent',
        data: {
          reviewId: reviewId,
          status: 'sent',
          sentAt: now,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Failed to mark complaint as sent:', error.message, error.stack);
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
