import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticateTgApiRequest } from '@/lib/telegram-auth';
import { query } from '@/db/client';
import * as dbHelpers from '@/db/helpers';
import { getAccessibleStoreIds } from '@/db/auth-helpers';

/**
 * GET /api/telegram/chats/[chatId]/sequence
 *
 * Get auto-sequence status for a chat.
 * Returns active sequence if exists, or latest completed/stopped.
 */
export async function GET(
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

    // Try active first, then latest
    const active = await dbHelpers.getActiveSequenceForChat(chatId);
    const sequence = active || await dbHelpers.getLatestSequenceForChat(chatId);

    if (!sequence) {
      return NextResponse.json({ sequence: null });
    }

    return NextResponse.json({
      sequence: {
        id: sequence.id,
        sequenceType: sequence.sequence_type,
        status: sequence.status,
        currentStep: sequence.current_step,
        maxSteps: sequence.max_steps,
        stopReason: sequence.stop_reason,
        nextSendAt: sequence.next_send_at,
        lastSentAt: sequence.last_sent_at,
        startedAt: sequence.started_at,
        createdAt: sequence.created_at,
      },
    });
  } catch (error: any) {
    console.error('[TG-SEQUENCE] Error:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
