import type { ChatMessage } from '@/types/chats';
import { Loader2, Check, AlertCircle } from 'lucide-react';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isClient = message.sender === 'client';
  const isSeller = message.sender === 'seller';
  const status = message.status || 'sent';

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
              : 'bg-gradient-to-br from-blue-400 to-blue-600'
          }
        `}
      >
        {isClient ? 'К' : '🏪'}
      </div>

      {/* Message Content */}
      <div className={`max-w-[60%] ${isClient ? '' : 'flex flex-col items-end'}`}>
        {/* Message Bubble */}
        <div
          className={`
            px-4 py-3 rounded-xl text-sm leading-relaxed
            ${
              isClient
                ? 'bg-white border border-slate-200 text-slate-900 rounded-tl-sm'
                : 'bg-blue-500 text-white rounded-tr-sm'
            }
          `}
        >
          {message.text}
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
