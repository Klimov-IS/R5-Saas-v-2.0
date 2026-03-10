/**
 * Telegram Notification System
 *
 * Sends push notifications to linked Telegram users when clients reply.
 * Called from dialogue sync process (non-blocking, wrapped in try/catch).
 *
 * Features:
 * - Digest format: ONE message per store per sync, listing all new replies
 * - Success notifications: immediate separate message for "deleted/upgraded/needs help" events
 * - Dedup: won't send duplicate notification for same chat within 1 hour
 * - Inline button to open Mini App
 */

import {
  getTelegramUsersForStore,
  wasNotificationSentRecently,
  logTelegramNotificationAtomic,
} from '@/db/telegram-helpers';
import type { SuccessEvent } from './success-detector';

const MINI_APP_URL = process.env.TELEGRAM_MINI_APP_URL || 'https://r5saas.ru/tg';

/** Returns true if current MSK time is within notification hours (08:00–23:00) */
function isNotificationHour(): boolean {
  const mskHour = (new Date().getUTCHours() + 3) % 24;
  return mskHour >= 8 && mskHour < 23;
}

interface ChatNotificationData {
  chatId: string;
  clientName: string;
  productName: string | null;
  messagePreview: string | null;
}

export interface SuccessNotificationData {
  chatId: string;
  clientName: string;
  productName: string | null;
  messageText: string;
  event: SuccessEvent;
}

/**
 * Send Telegram message via Bot API
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
 * Format digest notification — ONE message listing all chats with new replies
 */
function formatDigestNotification(storeName: string, chats: ChatNotificationData[]): string {
  const count = chats.length;
  const lines: string[] = [];

  const countWord = count === 1 ? 'ответ' : count < 5 ? 'новых ответа' : 'новых ответов';
  lines.push(`🏪 <b>${escapeHtml(storeName)}</b> — ${count} ${countWord}`);
  lines.push('');

  const shownChats = chats.slice(0, 5);
  for (const chat of shownChats) {
    const clientStr = escapeHtml(chat.clientName);
    const productStr = chat.productName ? ` · ${escapeHtml(truncate(chat.productName, 30))}` : '';
    const preview = chat.messagePreview
      ? `: <i>"${escapeHtml(truncate(chat.messagePreview, 80))}"</i>`
      : '';
    lines.push(`• ${clientStr}${productStr}${preview}`);
  }

  if (count > 5) {
    lines.push(`<i>...и ещё ${count - 5}</i>`);
  }

  return lines.join('\n');
}

/**
 * Format success notification — buyer deleted/upgraded their review
 */
function formatSuccessNotification(storeName: string, data: SuccessNotificationData): string {
  const { event, clientName, productName, messageText } = data;
  const lines: string[] = [];

  lines.push(`${event.emoji} <b>${escapeHtml(storeName)}</b>`);
  lines.push('');
  lines.push(`<b>${event.label}</b>`);
  lines.push('');

  const productStr = productName ? ` (${escapeHtml(truncate(productName, 40))})` : '';
  lines.push(`👤 ${escapeHtml(clientName)}${productStr}:`);
  lines.push(`<i>"${escapeHtml(truncate(messageText, 200))}"</i>`);

  return lines.join('\n');
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
 * Send digest notification for new client replies in a store.
 *
 * Broadcasts to ALL org members with TG linked and access to this store.
 * ONE message per user per sync per store, listing all new replies.
 * Called from dialogue sync after processing new messages.
 * Non-blocking — errors are logged but don't propagate.
 *
 * @param storeId Store ID
 * @param storeName Store name
 * @param chats Array of chats with new client replies
 */
export async function sendTelegramNotifications(
  storeId: string,
  storeName: string,
  chats: ChatNotificationData[]
): Promise<void> {
  if (chats.length === 0) return;
  if (!isNotificationHour()) return; // silent hours: 23:00–08:00 MSK

  // Find ALL TG users with access to this store
  const tgUsers = await getTelegramUsersForStore(storeId);
  if (tgUsers.length === 0) return;

  for (const tgUser of tgUsers) {
    try {
      // Filter out already-notified chats per user (dedup within 1 hour)
      const newChats: ChatNotificationData[] = [];
      for (const chat of chats) {
        const alreadySent = await wasNotificationSentRecently(tgUser.id, chat.chatId, 'client_reply', 60);
        if (!alreadySent) {
          newChats.push(chat);
        }
      }

      if (newChats.length === 0) continue;

      console.log(`[TG-NOTIF] Sending digest for ${newChats.length} chats to TG ${tgUser.telegram_id} (store: ${storeName})`);

      // Atomic dedup: log BEFORE sending to prevent race condition duplicates
      const loggedChatIds: string[] = [];
      for (const chat of newChats) {
        const inserted = await logTelegramNotificationAtomic({
          telegramUserId: tgUser.id,
          chatId: chat.chatId,
          storeId,
          notificationType: 'client_reply',
          messageText: `[digest] ${newChats.length} chats`,
        });
        if (inserted) loggedChatIds.push(chat.chatId);
      }

      // Only send if we actually logged at least one (won the race)
      if (loggedChatIds.length === 0) continue;

      const chatsToNotify = newChats.filter(c => loggedChatIds.includes(c.chatId));
      const text = formatDigestNotification(storeName, chatsToNotify);
      const replyMarkup = {
        inline_keyboard: [[{
          text: '📱 Открыть очередь',
          web_app: { url: `${MINI_APP_URL}?storeId=${storeId}` },
        }]],
      };

      await tgSendMessage(tgUser.chat_id, text, replyMarkup);
    } catch (err: any) {
      console.error(`[TG-NOTIF] Error sending digest to TG ${tgUser.telegram_id}: ${err.message}`);
    }
  }
}

/**
 * Send immediate success notification when buyer deletes/upgrades their review.
 *
 * Broadcasts to ALL org members with TG linked and access to this store.
 * Separate from digest — sent immediately, not batched.
 * Dedup: won't re-send for same chat within 24 hours.
 *
 * @param storeId Store ID
 * @param storeName Store name
 * @param data Success event data (chat, buyer, message, event type)
 */
export async function sendSuccessNotification(
  storeId: string,
  storeName: string,
  data: SuccessNotificationData
): Promise<void> {
  if (!isNotificationHour()) return; // silent hours: 23:00–08:00 MSK

  const tgUsers = await getTelegramUsersForStore(storeId);
  if (tgUsers.length === 0) return;

  const notifType = `success_${data.event.type}`;

  for (const tgUser of tgUsers) {
    try {
      // Atomic dedup: log first, send only if we won the race
      const inserted = await logTelegramNotificationAtomic({
        telegramUserId: tgUser.id,
        chatId: data.chatId,
        storeId,
        notificationType: notifType,
        messageText: formatSuccessNotification(storeName, data).substring(0, 500),
        dedupMinutes: 1440, // 24 hours
      });
      if (!inserted) continue;

      console.log(`[TG-NOTIF] Success event [${data.event.type}] for chat ${data.chatId} to TG ${tgUser.telegram_id} in store ${storeName}`);

      const text = formatSuccessNotification(storeName, data);
      const replyMarkup = {
        inline_keyboard: [[{
          text: '📱 Открыть чат',
          web_app: { url: `${MINI_APP_URL}/chat/${data.chatId}?storeId=${storeId}` },
        }]],
      };

      await tgSendMessage(tgUser.chat_id, text, replyMarkup);
    } catch (err: any) {
      console.error(`[TG-NOTIF] Error sending success to TG ${tgUser.telegram_id}: ${err.message}`);
    }
  }
}
