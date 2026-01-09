import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';

/**
 * PATCH /api/stores/{storeId}/products/{productId}/status
 * Update product work status
 *
 * Request body:
 * {
 *   "work_status": "not_working" | "active" | "paused" | "completed"
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { storeId: string; productId: string } }
) {
  const { productId } = params;

  try {
    const body = await request.json();
    const { work_status } = body;

    // Validate work_status
    const validStatuses: dbHelpers.WorkStatus[] = ['not_working', 'active', 'paused', 'completed'];
    if (!work_status || !validStatuses.includes(work_status)) {
      return NextResponse.json({
        error: 'Invalid work_status',
        details: `work_status must be one of: ${validStatuses.join(', ')}`
      }, { status: 400 });
    }

    // Update product work status
    const updatedProduct = await dbHelpers.updateProductWorkStatus(productId, work_status);

    if (!updatedProduct) {
      return NextResponse.json({
        error: 'Product not found',
        details: `Product with ID ${productId} not found`
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      product: {
        id: updatedProduct.id,
        name: updatedProduct.name,
        work_status: updatedProduct.work_status,
        updated_at: updatedProduct.updated_at,
      }
    }, { status: 200 });

  } catch (error: any) {
    console.error("Failed to update product status:", error.message, error.stack);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
