import { NextRequest, NextResponse } from 'next/server';
import { updateChatStatus } from '@/db/helpers';
import type { ChatStatus } from '@/db/helpers';

/**
 * PATCH /api/stores/[storeId]/chats/[chatId]/status
 * Update chat status for Kanban Board
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { storeId: string; chatId: string } }
) {
  try {
    const { chatId } = params;
    const body = await request.json();
    const { status } = body;

    if (!status || typeof status !== 'string') {
      return NextResponse.json(
        { error: 'status is required and must be a string' },
        { status: 400 }
      );
    }

    const validStatuses: ChatStatus[] = ['inbox', 'in_progress', 'awaiting_reply', 'resolved', 'closed'];
    if (!validStatuses.includes(status as ChatStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const updatedChat = await updateChatStatus(chatId, status as ChatStatus);

    if (!updatedChat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }

    console.log(`✅ [API] Chat ${chatId} status updated: ${status}`);

    return NextResponse.json({
      data: {
        id: updatedChat.id,
        status: updatedChat.status,
        statusUpdatedAt: updatedChat.status_updated_at,
      }
    }, { status: 200 });
  } catch (error: any) {
    console.error('[API ERROR] PATCH /api/stores/[storeId]/chats/[chatId]/status:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
