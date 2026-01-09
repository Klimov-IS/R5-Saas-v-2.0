import { NextRequest, NextResponse } from 'next/server';
import { getChatById, getStoreById } from '@/db/helpers';

/**
 * POST /api/stores/[storeId]/chats/[chatId]/send
 * Send message to Wildberries Chat API
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { storeId: string; chatId: string } }
) {
  try {
    const { storeId, chatId } = params;
    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'message is required and must be a string' },
        { status: 400 }
      );
    }

    // Get chat to get the replySign
    const chat = await getChatById(chatId);
    if (!chat) {
      return NextResponse.json(
        { error: 'Chat not found' },
        { status: 404 }
      );
    }

    // Get store to get WB API token
    const store = await getStoreById(storeId);
    if (!store) {
      return NextResponse.json(
        { error: 'Store not found' },
        { status: 404 }
      );
    }

    const wbToken = store.chat_api_token || store.api_token;
    if (!wbToken) {
      return NextResponse.json(
        { error: 'Chat API token not configured for this store' },
        { status: 400 }
      );
    }

    // Send message to WB Chat API
    const formData = new FormData();
    formData.append('replySign', chat.reply_sign);
    formData.append('message', message);

    const wbResponse = await fetch('https://buyer-chat-api.wildberries.ru/api/v1/seller/message', {
      method: 'POST',
      headers: {
        'Authorization': wbToken,
      },
      body: formData,
    });

    if (!wbResponse.ok) {
      const errorData = await wbResponse.json().catch(() => ({ error: { message: `Ошибка API WB: ${wbResponse.status}` } }));
      const errorMessage = errorData.error?.message || errorData?.message || `Ошибка API WB: ${wbResponse.status}`;
      console.error(`[API ERROR] send message failed for chat ${chatId}:`, errorMessage);
      return NextResponse.json(
        { error: errorMessage },
        { status: wbResponse.status }
      );
    }

    const responseData = await wbResponse.json().catch(() => ({}));

    return NextResponse.json({
      success: true,
      data: responseData,
    }, { status: 200 });

  } catch (error: any) {
    console.error('[API ERROR] POST /api/stores/[storeId]/chats/[chatId]/send:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
