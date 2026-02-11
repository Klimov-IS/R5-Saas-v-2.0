import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession, isOwnerOrAdmin } from '@/lib/auth';
import * as authDb from '@/db/auth-helpers';

/**
 * PATCH /api/org/members/[memberId] — update role
 * DELETE /api/org/members/[memberId] — remove member
 */

export async function PATCH(
  request: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const session = getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isOwnerOrAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { role } = await request.json();
    if (!['admin', 'manager'].includes(role)) {
      return NextResponse.json({ error: 'Недопустимая роль' }, { status: 400 });
    }

    const updated = await authDb.updateMemberRole(params.memberId, role);
    if (!updated) {
      return NextResponse.json({ error: 'Участник не найден или нельзя изменить роль owner' }, { status: 404 });
    }

    return NextResponse.json({ member: updated });
  } catch (error: any) {
    console.error('[ORG-MEMBER] PATCH Error:', error.message);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const session = getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isOwnerOrAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const removed = await authDb.removeMember(params.memberId);
    if (!removed) {
      return NextResponse.json({ error: 'Участник не найден или нельзя удалить owner' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[ORG-MEMBER] DELETE Error:', error.message);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
