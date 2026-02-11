import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import * as authDb from '@/db/auth-helpers';

/**
 * GET /api/auth/me
 *
 * Get current authenticated user info.
 */
export async function GET() {
  try {
    const session = getSession();
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = await authDb.getUserById(session.userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const member = await authDb.getOrgMemberByUserId(session.userId);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
      },
      org: member ? {
        id: member.org_id,
        name: member.org_name,
      } : null,
      role: member?.role || null,
    });
  } catch (error: any) {
    console.error('[AUTH-ME] Error:', error.message);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
