import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { hashPassword, signToken, setAuthCookie } from '@/lib/auth';
import * as authDb from '@/db/auth-helpers';

/**
 * POST /api/auth/register
 *
 * Register via invite token.
 * Body: { token, displayName, password }
 */
export async function POST(request: NextRequest) {
  try {
    const { token, displayName, password } = await request.json();

    if (!token || !displayName || !password) {
      return NextResponse.json(
        { error: 'Все поля обязательны' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Пароль должен быть не менее 6 символов' },
        { status: 400 }
      );
    }

    // Validate invite
    const invite = await authDb.getInviteByToken(token);
    if (!invite) {
      return NextResponse.json(
        { error: 'Приглашение не найдено' },
        { status: 404 }
      );
    }

    if (invite.used_at) {
      return NextResponse.json(
        { error: 'Приглашение уже использовано' },
        { status: 400 }
      );
    }

    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Приглашение истекло' },
        { status: 400 }
      );
    }

    // Check if email already registered
    const existingUser = await authDb.getUserByEmail(invite.email);
    if (existingUser) {
      return NextResponse.json(
        { error: 'Пользователь с этим email уже существует' },
        { status: 409 }
      );
    }

    // Hash password and register
    const passwordHash = await hashPassword(password);
    const { userId, memberId } = await authDb.registerFromInvite({
      invite,
      displayName: displayName.trim(),
      passwordHash,
    });

    // Get org name for response
    const org = await authDb.getOrganizationById(invite.org_id);

    // Auto-login: sign JWT and set cookie
    const jwtToken = signToken({
      userId,
      email: invite.email,
      orgId: invite.org_id,
      role: invite.role,
    });

    setAuthCookie(jwtToken);

    return NextResponse.json({
      user: {
        id: userId,
        email: invite.email,
        displayName: displayName.trim(),
      },
      org: {
        id: invite.org_id,
        name: org?.name || '',
      },
      role: invite.role,
    });
  } catch (error: any) {
    console.error('[AUTH-REGISTER] Error:', error.message);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
