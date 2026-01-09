
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';


export async function POST(request: NextRequest) {
    try {
        const { storeId, params } = await request.json();
        
        if (!storeId) {
             return NextResponse.json({ error: 'storeId is required' }, { status: 400 });
        }

        
        
        
        const store = await dbHelpers.getStoreById(storeId);
        

        if (!store) {
            return NextResponse.json({ error: 'Store not found.' }, { status: 404 });
        }
        
        const wbToken = store.feedbacks_api_token || store.api_token;

        if (!wbToken) {
            return NextResponse.json({ error: 'Feedbacks API token not configured for this store.' }, { status: 400 });
        }
        
        const url = new URL('https://feedbacks-api.wildberries.ru/api/v1/questions');
        url.search = new URLSearchParams(params).toString();
        
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: { 'Authorization': wbToken }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`WB Questions API error: ${response.status} ${errorText}`);
            return NextResponse.json({ error: `Ошибка API вопросов WB: ${response.status}`, details: errorText }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);

    } catch (error: any) {
        console.error("Failed to proxy questions request:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const { storeId, body } = await request.json();
        
        if (!storeId) {
             return NextResponse.json({ error: 'storeId is required' }, { status: 400 });
        }

        
        
        
        const store = await dbHelpers.getStoreById(storeId);
        

        if (!store) {
            return NextResponse.json({ error: 'Store not found.' }, { status: 404 });
        }
        
        const wbToken = store.feedbacks_api_token || store.api_token;

        if (!wbToken) {
            return NextResponse.json({ error: 'Feedbacks API token not configured for this store.' }, { status: 400 });
        }

        const response = await fetch("https://feedbacks-api.wildberries.ru/api/v1/questions", {
            method: "PATCH",
            headers: {
                'Authorization': wbToken,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`WB Questions API error on PATCH: ${response.status} ${errorText}`);
            return NextResponse.json({ error: `Ошибка API Wildberries: ${response.status}`, details: errorText }, { status: response.status });
        }

        const data = await response.json().catch(() => ({})); // WB might return empty body on success
        return NextResponse.json(data);

    } catch (error: any) {
        console.error("Failed to proxy questions patch request:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
