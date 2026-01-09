import { NextRequest, NextResponse } from 'next/server';
import * as dbHelpers from '@/db/helpers';

/**
 * POST /api/stores/{storeId}/products/bulk-actions
 *
 * Массовые операции над товарами
 *
 * Body:
 * {
 *   action: 'apply_default_rules' | 'apply_custom_rules' | 'update_status' | 'copy_rules',
 *   product_ids: string[],
 *
 *   // Для apply_custom_rules:
 *   rules?: {
 *     submit_complaints: boolean,
 *     complaint_rating_1: boolean,
 *     complaint_rating_2: boolean,
 *     complaint_rating_3: boolean,
 *     complaint_rating_4: boolean,
 *     work_in_chats: boolean,
 *     chat_rating_1: boolean,
 *     chat_rating_2: boolean,
 *     chat_rating_3: boolean,
 *     chat_rating_4: boolean,
 *     chat_strategy: 'upgrade_to_5' | 'delete' | 'both',
 *     offer_compensation: boolean,
 *     max_compensation: string,
 *     compensation_type: 'cashback' | 'refund',
 *     compensation_by: 'r5' | 'seller'
 *   },
 *
 *   // Для update_status:
 *   work_status?: 'not_working' | 'active' | 'paused' | 'completed',
 *
 *   // Для copy_rules:
 *   source_product_id?: string
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { storeId: string } }
) {
  const { storeId } = params;

  try {
    const body = await request.json();
    const { action, product_ids, rules, work_status, source_product_id } = body;

    // Validate action
    const validActions = ['apply_default_rules', 'apply_custom_rules', 'update_status', 'copy_rules'];
    if (!action || !validActions.includes(action)) {
      return NextResponse.json({
        error: 'Invalid action',
        details: `action must be one of: ${validActions.join(', ')}`
      }, { status: 400 });
    }

    // Validate product_ids
    if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
      return NextResponse.json({
        error: 'Invalid product_ids',
        details: 'product_ids must be a non-empty array'
      }, { status: 400 });
    }

    // Limit to reasonable batch size
    if (product_ids.length > 1000) {
      return NextResponse.json({
        error: 'Too many products',
        details: 'Maximum 1000 products per request'
      }, { status: 400 });
    }

    let processed = 0;
    let failed = 0;
    const errors: Array<{ product_id: string; error: string }> = [];

    // Execute action based on type
    switch (action) {
      case 'apply_default_rules': {
        // Default rules per requirements:
        // - Complaints: 1-3★
        // - Chats: 1-4★ (both strategy)
        // - Compensation: 500₽, cashback, r5
        const defaultRules: Omit<dbHelpers.ProductRule, 'id' | 'created_at' | 'updated_at'> = {
          product_id: '', // будет заполнено в цикле
          store_id: storeId,
          submit_complaints: true,
          complaint_rating_1: true,
          complaint_rating_2: true,
          complaint_rating_3: true,
          complaint_rating_4: false,
          work_in_chats: true,
          chat_rating_1: true,
          chat_rating_2: true,
          chat_rating_3: true,
          chat_rating_4: true,
          chat_strategy: 'both',
          offer_compensation: true,
          max_compensation: '500',
          compensation_type: 'cashback',
          compensation_by: 'r5',
        };

        for (const productId of product_ids) {
          try {
            // Verify product exists and belongs to store
            const product = await dbHelpers.getProductById(productId);
            if (!product || product.store_id !== storeId) {
              throw new Error('Product not found or does not belong to this store');
            }

            await dbHelpers.upsertProductRule({
              ...defaultRules,
              product_id: productId
            });
            processed++;
          } catch (error: any) {
            failed++;
            errors.push({ product_id: productId, error: error.message });
          }
        }
        break;
      }

      case 'apply_custom_rules': {
        // Validate rules object
        if (!rules) {
          return NextResponse.json({
            error: 'Missing rules',
            details: 'rules object is required for apply_custom_rules action'
          }, { status: 400 });
        }

        // Validate chat_strategy if provided
        if (rules.chat_strategy) {
          const validStrategies: dbHelpers.ChatStrategy[] = ['upgrade_to_5', 'delete', 'both'];
          if (!validStrategies.includes(rules.chat_strategy)) {
            return NextResponse.json({
              error: 'Invalid chat_strategy',
              details: `chat_strategy must be one of: ${validStrategies.join(', ')}`
            }, { status: 400 });
          }
        }

        const customRules: Omit<dbHelpers.ProductRule, 'id' | 'product_id' | 'created_at' | 'updated_at'> = {
          store_id: storeId,
          submit_complaints: rules.submit_complaints ?? false,
          complaint_rating_1: rules.complaint_rating_1 ?? false,
          complaint_rating_2: rules.complaint_rating_2 ?? false,
          complaint_rating_3: rules.complaint_rating_3 ?? false,
          complaint_rating_4: rules.complaint_rating_4 ?? false,
          work_in_chats: rules.work_in_chats ?? false,
          chat_rating_1: rules.chat_rating_1 ?? false,
          chat_rating_2: rules.chat_rating_2 ?? false,
          chat_rating_3: rules.chat_rating_3 ?? false,
          chat_rating_4: rules.chat_rating_4 ?? false,
          chat_strategy: rules.chat_strategy ?? 'both',
          offer_compensation: rules.offer_compensation ?? false,
          max_compensation: rules.max_compensation ?? null,
          compensation_type: rules.compensation_type ?? null,
          compensation_by: rules.compensation_by ?? null,
        };

        for (const productId of product_ids) {
          try {
            // Verify product exists and belongs to store
            const product = await dbHelpers.getProductById(productId);
            if (!product || product.store_id !== storeId) {
              throw new Error('Product not found or does not belong to this store');
            }

            await dbHelpers.upsertProductRule({
              ...customRules,
              product_id: productId
            });
            processed++;
          } catch (error: any) {
            failed++;
            errors.push({ product_id: productId, error: error.message });
          }
        }
        break;
      }

      case 'update_status': {
        // Validate work_status
        if (!work_status) {
          return NextResponse.json({
            error: 'Missing work_status',
            details: 'work_status is required for update_status action'
          }, { status: 400 });
        }

        const validStatuses: dbHelpers.WorkStatus[] = ['not_working', 'active', 'paused', 'completed'];
        if (!validStatuses.includes(work_status)) {
          return NextResponse.json({
            error: 'Invalid work_status',
            details: `work_status must be one of: ${validStatuses.join(', ')}`
          }, { status: 400 });
        }

        for (const productId of product_ids) {
          try {
            // Verify product exists and belongs to store
            const product = await dbHelpers.getProductById(productId);
            if (!product || product.store_id !== storeId) {
              throw new Error('Product not found or does not belong to this store');
            }

            await dbHelpers.updateProductWorkStatus(productId, work_status);
            processed++;
          } catch (error: any) {
            failed++;
            errors.push({ product_id: productId, error: error.message });
          }
        }
        break;
      }

      case 'copy_rules': {
        // Validate source_product_id
        if (!source_product_id) {
          return NextResponse.json({
            error: 'Missing source_product_id',
            details: 'source_product_id is required for copy_rules action'
          }, { status: 400 });
        }

        // Get source product rules
        const sourceRules = await dbHelpers.getProductRule(source_product_id);
        if (!sourceRules) {
          return NextResponse.json({
            error: 'Source product has no rules',
            details: `Product ${source_product_id} does not have any rules configured`
          }, { status: 404 });
        }

        // Verify source product belongs to same store
        const sourceProduct = await dbHelpers.getProductById(source_product_id);
        if (!sourceProduct || sourceProduct.store_id !== storeId) {
          return NextResponse.json({
            error: 'Invalid source product',
            details: 'Source product not found or does not belong to this store'
          }, { status: 404 });
        }

        // Copy rules to each target product
        for (const productId of product_ids) {
          try {
            // Skip if target is same as source
            if (productId === source_product_id) {
              processed++;
              continue;
            }

            // Verify target product exists and belongs to store
            const product = await dbHelpers.getProductById(productId);
            if (!product || product.store_id !== storeId) {
              throw new Error('Product not found or does not belong to this store');
            }

            // Copy rules (excluding id, product_id, created_at, updated_at)
            await dbHelpers.upsertProductRule({
              product_id: productId,
              store_id: storeId,
              submit_complaints: sourceRules.submit_complaints,
              complaint_rating_1: sourceRules.complaint_rating_1,
              complaint_rating_2: sourceRules.complaint_rating_2,
              complaint_rating_3: sourceRules.complaint_rating_3,
              complaint_rating_4: sourceRules.complaint_rating_4,
              work_in_chats: sourceRules.work_in_chats,
              chat_rating_1: sourceRules.chat_rating_1,
              chat_rating_2: sourceRules.chat_rating_2,
              chat_rating_3: sourceRules.chat_rating_3,
              chat_rating_4: sourceRules.chat_rating_4,
              chat_strategy: sourceRules.chat_strategy,
              offer_compensation: sourceRules.offer_compensation,
              max_compensation: sourceRules.max_compensation,
              compensation_type: sourceRules.compensation_type,
              compensation_by: sourceRules.compensation_by,
            });
            processed++;
          } catch (error: any) {
            failed++;
            errors.push({ product_id: productId, error: error.message });
          }
        }
        break;
      }

      default:
        return NextResponse.json({
          error: 'Unknown action',
          details: `Action ${action} is not implemented`
        }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      action,
      processed,
      failed,
      total: product_ids.length,
      errors: errors.length > 0 ? errors : undefined
    }, { status: 200 });

  } catch (error: any) {
    console.error('[API BULK-ACTIONS] Error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
