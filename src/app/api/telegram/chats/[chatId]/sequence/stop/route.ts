import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticateTgApiRequest } from '@/lib/telegram-auth';
import { query } from '@/db/client';
import * as dbHelpers from '@/db/helpers';
import { getAccessibleStoreIds } from '@/db/auth-helpers';

/**
 * POST /api/telegram/chats/[chatId]/sequence/stop
 *
 * Manually stop an active auto-sequence for a chat.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { chatId: string } }
) {
  try {
    const auth = await authenticateTgApiRequest(request);
    if (!auth.valid || !auth.userId) {
      return NextResponse.json({ error: auth.error || 'Unauthorized' }, { status: 401 });
    }

    const { chatId } = params;

    // Org-based access check
    const storeIds = await getAccessibleStoreIds(auth.userId);
    const chatResult = await query(
      'SELECT id FROM chats WHERE id = $1 AND store_id = ANY($2::text[])',
      [chatId, storeIds]
    );

    if (!chatResult.rows[0]) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    // Find active sequence
    const active = await dbHelpers.getActiveSequenceForChat(chatId);
    if (!active) {
      return NextResponse.json({ error: 'No active sequence found' }, { status: 404 });
    }

    // Stop it
    await dbHelpers.stopSequence(active.id, 'manual');

    console.log(`[TG-SEQUENCE] Manual stop: chat ${chatId}, sequence ${active.id}`);

    return NextResponse.json({ success: true, sequenceId: active.id });
  } catch (error: any) {
    console.error('[TG-SEQUENCE-STOP] Error:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
