import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbHelpers from '@/db/helpers';

/**
 * @swagger
 * /api/stores/{storeId}/chats:
 *   get:
 *     summary: Получить список чатов для магазина
 *     description: |
 *       Возвращает список чатов (диалогов) для указанного магазина с поддержкой пагинации.
 *       Чаты отсортированы по дате последнего сообщения (новые первые).
 *     tags:
 *       - Чаты
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID магазина
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Количество записей для пропуска (offset)
 *       - in: query
 *         name: take
 *         schema:
 *           type: integer
 *           default: 100
 *           maximum: 500
 *         description: Количество записей для возврата (limit)
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       '200':
 *         description: Успешный ответ со списком чатов
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     example: "chat123"
 *                   storeId:
 *                     type: string
 *                   clientName:
 *                     type: string
 *                   productNmId:
 *                     type: string
 *                     nullable: true
 *                   productName:
 *                     type: string
 *                     nullable: true
 *                   lastMessageDate:
 *                     type: string
 *                     format: date-time
 *                     nullable: true
 *                   lastMessageText:
 *                     type: string
 *                     nullable: true
 *                   lastMessageSender:
 *                     type: string
 *                     enum: [client, seller]
 *                     nullable: true
 *                   tag:
 *                     type: string
 *                     enum: [untagged, active, successful, unsuccessful, no_reply, completed]
 *                   draftReply:
 *                     type: string
 *                     nullable: true
 *       '401':
 *         description: Ошибка авторизации
 *       '404':
 *         description: Магазин не найден
 *       '500':
 *         description: Внутренняя ошибка сервера
 */
export async function GET(request: NextRequest, { params }: { params: { storeId: string } }) {
    const { storeId } = params;
    const { searchParams } = new URL(request.url);

    const skip = parseInt(searchParams.get('skip') || '0', 10);
    const take = parseInt(searchParams.get('take') || '100', 10);
    const status = searchParams.get('status') as dbHelpers.ChatStatus | 'all' || 'all';
    const sender = searchParams.get('sender') as 'all' | 'client' | 'seller' || 'all';
    const tag = searchParams.get('tag') || 'all';
    const search = searchParams.get('search') || '';
    const hasDraft = searchParams.get('hasDraft') === 'true';

    try {
        // Get chats with pagination and filters
        const chats = await dbHelpers.getChatsByStoreWithPagination(storeId, {
            limit: take,
            offset: skip,
            status: status !== 'all' ? status : undefined,
            sender: sender !== 'all' ? sender : undefined,
            tag,
            search,
            hasDraft
        });

        // Get total count with same filters
        const totalCount = await dbHelpers.getChatsCount(storeId, {
            status: status !== 'all' ? status : undefined,
            sender: sender !== 'all' ? sender : undefined,
            tag,
            search,
            hasDraft
        });

        // Format response
        const responseData = chats.map(chat => ({
            id: chat.id,
            storeId: chat.store_id,
            clientName: chat.client_name,
            productNmId: chat.product_nm_id,
            productName: chat.product_name,
            productVendorCode: chat.product_vendor_code,
            lastMessageDate: chat.last_message_date,
            lastMessageText: chat.last_message_text,
            lastMessageSender: chat.last_message_sender,
            replySign: chat.reply_sign,
            tag: chat.tag,
            status: chat.status, // NEW: Kanban status
            draftReply: chat.draft_reply || null,
            messageCount: chat.message_count || 0, // NEW: Real message count
        }));

        // Get tag statistics from store
        const store = await dbHelpers.getStoreById(storeId);
        const tagStats = store?.chat_tag_counts || {
            active: 0,
            successful: 0,
            unsuccessful: 0,
            no_reply: 0,
            untagged: 0,
            completed: 0,
            deletion_candidate: 0,
            deletion_offered: 0,
            deletion_agreed: 0,
            deletion_confirmed: 0,
            refund_requested: 0,
            spam: 0,
        };

        return NextResponse.json({
            data: responseData,
            totalCount,
            tagStats
        }, { status: 200 });

    } catch (error: any) {
        console.error(`[API ERROR] /api/stores/${storeId}/chats:`, error);
        return NextResponse.json({
            error: 'Internal Server Error',
            details: String(error.message || 'An unknown error occurred.')
        }, { status: 500 });
    }
}
