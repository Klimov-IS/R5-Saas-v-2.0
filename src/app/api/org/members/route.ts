import { NextResponse } from 'next/server';
import { getSession, isOwnerOrAdmin } from '@/lib/auth';
import * as authDb from '@/db/auth-helpers';

/**
 * GET /api/org/members — list org members
 */
export async function GET() {
  try {
    const session = getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!isOwnerOrAdmin(session)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const members = await authDb.getOrgMembers(session.orgId);
    return NextResponse.json({ members });
  } catch (error: any) {
    console.error('[ORG-MEMBERS] GET Error:', error.message);
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 });
  }
}
