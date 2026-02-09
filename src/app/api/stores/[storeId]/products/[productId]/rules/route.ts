import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';
import { triggerAsyncSync } from '@/services/google-sheets-sync';

/**
 * PUT /api/stores/{storeId}/products/{productId}/rules
 * Create or update product rules
 *
 * Request body:
 * {
 *   "submit_complaints": boolean,
 *   "complaint_rating_1": boolean,
 *   "complaint_rating_2": boolean,
 *   "complaint_rating_3": boolean,
 *   "complaint_rating_4": boolean,
 *   "work_in_chats": boolean,
 *   "chat_rating_1": boolean,
 *   "chat_rating_2": boolean,
 *   "chat_rating_3": boolean,
 *   "chat_rating_4": boolean,
 *   "chat_strategy": "upgrade_to_5" | "delete" | "both",
 *   "offer_compensation": boolean,
 *   "max_compensation": string,
 *   "compensation_type": string,
 *   "compensation_by": string
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { storeId: string; productId: string } }
) {
  const { storeId, productId } = params;

  try {
    const body = await request.json();

    // Validate product exists
    const product = await dbHelpers.getProductById(productId);
    if (!product) {
      return NextResponse.json({
        error: 'Product not found',
        details: `Product with ID ${productId} not found`
      }, { status: 404 });
    }

    // Validate chat_strategy if provided
    if (body.chat_strategy) {
      const validStrategies: dbHelpers.ChatStrategy[] = ['upgrade_to_5', 'delete', 'both'];
      if (!validStrategies.includes(body.chat_strategy)) {
        return NextResponse.json({
          error: 'Invalid chat_strategy',
          details: `chat_strategy must be one of: ${validStrategies.join(', ')}`
        }, { status: 400 });
      }
    }

    // Prepare rules data
    const ruleData: Omit<dbHelpers.ProductRule, 'id' | 'created_at' | 'updated_at'> = {
      product_id: productId,
      store_id: storeId,

      // Жалобы
      submit_complaints: body.submit_complaints ?? false,
      complaint_rating_1: body.complaint_rating_1 ?? false,
      complaint_rating_2: body.complaint_rating_2 ?? false,
      complaint_rating_3: body.complaint_rating_3 ?? false,
      complaint_rating_4: body.complaint_rating_4 ?? false,

      // Чаты
      work_in_chats: body.work_in_chats ?? false,
      chat_rating_1: body.chat_rating_1 ?? false,
      chat_rating_2: body.chat_rating_2 ?? false,
      chat_rating_3: body.chat_rating_3 ?? false,
      chat_rating_4: body.chat_rating_4 ?? false,
      chat_strategy: body.chat_strategy ?? 'both',

      // Компенсация
      offer_compensation: body.offer_compensation ?? false,
      max_compensation: body.max_compensation ?? null,
      compensation_type: body.compensation_type ?? null,
      compensation_by: body.compensation_by ?? null,
    };

    // Create or update rules
    const updatedRules = await dbHelpers.upsertProductRule(ruleData);

    // Trigger Google Sheets sync (async, non-blocking)
    triggerAsyncSync();

    return NextResponse.json({
      success: true,
      rules: updatedRules
    }, { status: 200 });

  } catch (error: any) {
    console.error("Failed to update product rules:", error.message, error.stack);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * GET /api/stores/{storeId}/products/{productId}/rules
 * Get product rules
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { storeId: string; productId: string } }
) {
  const { productId } = params;

  try {
    const rules = await dbHelpers.getProductRule(productId);

    if (!rules) {
      return NextResponse.json({
        error: 'Rules not found',
        details: `No rules found for product ${productId}`
      }, { status: 404 });
    }

    return NextResponse.json(rules, { status: 200 });

  } catch (error: any) {
    console.error("Failed to fetch product rules:", error.message, error.stack);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

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

    // Trigger Google Sheets sync (async, non-blocking)
    triggerAsyncSync();

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
