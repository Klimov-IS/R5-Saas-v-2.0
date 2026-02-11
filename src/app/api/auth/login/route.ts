import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { comparePassword, signToken, setAuthCookie } from '@/lib/auth';
import * as authDb from '@/db/auth-helpers';

/**
 * POST /api/auth/login
 *
 * Login with email + password.
 * Sets httpOnly cookie with JWT token.
 */
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email и пароль обязательны' },
        { status: 400 }
      );
    }

    // Find user
    const user = await authDb.getUserByEmail(email.toLowerCase().trim());
    if (!user || !user.password_hash) {
      return NextResponse.json(
        { error: 'Неверный email или пароль' },
        { status: 401 }
      );
    }

    // Verify password
    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Неверный email или пароль' },
        { status: 401 }
      );
    }

    // Get org membership
    const member = await authDb.getOrgMemberByUserId(user.id);
    if (!member) {
      return NextResponse.json(
        { error: 'Пользователь не привязан к организации' },
        { status: 403 }
      );
    }

    // Sign JWT and set cookie
    const token = signToken({
      userId: user.id,
      email: user.email,
      orgId: member.org_id,
      role: member.role,
    });

    setAuthCookie(token);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
      },
      org: {
        id: member.org_id,
        name: member.org_name,
      },
      role: member.role,
    });
  } catch (error: any) {
    console.error('[AUTH-LOGIN] Error:', error.message);
    return NextResponse.json(
      { error: 'Ошибка сервера' },
      { status: 500 }
    );
  }
}
