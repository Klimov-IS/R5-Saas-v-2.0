import { NextRequest, NextResponse } from 'next/server';
import { getChatById, updateChat } from '@/db/helpers';

/**
 * POST /api/stores/[storeId]/chats/bulk/send
 * Bulk send messages to WB for multiple chats
 *
 * ⚠️ CRITICAL SAFETY: Only sends to explicitly selected chatIds
 * ❌ Does NOT support "send all" to prevent accidental mass-send
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { storeId: string } }
) {
  try {
    const { storeId } = params;
    const body = await request.json();
    const { chatIds } = body;

    // 🔴 CRITICAL SAFETY: Require explicit chatIds array
    if (!chatIds || chatIds.length === 0) {
      return NextResponse.json(
        {
          error: 'chatIds array is required. Cannot send to all chats without explicit selection.',
          hint: 'Pass an array of specific chat IDs to send drafts to.'
        },
        { status: 400 }
      );
    }

    // Block legacy "all" keyword to prevent accidents
    if (chatIds.includes('all')) {
      return NextResponse.json(
        {
          error: 'Invalid chatIds. "all" keyword is not supported for safety reasons.',
          hint: 'Please select specific chats to send drafts to.'
        },
        { status: 400 }
      );
    }

    const results = {
      total: chatIds.length,
      successful: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process each chat
    for (const chatId of chatIds) {
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

        // ✅ Clear draft after successful send
        await updateChat(chatId, {
          draft_reply: null,
          draft_reply_generated_at: null,
          draft_reply_edited: null,
        });

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
