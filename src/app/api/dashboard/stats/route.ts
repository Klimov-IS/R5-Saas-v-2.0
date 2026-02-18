import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import * as dbHelpers from '@/db/helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const authHeader = headers().get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = authHeader.split(' ')[1];
    if (!apiKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userSettings = await dbHelpers.verifyApiKey(apiKey);
    if (!userSettings) {
      return NextResponse.json({ error: 'Unauthorized: Invalid API key.' }, { status: 401 });
    }

    const stats = await dbHelpers.getDashboardStats();

    return NextResponse.json(stats, {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  } catch (error: any) {
    console.error('[DASHBOARD STATS] Error:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
