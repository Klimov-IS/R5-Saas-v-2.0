import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';
import { verifyApiKey } from '@/lib/server-utils';
import { refreshOzonProducts } from '@/lib/ozon-product-sync';

/**
 * Refresh products for a store from WB Content API
 */
async function refreshProductsForStore(storeId: string) {
    console.log(`[API PRODUCTS] Starting refresh for store ${storeId}`);

    // Update status to 'pending'
    await dbHelpers.updateStore(storeId, {
        last_product_update_status: 'pending',
        last_product_update_date: new Date().toISOString()
    });

    try {
        // Get store
        const store = await dbHelpers.getStoreById(storeId);
        if (!store) throw new Error(`Store ${storeId} not found.`);

        // Get WB token
        const wbToken = store.content_api_token || store.api_token;
        if (!wbToken) throw new Error('Content API token not found.');

        let totalFetchedProducts = 0;
        let cursor = null;
        let hasMore = true;
        let iteration = 0;
        const MAX_ITERATIONS = 50; // Protection against infinite loop (50 * 100 = 5000 products max)

        console.log(`[API PRODUCTS] Fetching products for store ${storeId}...`);

        // Fetch products with cursor pagination
        while (hasMore && iteration < MAX_ITERATIONS) {
            iteration++;
            const requestBody: any = {
                settings: {
                    cursor: {
                        limit: 100,
                        ...(cursor ? { updatedAt: cursor.updatedAt, nmID: cursor.nmID } : {})
                    },
                    filter: {
                        withPhoto: -1  // -1 = все товары (с фото и без)
                    }
                }
            };

            const response = await fetch('https://content-api.wildberries.ru/content/v2/get/cards/list', {
                method: 'POST',
                headers: {
                    'Authorization': wbToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[API PRODUCTS] WB API error: ${response.status} ${errorText}`);
                throw new Error(`Ошибка API товаров WB: ${response.status}`);
            }

            const result = await response.json();
            const cards = result?.cards || [];

            console.log(`[API PRODUCTS] Iteration ${iteration}: Fetched ${cards.length} products from WB (total so far: ${totalFetchedProducts + cards.length}).`);
            console.log(`[API PRODUCTS] WB Response cursor:`, result?.cursor);

            if (cards.length > 0) {
                // Process each product
                for (const card of cards) {
                    totalFetchedProducts++;

                    // Extract product data
                    const nmId = card.nmID || card.nmId;
                    const vendorCode = card.vendorCode;
                    const productId = `${storeId}_${nmId}`;

                    // Extract product name from characteristics
                    // WB API v2 doesn't have direct "name" field, need to build from characteristics
                    let productName = '';

                    if (card.characteristics && Array.isArray(card.characteristics)) {
                        // Try to find "Наименование" or "Название" characteristic
                        const nameChar = card.characteristics.find((c: any) =>
                            c.name === 'Наименование' ||
                            c.name === 'Название' ||
                            c.name === 'Предмет'
                        );

                        if (nameChar && nameChar.value) {
                            productName = nameChar.value;
                        }
                    }

                    // Fallback chain: characteristic → object → subjectName → vendorCode
                    if (!productName) {
                        productName = card.object || card.subjectName || vendorCode || `Product ${nmId}`;
                    }

                    // Prepare product payload
                    const payload: Omit<dbHelpers.Product, 'created_at' | 'updated_at'> = {
                        id: productId,
                        name: productName,
                        marketplace: 'wb',
                        wb_product_id: String(nmId),
                        vendor_code: vendorCode || '',
                        price: null, // Price not available in this API
                        image_url: card.mediaFiles?.[0] || card.photos?.[0] || null,
                        store_id: storeId,
                        owner_id: store.owner_id,
                        review_count: 0,
                        wb_api_data: JSON.stringify(card), // Store full API response
                        is_active: true,
                    };

                    // Upsert product
                    await dbHelpers.upsertProduct(payload);
                }
            }

            // Check pagination
            // WB API v2 returns cursor with updatedAt and nmID for next page
            // Continue pagination while we have data AND cursor exists
            const nextCursor = result?.cursor;

            // Continue if:
            // 1. We received some cards (data exists)
            // 2. AND cursor has pagination fields (updatedAt, nmID)
            if (cards.length > 0 && nextCursor && nextCursor.updatedAt && nextCursor.nmID) {
                cursor = {
                    updatedAt: nextCursor.updatedAt,
                    nmID: nextCursor.nmID
                };
                hasMore = true;
                console.log(`[API PRODUCTS] Continuing to next page... (cursor: ${cursor.updatedAt}, nmID: ${cursor.nmID})`);
            } else {
                hasMore = false;
                if (cards.length === 0) {
                    console.log(`[API PRODUCTS] Pagination complete: No more products returned.`);
                } else if (!nextCursor || !nextCursor.updatedAt || !nextCursor.nmID) {
                    console.log(`[API PRODUCTS] Pagination complete: No cursor for next page.`);
                }
            }

            if (hasMore) {
                // Small delay to avoid rate limiting
                await new Promise(res => setTimeout(res, 500));
            }
        }

        console.log(`[API PRODUCTS] Finished fetching. Total: ${totalFetchedProducts}.`);

        // Update store with success status
        await dbHelpers.updateStore(storeId, {
            last_product_update_status: 'success',
            last_product_update_date: new Date().toISOString()
        });

        console.log(`[API PRODUCTS] Successfully updated store ${storeId}.`);
        return `Успешно обновлено ${totalFetchedProducts} товаров.`;

    } catch (error: any) {
        console.error(`[API PRODUCTS] ERROR for store ${storeId}:`, error);

        // Update store with error status
        await dbHelpers.updateStore(storeId, {
            last_product_update_status: 'error',
            last_product_update_error: error.message || 'Unknown error'
        });

        // Re-throw the error
        throw error;
    }
}

/**
 * @swagger
 * /api/stores/{storeId}/products/update:
 *   post:
 *     summary: Запустить обновление товаров для магазина
 *     description: |
 *       Синхронизирует товары из WB Content API в PostgreSQL.
 *       Использует cursor-based пагинацию для получения всех товаров.
 *     tags:
 *       - Товары
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID магазина
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       '200':
 *         description: Успешный ответ.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Успешно обновлено 150 товаров."
 *       '401':
 *         description: Ошибка авторизации.
 *       '404':
 *         description: Магазин не найден.
 *       '500':
 *         description: Внутренняя ошибка сервера.
 */
export async function POST(request: NextRequest, { params }: { params: { storeId: string } }) {
    const { storeId } = params;

    try {
        // Verify API key
        const authResult = await verifyApiKey(request);
        if (!authResult.authorized) {
            return NextResponse.json({ error: authResult.error }, { status: 401 });
        }

        // Check if store exists
        const store = await dbHelpers.getStoreById(storeId);
        if (!store) {
            return NextResponse.json({ error: 'Store not found.' }, { status: 404 });
        }

        // Dispatch to marketplace-specific sync
        let message: string;
        if (store.marketplace === 'ozon') {
            message = await refreshOzonProducts(storeId);
        } else {
            message = await refreshProductsForStore(storeId);
        }

        return NextResponse.json({
            message: message || `Процесс обновления товаров для магазина ${storeId} успешно завершен.`
        }, { status: 200 });

    } catch (error: any) {
        console.error(`[API ERROR] /api/stores/${storeId}/products/update:`, error);
        return NextResponse.json({
            error: 'Internal Server Error',
            details: String(error.message || 'An unknown error occurred in the API route.')
        }, { status: 500 });
    }
}
