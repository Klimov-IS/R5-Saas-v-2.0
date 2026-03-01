import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';
import { getCabinetData } from '@/db/cabinet-helpers';

/**
 * GET /api/stores/[storeId]/cabinet
 * Returns all data for the "Кабинет" tab — single endpoint, parallel queries
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
    const data = await getCabinetData(storeId);

    if (!data) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    return NextResponse.json({ data }, { status: 200 });

  } catch (error: any) {
    console.error('[API ERROR] GET /api/stores/[storeId]/cabinet:', error.message, error.stack);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}
