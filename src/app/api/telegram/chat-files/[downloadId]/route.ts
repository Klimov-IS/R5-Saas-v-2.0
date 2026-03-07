import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticateTgApiRequest } from '@/lib/telegram-auth';
import { getAccessibleStoreIds } from '@/db/auth-helpers';
import { getStoreById } from '@/db/helpers';

/**
 * GET /api/telegram/chat-files/[downloadId]?storeId=xxx
 *
 * Proxies chat attachment files from WB Buyer Chat API for TG Mini App.
 * Uses TG initData auth instead of session cookie.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { downloadId: string } }
) {
  try {
    const auth = await authenticateTgApiRequest(request);
    if (!auth.valid || !auth.userId) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const { downloadId } = params;
    const storeId = request.nextUrl.searchParams.get('storeId');

    if (!storeId) {
      return NextResponse.json({ error: 'storeId query param required' }, { status: 400 });
    }

    // Verify user has access to this store
    const accessibleStoreIds = await getAccessibleStoreIds(auth.userId);
    if (!accessibleStoreIds.includes(storeId)) {
      return NextResponse.json({ error: 'Access denied to store' }, { status: 403 });
    }

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
    console.error('[TG-CHAT-FILES] Proxy error:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
