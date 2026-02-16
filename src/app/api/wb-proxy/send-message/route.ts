
'use server';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';
import { createOzonClient } from '@/lib/ozon-api';


export async function POST(request: NextRequest) {
    try {
        const { storeId, replySign, message, id } = await request.json();

        if (!storeId || !message) {
             return NextResponse.json({ error: 'storeId and message are required' }, { status: 400 });
        }

        const store = await dbHelpers.getStoreById(storeId);

        if (!store) {
            return NextResponse.json({ error: 'Store not found.' }, { status: 404 });
        }

        // OZON stores: use OZON Chat API
        if (store.marketplace === 'ozon') {
            if (!store.ozon_client_id || !store.ozon_api_key) {
                return NextResponse.json({ error: 'OZON credentials not configured.' }, { status: 400 });
            }
            const chatId = id || replySign; // OZON uses chat UUID as ID
            if (!chatId) {
                return NextResponse.json({ error: 'id (chatId) is required for OZON' }, { status: 400 });
            }
            const client = createOzonClient(store.ozon_client_id, store.ozon_api_key);
            const result = await client.sendChatMessage(chatId, message);
            return NextResponse.json(result);
        }

        // WB stores: use WB Chat API
        if (!(replySign || id)) {
            return NextResponse.json({ error: 'replySign or id is required for WB' }, { status: 400 });
        }

        const wbToken = store.chat_api_token || store.api_token;

        if (!wbToken) {
            return NextResponse.json({ error: 'Chat API token not configured for this store.' }, { status: 400 });
        }

        const formData = new FormData();
        formData.append('replySign', replySign);
        formData.append('message', message);

        const response = await fetch('https://buyer-chat-api.wildberries.ru/api/v1/seller/message', {
            method: 'POST',
            headers: {
                'Authorization': wbToken,
            },
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: `Ошибка API WB: ${response.status}` } }));
            const errorMessage = errorData.error?.message || errorData?.message || `Ошибка API WB: ${response.status}`;
            console.error(`[PROXY ERROR] send-message failed for store ${storeId}:`, errorMessage);
            return NextResponse.json({ error: errorMessage }, { status: response.status });
        }

        const responseData = await response.json().catch(() => ({}));
        return NextResponse.json(responseData);

    } catch (error: any) {
        console.error("[PROXY CATCH] Failed to proxy send message request:", error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}
