import { NextRequest, NextResponse } from 'next/server';
import { getStoreById, updateStore } from '@/db/helpers';
import { verifyApiKey } from '@/lib/server-utils';

/**
 * GET /api/stores/[storeId]/ai-instructions
 * Get AI instructions for a store
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

    const store = await getStoreById(params.storeId);
    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    return NextResponse.json({
      storeId: store.id,
      storeName: store.name,
      ai_instructions: store.ai_instructions || null,
    });
  } catch (error: any) {
    console.error('[API ERROR] GET /ai-instructions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PUT /api/stores/[storeId]/ai-instructions
 * Update AI instructions for a store
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { storeId: string } }
) {
  try {
    const authResult = await verifyApiKey(request);
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const store = await getStoreById(params.storeId);
    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const body = await request.json();
    const { instructions } = body;

    if (typeof instructions !== 'string' && instructions !== null) {
      return NextResponse.json(
        { error: 'instructions must be a string or null' },
        { status: 400 }
      );
    }

    await updateStore(params.storeId, {
      ai_instructions: instructions || null,
    });

    console.log(`[AI-INSTRUCTIONS] Updated for store ${store.name}: ${instructions ? instructions.length + ' chars' : 'cleared'}`);

    return NextResponse.json({
      success: true,
      storeId: store.id,
      storeName: store.name,
      ai_instructions: instructions || null,
    });
  } catch (error: any) {
    console.error('[API ERROR] PUT /ai-instructions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
