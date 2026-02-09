import { NextRequest, NextResponse } from 'next/server';
import { updateStoreGuide, deleteStoreGuide } from '@/db/helpers';
import { verifyApiKey } from '@/lib/server-utils';

/**
 * PUT /api/stores/[storeId]/guides/[guideId]
 * Update a guide
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { storeId: string; guideId: string } }
) {
  try {
    const authResult = await verifyApiKey(request);
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const body = await request.json();
    const entry = await updateStoreGuide(params.guideId, body);

    if (!entry) {
      return NextResponse.json({ error: 'Guide not found' }, { status: 404 });
    }

    return NextResponse.json({ entry });
  } catch (error: any) {
    console.error('[API ERROR] PUT /guides/[guideId]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/stores/[storeId]/guides/[guideId]
 * Delete a guide
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { storeId: string; guideId: string } }
) {
  try {
    const authResult = await verifyApiKey(request);
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const deleted = await deleteStoreGuide(params.guideId);
    if (!deleted) {
      return NextResponse.json({ error: 'Guide not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API ERROR] DELETE /guides/[guideId]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
