'use client';

import { useState } from 'react';
import type { ChatMessage } from '@/types/chats';
import { Loader2, Check, AlertCircle, Bot, Paperclip } from 'lucide-react';

interface MessageBubbleProps {
  message: ChatMessage;
  storeId?: string;
}

function AttachmentPreview({ downloadId, storeId }: { downloadId: string; storeId: string }) {
  const [failed, setFailed] = useState(false);
  // If downloadId is a full URL (WB CDN), use directly; otherwise proxy through our API
  const src = downloadId.startsWith('http')
    ? downloadId
    : `/api/stores/${storeId}/chat-files/${downloadId}`;

  if (failed) {
    return (
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-xs opacity-80 hover:opacity-100 underline"
      >
        <Paperclip className="w-3.5 h-3.5" />
        <span>Скачать вложение</span>
      </a>
    );
  }

  return (
    <a href={src} target="_blank" rel="noopener noreferrer">
      <img
        src={src}
        alt="Вложение"
        loading="lazy"
        onError={() => setFailed(true)}
        className="max-w-[280px] max-h-[320px] rounded-lg object-cover cursor-pointer"
      />
    </a>
  );
}

export function MessageBubble({ message, storeId }: MessageBubbleProps) {
  const isClient = message.sender === 'client';
  const isSeller = message.sender === 'seller';
  const isAutoReply = message.isAutoReply === true;
  const status = message.status || 'sent';
  const hasAttachment = !!message.downloadId && (message.downloadId.startsWith('http') || !!storeId);
  const hasText = !!message.text && message.text !== 'Вложение';

  // Format time with date if needed
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();

    // Check if message is from today
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    // Check if message is from yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    const time = date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Return format based on date
    if (isToday) {
      return time; // Just "13:22"
    } else if (isYesterday) {
      return `Вчера, ${time}`; // "Вчера, 13:22"
    } else {
      const dateStr = date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short',
      });
      return `${dateStr}, ${time}`; // "15 янв, 13:22"
    }
  };

  return (
    <div
      className={`flex gap-3 mb-4 ${isClient ? 'flex-row' : 'flex-row-reverse'}`}
    >
      {/* Avatar */}
      <div
        className={`
          w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0
          ${
            isClient
              ? 'bg-gradient-to-br from-purple-500 to-purple-700'
              : isAutoReply
                ? 'bg-gradient-to-br from-violet-400 to-violet-600'
                : 'bg-gradient-to-br from-blue-400 to-blue-600'
          }
        `}
      >
        {isClient ? 'К' : isAutoReply ? <Bot className="w-5 h-5" /> : '🏪'}
      </div>

      {/* Message Content */}
      <div className={`max-w-[60%] ${isClient ? '' : 'flex flex-col items-end'}`}>
        {/* Auto-reply label */}
        {isAutoReply && (
          <div className="flex items-center gap-1 mb-1 text-[11px] font-medium text-violet-600">
            <Bot className="w-3 h-3" />
            <span>Авто-рассылка</span>
          </div>
        )}

        {/* Message Bubble */}
        <div
          className={`
            px-4 py-3 rounded-xl text-sm leading-relaxed
            ${
              isClient
                ? 'bg-white border border-slate-200 text-slate-900 rounded-tl-sm'
                : isAutoReply
                  ? 'bg-violet-500 text-white rounded-tr-sm'
                  : 'bg-blue-500 text-white rounded-tr-sm'
            }
          `}
        >
          {hasAttachment && (
            <div className={hasText ? 'mb-2' : ''}>
              <AttachmentPreview downloadId={message.downloadId!} storeId={storeId!} />
            </div>
          )}
          {hasText && message.text}
        </div>

        {/* Timestamp + Status (only for seller messages) */}
        <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
          <span>{formatTime(message.createdAt)}</span>

          {/* Status indicator (only for seller messages) */}
          {isSeller && (
            <>
              {status === 'sending' && (
                <Loader2 className="w-3 h-3 animate-spin text-blue-400" title="Отправляется..." />
              )}
              {status === 'sent' && (
                <Check className="w-3 h-3 text-green-500" title="Отправлено" />
              )}
              {status === 'failed' && (
                <AlertCircle className="w-3 h-3 text-red-500" title="Ошибка отправки" />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
