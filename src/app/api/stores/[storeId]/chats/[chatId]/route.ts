import { NextRequest, NextResponse } from 'next/server';
import { getChatMessages, updateChatTag } from '@/db/helpers';
import type { ChatTag } from '@/db/helpers';
import { query } from '@/db/client';

/**
 * GET /api/stores/[storeId]/chats/[chatId]
 * Get single chat with message history
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { storeId: string; chatId: string } }
) {
  try {
    const { chatId } = params;

    // Inline SQL with JOINs for review data enrichment
    const chatResult = await query(`
      SELECT c.*,
        p.name as product_name,
        p.vendor_code as product_vendor_code,
        rcl.review_rating,
        rcl.review_date,
        r.text as review_text,
        r.complaint_status,
        r.product_status_by_review as product_status,
        pr.offer_compensation,
        pr.max_compensation,
        pr.compensation_type,
        pr.compensation_by,
        pr.chat_strategy::text as chat_strategy
      FROM chats c
      LEFT JOIN review_chat_links rcl ON rcl.chat_id = c.id AND rcl.store_id = c.store_id
      LEFT JOIN reviews r ON rcl.review_id = r.id
      LEFT JOIN products p ON p.store_id = c.store_id
        AND ((c.marketplace = 'wb' AND c.product_nm_id = p.wb_product_id)
          OR (c.marketplace = 'ozon' AND (c.product_nm_id = p.ozon_sku OR c.product_nm_id = p.ozon_fbs_sku)))
      LEFT JOIN product_rules pr ON p.id = pr.product_id
      WHERE c.id = $1
    `, [chatId]);

    const chat = chatResult.rows[0];

    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }

    // Get chat messages
    const messages = await getChatMessages(chatId);

    // Map snake_case to camelCase for chat
    const mappedChat = {
      id: chat.id,
      storeId: chat.store_id,
      ownerId: chat.owner_id,
      clientName: chat.client_name,
      productNmId: chat.product_nm_id,
      productName: chat.product_name,
      productVendorCode: chat.product_vendor_code,
      lastMessageDate: chat.last_message_date,
      lastMessageText: chat.last_message_text,
      lastMessageSender: chat.last_message_sender,
      replySign: chat.reply_sign,
      tag: chat.tag,
      status: chat.status || 'inbox',
      statusUpdatedAt: chat.status_updated_at,
      completionReason: chat.completion_reason,
      draftReply: chat.draft_reply,
      draftReplyThreadId: chat.draft_reply_thread_id,
      draftReplyGeneratedAt: chat.draft_reply_generated_at,
      draftReplyEdited: chat.draft_reply_edited,
      createdAt: chat.created_at,
      updatedAt: chat.updated_at,
      // Review enrichment data
      reviewRating: chat.review_rating ?? null,
      reviewDate: chat.review_date ?? null,
      reviewText: chat.review_text ?? null,
      complaintStatus: chat.complaint_status ?? null,
      productStatus: chat.product_status ?? null,
      offerCompensation: chat.offer_compensation ?? null,
      maxCompensation: chat.max_compensation ?? null,
      compensationType: chat.compensation_type ?? null,
      compensationBy: chat.compensation_by ?? null,
      chatStrategy: chat.chat_strategy ?? null,
    };

    // 🐛 DEBUG: Log draft status from DB
    console.log('📥 [API GET CHAT] Returning chat data:', {
      chatId: mappedChat.id,
      clientName: mappedChat.clientName,
      hasDraft: !!mappedChat.draftReply,
      draftReply: mappedChat.draftReply ? mappedChat.draftReply.substring(0, 100) + '...' : 'NULL',
      draftLength: mappedChat.draftReply?.length || 0,
      generatedAt: mappedChat.draftReplyGeneratedAt,
      edited: mappedChat.draftReplyEdited,
    });

    // Map snake_case to camelCase for messages
    const mappedMessages = messages.map(msg => ({
      id: msg.id,
      chatId: msg.chat_id,
      storeId: msg.store_id,
      ownerId: msg.owner_id,
      text: msg.text,
      sender: msg.sender,
      timestamp: msg.timestamp,
      createdAt: msg.created_at,
      isAutoReply: msg.is_auto_reply || false,
      downloadId: msg.download_id || null,
    }));

    return NextResponse.json({
      data: {
        chat: mappedChat,
        messages: mappedMessages,
      },
    }, { status: 200 });
  } catch (error: any) {
    console.error('[API ERROR] GET /api/stores/[storeId]/chats/[chatId]:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/stores/[storeId]/chats/[chatId]
 * Update chat tag
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { storeId: string; chatId: string } }
) {
  try {
    const { chatId } = params;
    const body = await request.json();
    const { tag } = body;

    if (!tag || typeof tag !== 'string') {
      return NextResponse.json(
        { error: 'tag is required and must be a string' },
        { status: 400 }
      );
    }

    const validTags: ChatTag[] = ['deletion_candidate', 'deletion_offered', 'deletion_agreed', 'deletion_confirmed'];
    if (!validTags.includes(tag as ChatTag)) {
      return NextResponse.json(
        { error: `Invalid tag. Must be one of: ${validTags.join(', ')}` },
        { status: 400 }
      );
    }

    const updatedChat = await updateChatTag(chatId, tag as ChatTag);

    if (!updatedChat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: updatedChat }, { status: 200 });
  } catch (error: any) {
    console.error('[API ERROR] PUT /api/stores/[storeId]/chats/[chatId]:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
