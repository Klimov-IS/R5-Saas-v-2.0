import { NextRequest, NextResponse } from 'next/server';
import { getStoreById } from '@/db/helpers';
import { generateReply, ChatNotFoundError } from '@/core/services/chat-service';

/**
 * POST /api/stores/[storeId]/chats/bulk/generate-ai
 * Bulk generate AI responses for multiple chats.
 * Uses shared ChatService.generateReply() — same logic as Web single + TMA.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { storeId: string } }
) {
  try {
    const { storeId } = params;
    const body = await request.json();
    const { chatIds } = body;

    // Get store to retrieve owner_id for AI logging
    const store = await getStoreById(storeId);
    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    if (!chatIds || chatIds.length === 0) {
      return NextResponse.json(
        { error: 'chatIds array is required. Cannot generate for all chats without explicit selection.' },
        { status: 400 }
      );
    }

    const results = {
      total: chatIds.length,
      successful: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process each chat sequentially via shared service
    for (const chatId of chatIds) {
      try {
        await generateReply(chatId, store.owner_id, [storeId]);
        results.successful++;
      } catch (error: any) {
        results.failed++;
        const msg = error instanceof ChatNotFoundError
          ? `Chat ${chatId} not found`
          : `Chat ${chatId}: ${error.message}`;
        results.errors.push(msg);
        console.error(`[BULK-AI] Failed chat ${chatId}:`, error.message);
      }
    }

    return NextResponse.json({
      success: true,
      results,
    }, { status: 200 });

  } catch (error: any) {
    console.error('[API ERROR] POST /api/stores/[storeId]/chats/bulk/generate-ai:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
