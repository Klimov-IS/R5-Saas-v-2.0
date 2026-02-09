import { NextRequest, NextResponse } from 'next/server';
import { getStoreGuides, createStoreGuide } from '@/db/helpers';
import { verifyApiKey } from '@/lib/server-utils';

/**
 * GET /api/stores/[storeId]/guides
 * Get all guides for a store
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { storeId: string } }
) {
  try {
    const authResult = await verifyApiKey(request);
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const entries = await getStoreGuides(params.storeId);
    return NextResponse.json({ entries });
  } catch (error: any) {
    console.error('[API ERROR] GET /guides:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/stores/[storeId]/guides
 * Create a new guide
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { storeId: string } }
) {
  try {
    const authResult = await verifyApiKey(request);
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const body = await request.json();
    const { title, content } = body;

    if (!title || !content) {
      return NextResponse.json(
        { error: 'title and content are required' },
        { status: 400 }
      );
    }

    const entry = await createStoreGuide(params.storeId, title, content);
    return NextResponse.json({ entry }, { status: 201 });
  } catch (error: any) {
    console.error('[API ERROR] POST /guides:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
