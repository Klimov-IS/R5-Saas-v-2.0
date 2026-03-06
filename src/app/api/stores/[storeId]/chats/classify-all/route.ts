import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * POST /api/stores/{storeId}/chats/classify-all
 *
 * DISABLED (migration 024): AI tag classification has been removed.
 * Tags are now set automatically (deletion_candidate on link creation)
 * or manually from TG Mini App (deletion_offered/agreed/confirmed).
 */
export async function POST(request: NextRequest, { params }: { params: { storeId: string } }) {
  return NextResponse.json(
    { error: 'AI tag classification has been disabled. Tags are now set automatically or manually from TG Mini App.' },
    { status: 410 }
  );
}
