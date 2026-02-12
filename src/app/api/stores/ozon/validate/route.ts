import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';
import { createOzonClient, OzonApiError } from '@/lib/ozon-api';

/**
 * POST /api/stores/ozon/validate
 *
 * Validates OZON API credentials and returns seller preview.
 * Step 1 of OZON onboarding flow.
 *
 * Body: { clientId: string, apiKey: string }
 * Returns: { valid, sellerName, subscription, hasChatAccess, hasReviewAccess, ratings }
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
    const { clientId, apiKey } = body;

    if (!clientId || !apiKey) {
      return NextResponse.json(
        { error: 'Missing required fields: clientId, apiKey' },
        { status: 400 }
      );
    }

    // Step 1: Validate credentials by checking roles
    const client = createOzonClient(String(clientId), apiKey);

    let roles;
    try {
      roles = await client.getRoles();
    } catch (err) {
      if (err instanceof OzonApiError && err.status === 403) {
        return NextResponse.json(
          { valid: false, error: 'Неверные учётные данные OZON. Проверьте Client-Id и Api-Key.' },
          { status: 200 }
        );
      }
      throw err;
    }

    // Step 2: Get seller info
    const sellerInfo = await client.getSellerInfo();

    // Determine Premium Plus access
    const subscription = sellerInfo.subscription?.type || 'UNKNOWN';
    const hasPremiumPlus = subscription === 'PREMIUM_PLUS' || subscription === 'PREMIUM_PRO';

    // Step 3: Get rating summary
    let ratingSummary: Awaited<ReturnType<typeof client.getRatingSummary>> = [];
    try {
      ratingSummary = await client.getRatingSummary();
    } catch {
      ratingSummary = [];
    }

    return NextResponse.json({
      valid: true,
      sellerName: sellerInfo.company?.name || sellerInfo.company?.display_name || 'Неизвестно',
      companyName: sellerInfo.company?.display_name || sellerInfo.company?.name || '',
      inn: sellerInfo.company?.inn || '',
      subscription,
      hasChatAccess: hasPremiumPlus,
      hasReviewAccess: hasPremiumPlus,
      roles: (roles || []).map((r) => r.name),
      ratings: (ratingSummary || []).map((r) => ({
        name: r.rating_name,
        group: r.group_name,
        value: r.current_value,
      })),
    });
  } catch (error: any) {
    console.error('[OZON-VALIDATE] Error:', error.message);

    if (error instanceof OzonApiError) {
      return NextResponse.json(
        {
          valid: false,
          error: `Ошибка OZON API: ${error.message}`,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
