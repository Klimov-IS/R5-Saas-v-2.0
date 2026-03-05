import { NextRequest, NextResponse } from 'next/server';
import { getStoreById } from '@/db/helpers';
import { generateReply, ChatNotFoundError } from '@/core/services/chat-service';

/**
 * POST /api/stores/[storeId]/chats/[chatId]/generate-ai
 * Generate AI response for a chat (web dashboard).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { storeId: string; chatId: string } }
) {
  try {
    const { storeId, chatId } = params;

    // Get store to retrieve owner_id for AI logging
    const store = await getStoreById(storeId);
    if (!store) {
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 404 }
      );
    }

    const result = await generateReply(chatId, store.owner_id, [storeId]);

    return NextResponse.json({
      success: true,
      text: result.draftReply,
      saved: true,
    }, { status: 200 });
  } catch (error: any) {
    if (error instanceof ChatNotFoundError) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }
    console.error('[API ERROR] POST /api/stores/[storeId]/chats/[chatId]/generate-ai:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
