import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticateTgApiRequest } from '@/lib/telegram-auth';
import { query } from '@/db/client';
import { getAccessibleStoreIds } from '@/db/auth-helpers';

/**
 * GET /api/telegram/chats/[chatId]
 *
 * Returns chat detail + messages for Mini App.
 * Validates access via org-based store permissions.
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
    const storeIds = await getAccessibleStoreIds(auth.userId);

    // Get chat with org-based access check + review/product rules data
    const chatResult = await query(
      `SELECT c.*, s.name as store_name,
         rcl.review_rating, rcl.review_date, rcl.chat_url,
         r.text as review_text,
         r.complaint_status, r.product_status_by_review as product_status,
         pr.offer_compensation, pr.max_compensation,
         pr.compensation_type, pr.compensation_by,
         pr.chat_strategy::text as chat_strategy
       FROM chats c
       JOIN stores s ON c.store_id = s.id
       LEFT JOIN review_chat_links rcl ON rcl.chat_id = c.id AND rcl.store_id = c.store_id
       LEFT JOIN reviews r ON rcl.review_id = r.id
       LEFT JOIN products p ON p.store_id = c.store_id AND c.product_nm_id = p.wb_product_id
       LEFT JOIN product_rules pr ON p.id = pr.product_id
       WHERE c.id = $1 AND c.store_id = ANY($2::text[])`,
      [chatId, storeIds]
    );

    if (!chatResult.rows[0]) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    const chat = chatResult.rows[0];

    // Get last 200 messages (subquery DESC → outer ASC for chronological display)
    const messagesResult = await query(
      `SELECT * FROM (
         SELECT id, text, sender, timestamp, is_auto_reply
         FROM chat_messages
         WHERE chat_id = $1
         ORDER BY timestamp DESC
         LIMIT 200
       ) sub ORDER BY timestamp ASC`,
      [chatId]
    );

    const messages = messagesResult.rows.map((m: any) => ({
      id: m.id,
      text: m.text,
      sender: m.sender,
      timestamp: m.timestamp,
      isAutoReply: m.is_auto_reply,
    }));

    // Synthesize last message if not yet synced to chat_messages.
    // Covers: (1) TG mini-app send gap (seller), (2) dialogue sync gap (client).
    // Uses chats.last_message_text/sender/date which are updated immediately on sync/send.
    if (
      chat.last_message_text &&
      chat.last_message_date &&
      chat.last_message_sender
    ) {
      const lastMsgDate = new Date(chat.last_message_date).getTime();
      const lastDbMsg = messages[messages.length - 1];
      const lastDbDate = lastDbMsg ? new Date(lastDbMsg.timestamp).getTime() : 0;
      // Add synthetic entry only if chat_messages doesn't yet have this message
      if (lastDbDate < lastMsgDate - 1000) {
        messages.push({
          id: `tg_synth_${chat.id}_${lastMsgDate}`,
          text: chat.last_message_text,
          sender: chat.last_message_sender,
          timestamp: chat.last_message_date,
          isAutoReply: false,
        });
      }
    }

    return NextResponse.json({
      chat: {
        id: chat.id,
        storeId: chat.store_id,
        storeName: chat.store_name,
        marketplace: chat.marketplace,
        clientName: chat.client_name,
        productName: chat.product_name,
        productNmId: chat.product_nm_id ?? null,
        status: chat.status,
        tag: chat.tag,
        draftReply: chat.draft_reply,
        completionReason: chat.completion_reason,
        // Review & product rules
        reviewRating: chat.review_rating ?? null,
        reviewDate: chat.review_date ?? null,
        complaintStatus: chat.complaint_status ?? null,
        productStatus: chat.product_status ?? null,
        offerCompensation: chat.offer_compensation ?? null,
        maxCompensation: chat.max_compensation ?? null,
        compensationType: chat.compensation_type ?? null,
        compensationBy: chat.compensation_by ?? null,
        chatStrategy: chat.chat_strategy ?? null,
        reviewText: chat.review_text ?? null,
        chatUrl: chat.chat_url ?? null,
      },
      messages,
    });
  } catch (error: any) {
    console.error('[TG-CHAT] Error:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
