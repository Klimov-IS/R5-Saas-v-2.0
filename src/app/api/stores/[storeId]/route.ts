import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';

/**
 * GET /api/stores/[storeId]
 * Get single store details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { storeId: string } }
) {
  try {
    const authHeader = headers().get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid authorization header.' }, { status: 401 });
    }

    const apiKey = authHeader.split(' ')[1];
    if (!apiKey) {
      return NextResponse.json({ error: 'Unauthorized: API key is missing.' }, { status: 401 });
    }

    const userSettings = await dbHelpers.verifyApiKey(apiKey);
    if (!userSettings) {
      return NextResponse.json({ error: 'Unauthorized: Invalid API key.' }, { status: 401 });
    }

    const { storeId } = params;
    const store = await dbHelpers.getStoreById(storeId);

    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    return NextResponse.json({ data: store }, { status: 200 });

  } catch (error: any) {
    console.error('[API ERROR] GET /api/stores/[storeId]:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * PUT /api/stores/[storeId]
 * Update store
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { storeId: string } }
) {
  try {
    const authHeader = headers().get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid authorization header.' }, { status: 401 });
    }

    const apiKey = authHeader.split(' ')[1];
    if (!apiKey) {
      return NextResponse.json({ error: 'Unauthorized: API key is missing.' }, { status: 401 });
    }

    const userSettings = await dbHelpers.verifyApiKey(apiKey);
    if (!userSettings) {
      return NextResponse.json({ error: 'Unauthorized: Invalid API key.' }, { status: 401 });
    }

    const { storeId } = params;
    const body = await request.json();
    const { name, apiToken, contentApiToken, feedbacksApiToken, chatApiToken, status } = body;

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (apiToken !== undefined) updates.api_token = apiToken;
    if (contentApiToken !== undefined) updates.content_api_token = contentApiToken;
    if (feedbacksApiToken !== undefined) updates.feedbacks_api_token = feedbacksApiToken;
    if (chatApiToken !== undefined) updates.chat_api_token = chatApiToken;
    if (status !== undefined) updates.status = status;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({
        error: 'No fields to update'
      }, { status: 400 });
    }

    const updatedStore = await dbHelpers.updateStore(storeId, updates);

    if (!updatedStore) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    return NextResponse.json({ data: updatedStore }, { status: 200 });

  } catch (error: any) {
    console.error('[API ERROR] PUT /api/stores/[storeId]:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

/**
 * DELETE /api/stores/[storeId]
 * Delete store
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { storeId: string } }
) {
  try {
    const authHeader = headers().get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid authorization header.' }, { status: 401 });
    }

    const apiKey = authHeader.split(' ')[1];
    if (!apiKey) {
      return NextResponse.json({ error: 'Unauthorized: API key is missing.' }, { status: 401 });
    }

    const userSettings = await dbHelpers.verifyApiKey(apiKey);
    if (!userSettings) {
      return NextResponse.json({ error: 'Unauthorized: Invalid API key.' }, { status: 401 });
    }

    const { storeId } = params;
    const deleted = await dbHelpers.deleteStore(storeId);

    if (!deleted) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error: any) {
    console.error('[API ERROR] DELETE /api/stores/[storeId]:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
