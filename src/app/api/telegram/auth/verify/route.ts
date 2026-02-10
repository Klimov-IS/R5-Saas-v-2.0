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
    const body = await request.json();
    const initData = body.initData as string | undefined;
    const devUserId = body.devUserId as string | undefined;

    // Dev mode: bypass TG auth with direct userId
    if (devUserId && process.env.TELEGRAM_DEV_MODE === 'true') {
      const stores = await getUserStores(devUserId);
      if (stores.length === 0) {
        return NextResponse.json({ valid: false, error: 'User not found or has no stores' }, { status: 404 });
      }
      console.log('[TG-AUTH] Dev mode login for user:', devUserId);
      return NextResponse.json({
        valid: true,
        userId: devUserId,
        stores: stores.map(s => ({ id: s.id, name: s.name })),
      });
    }

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
