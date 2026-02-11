import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession, isOwnerOrAdmin } from '@/lib/auth';
import * as authDb from '@/db/auth-helpers';
import crypto from 'crypto';

/**
 * GET /api/org/invites — list invites for the org
 * POST /api/org/invites — create new invite (owner/admin only)
 */

export async function GET() {
  try {
    const session = getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isOwnerOrAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const invites = await authDb.getOrgInvites(session.orgId);
    return NextResponse.json({ invites });
  } catch (error: any) {
    console.error('[ORG-INVITES] GET Error:', error.message);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isOwnerOrAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { email, role } = await request.json();

    if (!email || !role) {
      return NextResponse.json({ error: 'Email и роль обязательны' }, { status: 400 });
    }

    if (!['admin', 'manager'].includes(role)) {
      return NextResponse.json({ error: 'Недопустимая роль' }, { status: 400 });
    }

    // Check if user already exists in org
    const existingUser = await authDb.getUserByEmail(email.toLowerCase().trim());
    if (existingUser) {
      const existingMember = await authDb.getOrgMemberByUserId(existingUser.id);
      if (existingMember && existingMember.org_id === session.orgId) {
        return NextResponse.json({ error: 'Пользователь уже в организации' }, { status: 409 });
      }
    }

    const token = crypto.randomUUID();
    const invite = await authDb.createInvite({
      orgId: session.orgId,
      email: email.toLowerCase().trim(),
      role,
      token,
      invitedBy: session.userId,
    });

    return NextResponse.json({
      invite,
      registrationUrl: `/register?token=${token}`,
    });
  } catch (error: any) {
    console.error('[ORG-INVITES] POST Error:', error.message);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
