
'use server';

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';


export async function POST(request: NextRequest) {
    try {
        const { storeId, replySign, message, id } = await request.json();

        if (!storeId || !(replySign || id) || !message) {
             return NextResponse.json({ error: 'storeId, (replySign or id), and message are required' }, { status: 400 });
        }

        
        
        
        const store = await dbHelpers.getStoreById(storeId);
        

        if (!store) {
            return NextResponse.json({ error: 'Store not found.' }, { status: 404 });
        }
        
        const wbToken = store.chat_api_token || store.api_token;

        if (!wbToken) {
            return NextResponse.json({ error: 'Chat API token not configured for this store.' }, { status: 400 });
        }
        
        // Correct WB API expects a form data body for this endpoint.
        const formData = new FormData();
        formData.append('replySign', replySign);
        formData.append('message', message);
        // The WB API endpoint is /seller/message, not /seller/chat/send
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
