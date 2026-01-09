import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';
import { verifyApiKey } from '@/lib/server-utils';

/**
 * @swagger
 * /api/stores/reviews/update-all:
 *   post:
 *     summary: Массовая синхронизация отзывов для всех магазинов
 *     description: |
 *       Запускает синхронизацию отзывов для всех магазинов в системе.
 *       Каждый магазин синхронизируется последовательно.
 *       Этот эндпоинт критически важен для первоначальной загрузки данных после миграции с Firebase.
 *     tags:
 *       - Отзывы
 *     parameters:
 *       - in: query
 *         name: mode
 *         schema:
 *           type: string
 *           enum: [incremental, full]
 *           default: full
 *         description: Режим синхронизации для каждого магазина
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       '200':
 *         description: Успешный ответ с результатами синхронизации
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Синхронизация завершена: 10 магазинов обработано, 10 успешно, 0 ошибок."
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       storeId:
 *                         type: string
 *                       storeName:
 *                         type: string
 *                       status:
 *                         type: string
 *                         enum: [success, error]
 *                       message:
 *                         type: string
 *       '401':
 *         description: Ошибка авторизации
 *       '500':
 *         description: Внутренняя ошибка сервера
 */
export async function POST(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') === 'incremental' ? 'incremental' : 'full';

    try {
        // Verify API key
        const authResult = await verifyApiKey(request);
        if (!authResult.authorized) {
            return NextResponse.json({ error: authResult.error }, { status: 401 });
        }

        console.log(`[API MASS SYNC] Starting mass review sync in mode: ${mode}`);

        // Get all stores
        const stores = await dbHelpers.getStores();

        if (stores.length === 0) {
            return NextResponse.json({
                message: 'No stores found.',
                results: []
            }, { status: 200 });
        }

        console.log(`[API MASS SYNC] Found ${stores.length} stores to sync.`);

        const results: Array<{
            storeId: string;
            storeName: string;
            status: 'success' | 'error';
            message: string;
        }> = [];

        let successCount = 0;
        let errorCount = 0;

        // Sync each store sequentially
        for (const store of stores) {
            console.log(`[API MASS SYNC] Processing store ${store.id} (${store.name})...`);

            try {
                // Call the individual store sync endpoint internally
                const syncUrl = new URL(`/api/stores/${store.id}/reviews/update?mode=${mode}`, request.url);
                const syncResponse = await fetch(syncUrl.toString(), {
                    method: 'POST',
                    headers: {
                        'Authorization': request.headers.get('Authorization') || '',
                    }
                });

                const syncData = await syncResponse.json();

                if (syncResponse.ok) {
                    results.push({
                        storeId: store.id,
                        storeName: store.name,
                        status: 'success',
                        message: syncData.message || 'Success'
                    });
                    successCount++;
                    console.log(`[API MASS SYNC] ✓ Store ${store.id} synced successfully.`);
                } else {
                    results.push({
                        storeId: store.id,
                        storeName: store.name,
                        status: 'error',
                        message: syncData.error || syncData.details || 'Unknown error'
                    });
                    errorCount++;
                    console.error(`[API MASS SYNC] ✗ Store ${store.id} failed: ${syncData.error}`);
                }

            } catch (error: any) {
                results.push({
                    storeId: store.id,
                    storeName: store.name,
                    status: 'error',
                    message: error.message || 'Unknown error'
                });
                errorCount++;
                console.error(`[API MASS SYNC] ✗ Store ${store.id} error:`, error);
            }

            // Small delay between stores to avoid overloading WB API
            await new Promise(res => setTimeout(res, 1000));
        }

        const summary = `Синхронизация завершена: ${stores.length} магазинов обработано, ${successCount} успешно, ${errorCount} ошибок.`;
        console.log(`[API MASS SYNC] ${summary}`);

        return NextResponse.json({
            message: summary,
            results
        }, { status: 200 });

    } catch (error: any) {
        console.error('[API ERROR] /api/stores/reviews/update-all:', error);
        return NextResponse.json({
            error: 'Internal Server Error',
            details: String(error.message || 'An unknown error occurred.')
        }, { status: 500 });
    }
}
