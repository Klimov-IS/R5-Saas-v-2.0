import { NextRequest, NextResponse } from 'next/server';
import { getStoreById } from '@/db/helpers';
import { getSession } from '@/lib/auth';

/**
 * GET /api/stores/[storeId]/chat-files/[downloadId]
 *
 * Proxies chat attachment files from WB Buyer Chat API.
 * WB requires authorization header, so we can't load directly from browser.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { storeId: string; downloadId: string } }
) {
  try {
    const session = await getSession(request);
    if (!session?.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { storeId, downloadId } = params;

    const store = await getStoreById(storeId);
    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const wbToken = store.chat_api_token || store.api_token;
    if (!wbToken) {
      return NextResponse.json({ error: 'WB token not configured' }, { status: 500 });
    }

    const wbResponse = await fetch(
      `https://buyer-chat-api.wildberries.ru/api/v1/seller/files/${downloadId}`,
      { headers: { 'Authorization': wbToken } }
    );

    if (!wbResponse.ok) {
      return NextResponse.json(
        { error: `WB API error: ${wbResponse.status}` },
        { status: wbResponse.status }
      );
    }

    const contentType = wbResponse.headers.get('content-type') || 'application/octet-stream';
    const contentDisposition = wbResponse.headers.get('content-disposition');
    const body = wbResponse.body;

    if (!body) {
      return NextResponse.json({ error: 'Empty response from WB' }, { status: 502 });
    }

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    };
    if (contentDisposition) {
      headers['Content-Disposition'] = contentDisposition;
    }

    return new NextResponse(body as any, { status: 200, headers });
  } catch (error: any) {
    console.error('[CHAT-FILES] Proxy error:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
