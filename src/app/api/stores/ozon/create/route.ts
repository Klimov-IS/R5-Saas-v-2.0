import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';
import { getOrgMemberByUserId } from '@/db/auth-helpers';
import { createOzonClient, OzonApiError } from '@/lib/ozon-api';
import { generateFirebaseId } from '@/lib/utils';

/**
 * POST /api/stores/ozon/create
 *
 * Creates an OZON store after validation.
 * Step 2 of OZON onboarding flow.
 *
 * Body: { clientId: string, apiKey: string, name?: string }
 * Returns: { data: Store }
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = headers().get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized: Missing or invalid authorization header.' },
        { status: 401 }
      );
    }

    const bearerKey = authHeader.split(' ')[1];
    if (!bearerKey) {
      return NextResponse.json(
        { error: 'Unauthorized: API key is missing.' },
        { status: 401 }
      );
    }

    const userSettings = await dbHelpers.verifyApiKey(bearerKey);
    if (!userSettings) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid API key.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { clientId, apiKey, name } = body;

    if (!clientId || !apiKey) {
      return NextResponse.json(
        { error: 'Missing required fields: clientId, apiKey' },
        { status: 400 }
      );
    }

    // Re-validate credentials before creating store
    const client = createOzonClient(String(clientId), apiKey);
    const sellerInfo = await client.getSellerInfo();

    const storeName =
      name ||
      sellerInfo.company?.name ||
      sellerInfo.company?.display_name ||
      `OZON Store ${clientId}`;

    const subscription = sellerInfo.subscription?.type || null;

    // Check for duplicate — same OZON Client-Id
    const existingStores = await dbHelpers.getAllStores('ozon');
    const duplicate = existingStores.find(
      (s) => s.ozon_client_id === String(clientId)
    );
    if (duplicate) {
      return NextResponse.json(
        {
          error: `Магазин OZON с Client-Id ${clientId} уже подключён (${duplicate.name})`,
        },
        { status: 409 }
      );
    }

    // Resolve org_id from owner's membership
    const orgMember = await getOrgMemberByUserId(userSettings.id);
    const orgId = orgMember?.org_id || null;

    // Create the OZON store
    const storeId = generateFirebaseId();
    const newStore = await dbHelpers.createStore({
      id: storeId,
      name: storeName,
      marketplace: 'ozon',
      api_token: '', // Not used for OZON
      ozon_client_id: String(clientId),
      ozon_api_key: apiKey,
      ozon_subscription: subscription,
      owner_id: userSettings.id,
      org_id: orgId,
      status: 'active',
      total_reviews: 0,
      total_chats: 0,
    });

    console.log(
      `[OZON-CREATE] Store created: ${newStore.id} (${storeName}, subscription: ${subscription})`
    );

    return NextResponse.json(
      { data: newStore },
      {
        status: 201,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    );
  } catch (error: any) {
    console.error('[OZON-CREATE] Error:', error.message);

    if (error instanceof OzonApiError) {
      return NextResponse.json(
        { error: `Ошибка OZON API: ${error.message}` },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
