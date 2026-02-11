import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getUserByEmail } from '@/db/auth-helpers';
import { comparePassword, signToken } from '@/lib/auth';
import { getOrgMemberByUserId } from '@/db/auth-helpers';
import { getUserStores } from '@/db/extension-helpers';

/**
 * POST /api/telegram/auth/login
 *
 * Email+password login for TG Mini App.
 * Returns JWT token + userId + stores list.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'Email и пароль обязательны' }, { status: 400 });
    }

    // Find user
    const user = await getUserByEmail(email);
    if (!user || !user.password_hash) {
      return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 });
    }

    // Verify password
    const valid = await comparePassword(password, user.password_hash);
    if (!valid) {
      return NextResponse.json({ error: 'Неверный email или пароль' }, { status: 401 });
    }

    // Get org membership
    const member = await getOrgMemberByUserId(user.id);
    if (!member) {
      return NextResponse.json({ error: 'Нет доступа к организации' }, { status: 403 });
    }

    // Sign JWT
    const token = signToken({
      userId: user.id,
      email: user.email,
      orgId: member.org_id,
      role: member.role as 'owner' | 'admin' | 'manager',
    });

    // Get user's stores
    const stores = await getUserStores(user.id);

    return NextResponse.json({
      token,
      userId: user.id,
      displayName: user.display_name || user.email,
      role: member.role,
      stores: stores.map(s => ({ id: s.id, name: s.name })),
    });
  } catch (error: any) {
    console.error('[TG-AUTH-LOGIN] Error:', error.message);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
