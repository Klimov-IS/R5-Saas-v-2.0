
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';

export async function POST(request: NextRequest) {
    try {
        const { storeId, cursor } = await request.json();

        if (!storeId) {
             return NextResponse.json({ error: 'storeId is required' }, { status: 400 });
        }

        const store = await dbHelpers.getStoreById(storeId);

        if (!store) {
            return NextResponse.json({ error: 'Store not found.' }, { status: 404 });
        }
        const wbToken = store.content_api_token || store.api_token;

        if (!wbToken) {
            return NextResponse.json({ error: 'Content API token not configured for this store.' }, { status: 400 });
        }
        
        const response = await fetch('https://content-api.wildberries.ru/content/v2/get/cards/list', {
            method: 'POST',
            headers: {
              'Authorization': wbToken,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ settings: { cursor, filter: { withPhoto: -1 } } })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`WB Products API error: ${response.status} ${errorText}`);
            return NextResponse.json({ error: `Ошибка API Wildberries: ${response.status}`, details: errorText }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error: any) {
        console.error("Failed to proxy products request:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
