import { NextRequest, NextResponse } from 'next/server';
import { getChatById, getChatMessages, updateChatTag } from '@/db/helpers';
import type { ChatTag } from '@/db/helpers';

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

    const chat = await getChatById(chatId);

    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }

    // Get chat messages
    const messages = await getChatMessages(chatId);

    return NextResponse.json({
      data: {
        chat,
        messages,
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

    const validTags: ChatTag[] = ['active', 'successful', 'unsuccessful', 'no_reply', 'untagged'];
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
