import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';
import { triggerStoreOnboarding, isOnboardingConfigured } from '@/services/store-onboarding';

/**
 * @swagger
 * /api/stores:
 *   get:
 *     summary: Получить список магазинов
 *     description: Возвращает список всех магазинов, принадлежащих пользователю, связанному с API-ключом.
 *     tags:
 *       - Магазины
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       '200':
 *         description: Успешный ответ
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     description: ID магазина
 *                   name:
 *                     type: string
 *                     description: Название магазина
 *       '401':
 *         description: Ошибка авторизации.
 *       '500':
 *         description: Внутренняя ошибка сервера.
 */
export async function GET(request: NextRequest) {
    try {
        const authHeader = headers().get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: Missing or invalid authorization header.' }, { status: 401 });
        }

        const apiKey = authHeader.split(' ')[1];
        if (!apiKey) {
            return NextResponse.json({ error: 'Unauthorized: API key is missing.' }, { status: 401 });
        }

        // Verify API key
        const userSettings = await dbHelpers.verifyApiKey(apiKey);
        if (!userSettings) {
            return NextResponse.json({ error: 'Unauthorized: Invalid API key.' }, { status: 401 });
        }

        // Get all stores
        const stores = await dbHelpers.getStores();

        if (stores.length === 0) {
            return NextResponse.json([], {
                status: 200,
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                },
            });
        }

        // Return full store data including statistics
        const storesResponse = stores.map(store => ({
            id: store.id,
            name: store.name,
            status: store.status,
            product_count: typeof store.product_count === 'string'
                ? parseInt(store.product_count, 10) || 0
                : store.product_count || 0,
            total_reviews: store.total_reviews || 0,
            total_chats: store.total_chats || 0,
            chat_tag_counts: store.chat_tag_counts || {},
            created_at: store.created_at,
            updated_at: store.updated_at,
        }));

        return NextResponse.json(storesResponse, {
            status: 200,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
            },
        });

    } catch (error: any) {
        console.error("Failed to fetch stores via API:", error.message, error.stack);
        return NextResponse.json({
            error: 'Internal server error',
            details: error.message
        }, { status: 500 });
    }
}

/**
 * POST /api/stores
 * Create a new store
 */
export async function POST(request: NextRequest) {
    try {
        const authHeader = headers().get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: Missing or invalid authorization header.' }, { status: 401 });
        }

        const apiKey = authHeader.split(' ')[1];
        if (!apiKey) {
            return NextResponse.json({ error: 'Unauthorized: API key is missing.' }, { status: 401 });
        }

        // Verify API key
        const userSettings = await dbHelpers.verifyApiKey(apiKey);
        if (!userSettings) {
            return NextResponse.json({ error: 'Unauthorized: Invalid API key.' }, { status: 401 });
        }

        const body = await request.json();
        const { id, name, apiToken, contentApiToken, feedbacksApiToken, chatApiToken } = body;

        if (!id || !name || !apiToken) {
            return NextResponse.json({
                error: 'Missing required fields: id, name, apiToken'
            }, { status: 400 });
        }

        // Create store
        const newStore = await dbHelpers.createStore({
            id,
            name,
            api_token: apiToken,
            content_api_token: contentApiToken || null,
            feedbacks_api_token: feedbacksApiToken || null,
            chat_api_token: chatApiToken || null,
            owner_id: userSettings.id,
            status: 'active',
            total_reviews: 0,
            total_chats: 0,
        });

        // Trigger Google Drive onboarding (fire-and-forget)
        if (isOnboardingConfigured()) {
            triggerStoreOnboarding(newStore.id, newStore.name);
        }

        return NextResponse.json({ data: newStore }, {
            status: 201,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
            },
        });

    } catch (error: any) {
        console.error("Failed to create store via API:", error.message, error.stack);
        return NextResponse.json({
            error: 'Internal server error',
            details: error.message
        }, { status: 500 });
    }
}
