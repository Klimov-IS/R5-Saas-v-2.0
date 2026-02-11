import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession, isOwnerOrAdmin } from '@/lib/auth';
import * as authDb from '@/db/auth-helpers';

/**
 * GET /api/org/members/[memberId]/stores — get assigned stores
 * PUT /api/org/members/[memberId]/stores — set assigned stores
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const session = getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isOwnerOrAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const storeIds = await authDb.getMemberStoreAccess(params.memberId);
    return NextResponse.json({ storeIds });
  } catch (error: any) {
    console.error('[MEMBER-STORES] GET Error:', error.message);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const session = getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isOwnerOrAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { storeIds } = await request.json();
    if (!Array.isArray(storeIds)) {
      return NextResponse.json({ error: 'storeIds must be an array' }, { status: 400 });
    }

    await authDb.setMemberStoreAccess(params.memberId, storeIds);
    return NextResponse.json({ success: true, storeIds });
  } catch (error: any) {
    console.error('[MEMBER-STORES] PUT Error:', error.message);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
