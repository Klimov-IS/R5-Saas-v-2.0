/**
 * GET /api/extension/stores/[storeId]/active-products
 *
 * Returns active products with their rules for the Chrome extension workflow
 * Used by extension to know which products to process
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/db/client';
import { getUserByApiToken } from '@/db/extension-helpers';

interface Product {
  id: string;
  wb_product_id: string;
  vendor_code: string;
  name: string;
  work_status: string;
  rules: {
    submit_complaints: boolean;
    complaint_rating_1: boolean;
    complaint_rating_2: boolean;
    complaint_rating_3: boolean;
    complaint_rating_4: boolean;
    work_in_chats: boolean;
    chat_strategy: string | null;
  } | null;
}

export async function GET(
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

    // 2. Verify store access
    const storeResult = await query(
      'SELECT id, owner_id FROM stores WHERE id = $1',
      [storeId]
    );

    if (!storeResult.rows[0]) {
      return NextResponse.json(
        { error: 'Not found', message: `Store ${storeId} not found` },
        { status: 404 }
      );
    }

    if (storeResult.rows[0].owner_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'You do not have access to this store' },
        { status: 403 }
      );
    }

    // 3. Get active products with rules
    const result = await query<Product>(
      `
      SELECT
        p.id,
        p.wb_product_id,
        p.vendor_code,
        p.name,
        p.work_status,
        jsonb_build_object(
          'submit_complaints', COALESCE(pr.submit_complaints, false),
          'complaint_rating_1', COALESCE(pr.complaint_rating_1, false),
          'complaint_rating_2', COALESCE(pr.complaint_rating_2, false),
          'complaint_rating_3', COALESCE(pr.complaint_rating_3, false),
          'complaint_rating_4', COALESCE(pr.complaint_rating_4, false),
          'work_in_chats', COALESCE(pr.work_in_chats, false),
          'chat_strategy', pr.chat_strategy
        ) as rules
      FROM products p
      LEFT JOIN product_rules pr ON pr.product_id = p.id
      WHERE p.store_id = $1
        AND p.work_status = 'active'
      ORDER BY p.name ASC
      `,
      [storeId]
    );

    console.log(`[Extension API] Active products for store ${storeId}: ${result.rows.length}`);

    return NextResponse.json({
      products: result.rows.map(row => ({
        id: row.id,
        wb_product_id: row.wb_product_id,
        vendor_code: row.vendor_code,
        name: row.name,
        work_status: row.work_status,
        rules: row.rules || {
          submit_complaints: false,
          complaint_rating_1: false,
          complaint_rating_2: false,
          complaint_rating_3: false,
          complaint_rating_4: false,
          work_in_chats: false,
          chat_strategy: null
        }
      }))
    });

  } catch (error: any) {
    console.error('[Extension API] Error fetching active products:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
