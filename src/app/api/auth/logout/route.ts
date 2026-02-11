import { NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/auth';

/**
 * POST /api/auth/logout
 *
 * Clear auth cookie and log out.
 */
export async function POST() {
  try {
    clearAuthCookie();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[AUTH-LOGOUT] Error:', error.message);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
