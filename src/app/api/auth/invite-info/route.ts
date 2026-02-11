import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as authDb from '@/db/auth-helpers';

/**
 * GET /api/auth/invite-info?token=xxx
 *
 * Validate invite token and return info for registration form.
 * Public endpoint (no auth required).
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Токен обязателен' }, { status: 400 });
    }

    const invite = await authDb.getInviteByToken(token);
    if (!invite) {
      return NextResponse.json({ error: 'Приглашение не найдено' }, { status: 404 });
    }

    if (invite.used_at) {
      return NextResponse.json({ error: 'Приглашение уже использовано' }, { status: 400 });
    }

    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Приглашение истекло' }, { status: 400 });
    }

    const org = await authDb.getOrganizationById(invite.org_id);

    return NextResponse.json({
      email: invite.email,
      role: invite.role,
      orgName: org?.name || 'Организация',
    });
  } catch (error: any) {
    console.error('[INVITE-INFO] Error:', error.message);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
