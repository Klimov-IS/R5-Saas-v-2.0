import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';

/**
 * POST /api/stores/{storeId}/products/{productId}/rules/apply-defaults
 * Apply default rules to a product
 *
 * Default rules:
 * - Жалобы: 1⭐, 2⭐, 3⭐
 * - Чаты: 1⭐, 2⭐, 3⭐, 4⭐ (стратегия: both)
 * - Компенсация: 500₽, кешбек, Р5
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { storeId: string; productId: string } }
) {
  const { storeId, productId } = params;

  try {
    // Validate product exists
    const product = await dbHelpers.getProductById(productId);
    if (!product) {
      return NextResponse.json({
        error: 'Product not found',
        details: `Product with ID ${productId} not found`
      }, { status: 404 });
    }

    // Default rules
    const defaultRules: Omit<dbHelpers.ProductRule, 'id' | 'created_at' | 'updated_at'> = {
      product_id: productId,
      store_id: storeId,

      // Жалобы: 1⭐, 2⭐, 3⭐
      submit_complaints: true,
      complaint_rating_1: true,
      complaint_rating_2: true,
      complaint_rating_3: true,
      complaint_rating_4: false,

      // Чаты: 1⭐, 2⭐, 3⭐, 4⭐ (both)
      work_in_chats: true,
      chat_rating_1: true,
      chat_rating_2: true,
      chat_rating_3: true,
      chat_rating_4: true,
      chat_strategy: 'both',

      // Компенсация: 500₽, кешбек, Р5
      offer_compensation: true,
      max_compensation: '500',
      compensation_type: 'cashback',
      compensation_by: 'r5',
    };

    // Apply default rules
    const updatedRules = await dbHelpers.upsertProductRule(defaultRules);

    return NextResponse.json({
      success: true,
      rules: updatedRules
    }, { status: 200 });

  } catch (error: any) {
    console.error("Failed to apply default rules:", error.message, error.stack);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
