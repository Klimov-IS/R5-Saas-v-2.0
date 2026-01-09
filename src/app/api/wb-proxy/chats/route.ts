
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';


async function getAuth(req: NextRequest) {
    const authHeader = headers().get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { error: 'Unauthorized: Missing or invalid authorization header.', status: 401 };
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
        return { error: 'Unauthorized: API key is missing.', status: 401 };
    }
    return { token };
}

export async function POST(request: NextRequest) {
    try {
        const { storeId } = await request.json();
        if (!storeId) {
             return NextResponse.json({ error: 'storeId is required' }, { status: 400 });
        }

        
        
        
        const store = await dbHelpers.getStoreById(storeId);
        

        if (!store) {
            return NextResponse.json({ error: 'Store not found.' }, { status: 404 });
        }
        
        const wbToken = store.chat_api_token || store.api_token;

        if (!wbToken) {
            return NextResponse.json({ error: 'Chat API token not configured for this store.' }, { status: 400 });
        }
        
        const chatsResponse = await fetch('https://buyer-chat-api.wildberries.ru/api/v1/seller/chats', {
            headers: { 'Authorization': wbToken }
        });

        if (!chatsResponse.ok) {
            const errorText = await chatsResponse.text();
            console.error(`WB Chats API error: ${chatsResponse.status} ${errorText}`);
            return NextResponse.json({ error: `Ошибка API чатов WB: ${chatsResponse.status}`, details: errorText }, { status: chatsResponse.status });
        }

        const chatsData = await chatsResponse.json();
        return NextResponse.json(chatsData);

    } catch (error: any) {
        console.error("Failed to proxy chats request:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
