/**
 * OZON Product Synchronization
 *
 * Fetches all products from OZON Seller API and upserts them into the products table.
 * Called from /api/stores/[storeId]/products/update when store.marketplace === 'ozon'.
 */

import * as dbHelpers from '@/db/helpers';
import { createOzonClient } from '@/lib/ozon-api';
import type { OzonProductInfo } from '@/lib/ozon-api';

/**
 * Sync all products for an OZON store.
 * Handles pagination, batching, and description fetching.
 *
 * @returns Human-readable result message
 */
export async function refreshOzonProducts(storeId: string): Promise<string> {
  console.log(`[OZON-SYNC] Starting product sync for store ${storeId}`);

  // Update status to pending
  await dbHelpers.updateStore(storeId, {
    last_product_update_status: 'pending',
    last_product_update_date: new Date().toISOString(),
  });

  try {
    const store = await dbHelpers.getStoreById(storeId);
    if (!store) throw new Error(`Store ${storeId} not found.`);

    if (store.marketplace !== 'ozon') {
      throw new Error(`Store ${storeId} is not an OZON store (marketplace=${store.marketplace})`);
    }

    if (!store.ozon_client_id || !store.ozon_api_key) {
      throw new Error(`OZON credentials missing for store ${storeId}`);
    }

    const client = createOzonClient(store.ozon_client_id, store.ozon_api_key);

    // Step 1: Get all products with full info (handles pagination + batching internally)
    console.log(`[OZON-SYNC] Fetching all products with info...`);
    const products = await client.getAllProductsWithInfo();
    console.log(`[OZON-SYNC] Fetched ${products.length} products from OZON`);

    // Step 2: Fetch descriptions (one by one — OZON API limitation)
    const descriptions = new Map<number, string>();
    for (const product of products) {
      try {
        const desc = await client.getProductDescription(product.id);
        if (desc.description) {
          descriptions.set(product.id, desc.description);
        }
      } catch (err) {
        // Non-critical — continue without description
        console.warn(`[OZON-SYNC] Failed to get description for product ${product.id}`);
      }
    }

    console.log(`[OZON-SYNC] Fetched ${descriptions.size} descriptions`);

    // Step 3: Upsert each product into DB
    let upsertCount = 0;
    for (const product of products) {
      const productId = `${storeId}_ozon_${product.id}`;

      // Extract primary SKU (FBO = source "sds")
      const fboSource = product.sources?.find((s) => s.source === 'sds');
      const fbsSource = product.sources?.find((s) => s.source === 'fbs');

      const payload: Omit<dbHelpers.Product, 'created_at' | 'updated_at'> = {
        id: productId,
        name: product.name || `OZON Product ${product.id}`,
        marketplace: 'ozon',
        wb_product_id: String(product.id), // Using ozon product_id as the linking field
        vendor_code: product.offer_id || '',
        price: product.price ? parseFloat(product.price) : null,
        image_url: product.primary_image || product.images?.[0] || null,
        description: descriptions.get(product.id) || null,
        ozon_product_id: product.id,
        ozon_offer_id: product.offer_id || null,
        ozon_sku: fboSource ? String(fboSource.sku) : null,
        ozon_fbs_sku: fbsSource ? String(fbsSource.sku) : null,
        store_id: storeId,
        owner_id: store.owner_id,
        review_count: 0,
        wb_api_data: null,
        is_active: true,
      };

      await dbHelpers.upsertProduct(payload);
      upsertCount++;
    }

    console.log(`[OZON-SYNC] Upserted ${upsertCount} products`);

    // Update store with success status
    await dbHelpers.updateStore(storeId, {
      last_product_update_status: 'success',
      last_product_update_date: new Date().toISOString(),
    });

    const message = `Успешно обновлено ${upsertCount} товаров OZON.`;
    console.log(`[OZON-SYNC] ${message}`);
    return message;
  } catch (error: any) {
    console.error(`[OZON-SYNC] ERROR for store ${storeId}:`, error);

    await dbHelpers.updateStore(storeId, {
      last_product_update_status: 'error',
      last_product_update_error: error.message || 'Unknown error',
    });

    throw error;
  }
}
