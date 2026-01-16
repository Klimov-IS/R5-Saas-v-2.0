import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';
import { verifyApiKey } from '@/lib/server-utils';

/**
 * @swagger
 * /api/settings/deepseek-key:
 *   post:
 *     summary: Сохранить API ключ Deepseek
 *     description: Сохраняет API ключ Deepseek для текущего пользователя в базу данных
 *     tags:
 *       - Настройки
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - apiKey
 *             properties:
 *               apiKey:
 *                 type: string
 *                 description: API ключ от Deepseek
 *     responses:
 *       '200':
 *         description: Успешно сохранено
 *       '400':
 *         description: Неверный формат запроса
 *       '401':
 *         description: Ошибка авторизации
 *       '500':
 *         description: Внутренняя ошибка сервера
 *   get:
 *     summary: Получить информацию о наличии API ключа Deepseek
 *     description: Возвращает информацию о том, сохранен ли API ключ (НЕ возвращает сам ключ!)
 *     tags:
 *       - Настройки
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
 *                 hasKey:
 *                   type: boolean
 *                   description: Указывает, сохранен ли API ключ
 *       '401':
 *         description: Ошибка авторизации
 *       '500':
 *         description: Внутренняя ошибка сервера
 */

/**
 * POST - Save Deepseek API key to database
 */
export async function POST(request: NextRequest) {
    try {
        // Verify API key
        const authResult = await verifyApiKey(request);
        if (!authResult.authorized) {
            return NextResponse.json({ error: authResult.error }, { status: 401 });
        }

        const body = await request.json();
        const { apiKey } = body;

        if (!apiKey || typeof apiKey !== 'string') {
            return NextResponse.json(
                { error: 'API ключ обязателен и должен быть строкой' },
                { status: 400 }
            );
        }

        // Validate format (Deepseek keys start with 'sk-')
        if (!apiKey.startsWith('sk-')) {
            return NextResponse.json(
                { error: 'Неверный формат API ключа. Ключи Deepseek начинаются с "sk-"' },
                { status: 400 }
            );
        }

        // Get current user settings
        const settings = await dbHelpers.getUserSettings();

        if (!settings) {
            return NextResponse.json(
                { error: 'Настройки пользователя не найдены' },
                { status: 404 }
            );
        }

        // Update settings with new API key
        await dbHelpers.updateUserSettings(settings.id, {
            deepseek_api_key: apiKey,
        });

        return NextResponse.json({
            message: 'API ключ Deepseek успешно сохранен',
        }, { status: 200 });

    } catch (error: any) {
        console.error('[API ERROR] /api/settings/deepseek-key POST:', error);
        return NextResponse.json({
            error: 'Internal Server Error',
            details: String(error.message || 'An unknown error occurred')
        }, { status: 500 });
    }
}

/**
 * GET - Check if Deepseek API key exists (doesn't return the key itself)
 */
export async function GET(request: NextRequest) {
    try {
        // Verify API key
        const authResult = await verifyApiKey(request);
        if (!authResult.authorized) {
            return NextResponse.json({ error: authResult.error }, { status: 401 });
        }

        // Get current user settings
        const settings = await dbHelpers.getUserSettings();

        if (!settings) {
            return NextResponse.json({ hasKey: false }, { status: 200 });
        }

        // Check if key exists (don't return the actual key for security)
        const hasKey = !!(settings.deepseek_api_key && settings.deepseek_api_key.length > 0);

        return NextResponse.json({
            hasKey,
        }, { status: 200 });

    } catch (error: any) {
        console.error('[API ERROR] /api/settings/deepseek-key GET:', error);
        return NextResponse.json({
            error: 'Internal Server Error',
            details: String(error.message || 'An unknown error occurred')
        }, { status: 500 });
    }
}
