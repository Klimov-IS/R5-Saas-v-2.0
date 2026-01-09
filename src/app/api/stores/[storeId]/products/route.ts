import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';

/**
 * GET /api/stores/{storeId}/products
 * Returns all products for a store with their rules
 *
 * NEW: Now includes work_status and product_rules
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { storeId: string } }
) {
  const { storeId } = params;

  try {
    // Get all products with their rules
    const productsWithRules = await dbHelpers.getProductsWithRules(storeId);

    // Format response with full data
    const responseData = productsWithRules.map(product => ({
      id: product.id,
      nm_id: parseInt(product.wb_product_id),
      name: product.name,
      vendor_code: product.vendor_code,
      brand: '', // Not in current schema
      store_id: product.store_id,
      price: product.price,
      review_count: product.review_count || 0,
      image_url: product.image_url,
      is_active: product.is_active !== undefined ? product.is_active : true,
      work_status: product.work_status || 'not_working', // NEW: Default to not_working if null
      rules: product.rule, // NEW: Include product rules
      updated_at: product.updated_at,
      created_at: product.created_at,
    }));

    return NextResponse.json(responseData, { status: 200 });

  } catch (error: any) {
    console.error("Failed to fetch products via API:", error.message, error.stack);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
