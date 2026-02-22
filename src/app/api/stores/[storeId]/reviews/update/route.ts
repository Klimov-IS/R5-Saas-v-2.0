import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';
import { verifyApiKey } from '@/lib/server-utils';
import { refreshReviewsForStore } from '@/lib/review-sync';

/**
 * @swagger
 * /api/stores/{storeId}/reviews/update:
 *   post:
 *     summary: Запустить обновление отзывов для магазина
 *     description: |
 *       Синхронизирует отзывы из WB Feedbacks API в PostgreSQL.
 *       Поддерживает два режима:
 *       - `incremental`: Только новые отзывы с момента последней синхронизации
 *       - `full`: Полная синхронизация ВСЕХ отзывов (обход лимита 20k через date chunking)
 *
 *       **Адаптивная стратегия полной синхронизации:**
 *       - Начинает с больших 90-дневных chunks (с 2020-01-01 до сегодня)
 *       - Если chunk содержит ≥19k отзывов → автоматически разбивает на 3 меньших chunk
 *       - Минимальный размер chunk: 7 дней (не разбивается дальше)
 *       - Позволяет получить магазины с 1M+ отзывами эффективно
 *     tags:
 *       - Отзывы
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID магазина
 *       - in: query
 *         name: mode
 *         schema:
 *           type: string
 *           enum: [incremental, full]
 *           default: incremental
 *         description: |
 *           Режим обновления:
 *           - `incremental`: Только новые отзывы (быстро)
 *           - `full`: Все отзывы через date chunking (медленно, для первичной загрузки)
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
 *                   example: "Успешно обновлено 150000 отзывов (всего в БД: 1000000)."
 *       '401':
 *         description: Ошибка авторизации.
 *       '404':
 *         description: Магазин не найден.
 *       '500':
 *         description: Внутренняя ошибка сервера.
 */
export async function POST(request: NextRequest, { params }: { params: { storeId: string } }) {
    const { storeId } = params;
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') === 'full' ? 'full' : 'incremental';

    // Optional date range for rolling full sync (unix timestamps in seconds)
    const dateFromParam = searchParams.get('dateFrom');
    const dateToParam = searchParams.get('dateTo');
    const dateRange = (dateFromParam && dateToParam)
        ? { from: new Date(parseInt(dateFromParam) * 1000), to: new Date(parseInt(dateToParam) * 1000) }
        : undefined;

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

        // Run sync
        const message = await refreshReviewsForStore(storeId, mode, dateRange);

        return NextResponse.json({
            message: message || `Процесс обновления отзывов для магазина ${storeId} в режиме '${mode}' успешно завершен.`
        }, { status: 200 });

    } catch (error: any) {
        console.error(`[API ERROR] /api/stores/${storeId}/reviews/update:`, error);
        return NextResponse.json({
            error: 'Internal Server Error',
            details: String(error.message || 'An unknown error occurred in the API route.')
        }, { status: 500 });
    }
}
