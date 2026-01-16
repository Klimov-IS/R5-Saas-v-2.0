import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';

/**
 * @swagger
 * /api/stores/{storeId}/reviews/stats:
 *   get:
 *     summary: Получить статистику по отзывам
 *     description: Возвращает общее количество отзывов для каждого рейтинга (1-5) независимо от фильтров
 *     tags:
 *       - Отзывы
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
 *         description: Успешный ответ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ratingCounts:
 *                   type: object
 *                   properties:
 *                     1:
 *                       type: number
 *                     2:
 *                       type: number
 *                     3:
 *                       type: number
 *                     4:
 *                       type: number
 *                     5:
 *                       type: number
 *       '401':
 *         description: Ошибка авторизации.
 *       '404':
 *         description: Магазин не найден.
 *       '500':
 *         description: Внутренняя ошибка сервера.
 */
export async function GET(request: NextRequest, { params }: { params: { storeId: string } }) {
  const { storeId } = params;

  try {
    // Get rating statistics using helper function
    // This returns total counts for ALL reviews (ignoring filters)
    const ratingCounts = await dbHelpers.getReviewRatingStats(storeId);

    return NextResponse.json({
      ratingCounts
    }, { status: 200 });

  } catch (error: any) {
    console.error('Failed to fetch review stats:', error.message, error.stack);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
