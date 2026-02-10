/**
 * Telegram Notification System
 *
 * Sends push notifications to linked Telegram users when clients reply.
 * Called from dialogue sync process (non-blocking, wrapped in try/catch).
 *
 * Features:
 * - Dedup: won't send duplicate notification for same chat within 1 hour
 * - Batching: 1-5 individual, 6+ summary notification
 * - Inline button to open Mini App
 */

import {
  getTelegramUserForStore,
  wasNotificationSentRecently,
  logTelegramNotification,
} from '@/db/telegram-helpers';

const MINI_APP_URL = process.env.TELEGRAM_MINI_APP_URL || 'https://r5saas.ru/tg';

interface ChatNotificationData {
  chatId: string;
  clientName: string;
  productName: string | null;
  messagePreview: string | null;
}

/**
 * Send Telegram notification via Bot API
 */
async function tgSendMessage(chatId: number, text: string, replyMarkup?: any): Promise<number | null> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return null;

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
      }),
    });

    const data = await response.json();
    if (data.ok) {
      return data.result.message_id;
    } else {
      console.error('[TG-NOTIF] Send error:', data.description);
      return null;
    }
  } catch (error: any) {
    console.error('[TG-NOTIF] Send error:', error.message);
    return null;
  }
}

/**
 * Format individual notification message
 */
function formatNotification(storeName: string, chat: ChatNotificationData): string {
  const lines: string[] = [];
  lines.push(`🏪 <b>${escapeHtml(storeName)}</b> — Новый ответ клиента`);
  lines.push('');
  lines.push(`👤 ${escapeHtml(chat.clientName)}`);
  if (chat.productName) {
    lines.push(`📦 ${escapeHtml(truncate(chat.productName, 50))}`);
  }
  if (chat.messagePreview) {
    lines.push('');
    lines.push(`💬 <i>"${escapeHtml(truncate(chat.messagePreview, 150))}"</i>`);
  }
  return lines.join('\n');
}

/**
 * Format summary notification (6+ chats)
 */
function formatSummaryNotification(storeName: string, count: number): string {
  return (
    `🏪 <b>${escapeHtml(storeName)}</b>\n\n` +
    `📨 <b>${count}</b> новых ответов клиентов\n\n` +
    `Откройте Mini App для обработки.`
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.substring(0, maxLen - 3) + '...';
}

/**
 * Main entry point: send notifications for new client replies in a store
 *
 * Called from dialogue sync after processing new messages.
 * Non-blocking — errors are logged but don't propagate.
 *
 * @param storeId Store ID
 * @param storeName Store name
 * @param ownerId Store owner's R5 user ID
 * @param chats Array of chats with new client replies
 */
export async function sendTelegramNotifications(
  storeId: string,
  storeName: string,
  ownerId: string,
  chats: ChatNotificationData[]
): Promise<void> {
  if (chats.length === 0) return;

  // Find linked TG user for this store's owner
  const tgUser = await getTelegramUserForStore(ownerId);
  if (!tgUser) return; // No linked TG account or notifications disabled

  // Filter out already-notified chats (dedup)
  const newChats: ChatNotificationData[] = [];
  for (const chat of chats) {
    const alreadySent = await wasNotificationSentRecently(tgUser.id, chat.chatId, 'client_reply', 60);
    if (!alreadySent) {
      newChats.push(chat);
    }
  }

  if (newChats.length === 0) return;

  console.log(`[TG-NOTIF] Sending ${newChats.length} notifications to TG ${tgUser.telegram_id} for store ${storeName}`);

  // Batching: 1-5 individual, 6+ summary
  if (newChats.length <= 5) {
    // Individual notifications
    for (const chat of newChats) {
      const text = formatNotification(storeName, chat);
      const replyMarkup = {
        inline_keyboard: [[{
          text: '📱 Открыть чат',
          web_app: { url: `${MINI_APP_URL}/chat/${chat.chatId}?storeId=${storeId}` },
        }]],
      };

      const msgId = await tgSendMessage(tgUser.chat_id, text, replyMarkup);

      await logTelegramNotification({
        telegramUserId: tgUser.id,
        chatId: chat.chatId,
        storeId,
        notificationType: 'client_reply',
        messageText: text.substring(0, 500),
        tgMessageId: msgId || undefined,
      });

      // Small delay between messages to respect rate limits
      if (newChats.length > 1) {
        await new Promise(r => setTimeout(r, 100));
      }
    }
  } else {
    // Summary notification
    const text = formatSummaryNotification(storeName, newChats.length);
    const replyMarkup = {
      inline_keyboard: [[{
        text: '📱 Открыть очередь',
        web_app: { url: MINI_APP_URL },
      }]],
    };

    const msgId = await tgSendMessage(tgUser.chat_id, text, replyMarkup);

    // Log for all chats (to prevent re-notification)
    for (const chat of newChats) {
      await logTelegramNotification({
        telegramUserId: tgUser.id,
        chatId: chat.chatId,
        storeId,
        notificationType: 'client_reply',
        messageText: `[summary] ${newChats.length} chats`,
        tgMessageId: msgId || undefined,
      });
    }
  }
}
