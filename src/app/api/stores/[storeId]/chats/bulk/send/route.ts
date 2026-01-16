import { NextRequest, NextResponse } from 'next/server';
import { getChatsByStoreWithPagination, getChatById } from '@/db/helpers';

/**
 * POST /api/stores/[storeId]/chats/bulk/send
 * Bulk send messages to WB for multiple chats
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { storeId: string } }
) {
  try {
    const { storeId } = params;
    const body = await request.json();
    const { chatIds } = body;

    // If chatIds is empty or ['all'], process all chats
    const shouldProcessAll = !chatIds || chatIds.length === 0 || chatIds[0] === 'all';

    let targetChatIds: string[];

    if (shouldProcessAll) {
      // Get all chats for the store that have a draft reply
      const allChats = await getChatsByStoreWithPagination(storeId, {
        limit: 1000,
        offset: 0,
      });
      // Filter chats that have draft replies
      targetChatIds = allChats
        .filter((chat) => chat.draft_reply && chat.draft_reply.trim().length > 0)
        .map((chat) => chat.id);
    } else {
      targetChatIds = chatIds;
    }

    const results = {
      total: targetChatIds.length,
      successful: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process each chat
    for (const chatId of targetChatIds) {
      try {
        // Get chat data
        const chat = await getChatById(chatId);

        if (!chat) {
          results.failed++;
          results.errors.push(`Chat ${chatId} not found`);
          continue;
        }

        if (!chat.draft_reply || chat.draft_reply.trim().length === 0) {
          results.failed++;
          results.errors.push(`Chat ${chatId} has no draft reply`);
          continue;
        }

        // TODO: Send message to WB API
        // For now, just simulate success
        console.log(`Sending message to WB for chat ${chatId}:`, chat.draft_reply);

        results.successful++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(`Chat ${chatId}: ${error.message}`);
        console.error(`Failed to send message for chat ${chatId}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      results,
    }, { status: 200 });

  } catch (error: any) {
    console.error('[API ERROR] POST /api/stores/[storeId]/chats/bulk/send:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
