import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticateTelegramRequest } from '@/lib/telegram-auth';
import { getUserStores } from '@/db/extension-helpers';

/**
 * POST /api/telegram/auth/verify
 *
 * Validates Telegram Mini App initData and returns user info + stores.
 */
export async function POST(request: NextRequest) {
  try {
    const { initData } = await request.json();

    if (!initData || typeof initData !== 'string') {
      return NextResponse.json({ valid: false, error: 'Missing initData' }, { status: 400 });
    }

    const result = await authenticateTelegramRequest(initData);

    if (!result.valid) {
      return NextResponse.json({ valid: false, error: result.error }, { status: 401 });
    }

    // If authenticated but not linked
    if (!result.userId) {
      return NextResponse.json({
        valid: true,
        userId: null,
        stores: [],
        error: 'Account not linked',
      });
    }

    // Get user's stores
    const stores = await getUserStores(result.userId);

    return NextResponse.json({
      valid: true,
      userId: result.userId,
      stores: stores.map(s => ({ id: s.id, name: s.name })),
    });
  } catch (error: any) {
    console.error('[TG-AUTH] Error:', error.message);
    return NextResponse.json({ valid: false, error: 'Internal server error' }, { status: 500 });
  }
}
