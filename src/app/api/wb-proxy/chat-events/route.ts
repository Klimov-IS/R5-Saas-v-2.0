
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';


export async function POST(request: NextRequest) {
    try {
        const { storeId, nextCursor } = await request.json();
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
        
        const eventsUrl = new URL('https://buyer-chat-api.wildberries.ru/api/v1/seller/events');
        if (nextCursor) {
            eventsUrl.searchParams.set('next', nextCursor);
        }

        const eventsResponse = await fetch(eventsUrl.toString(), {
            headers: { 'Authorization': wbToken }
        });

        if (!eventsResponse.ok) {
            const errorText = await eventsResponse.text();
             console.error(`WB Events API error: ${eventsResponse.status} ${errorText}`);
            return NextResponse.json({ error: `Ошибка API событий WB: ${eventsResponse.status}`, details: errorText }, { status: eventsResponse.status });
        }

        const eventsData = await eventsResponse.json();
        return NextResponse.json(eventsData);

    } catch (error: any) {
        console.error("Failed to proxy chat events request:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
