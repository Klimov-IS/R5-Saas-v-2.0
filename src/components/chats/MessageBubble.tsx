import type { ChatMessage } from '@/types/chats';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isClient = message.sender === 'client';

  // Format time
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
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

        {/* Timestamp */}
        <div className="text-xs text-slate-400 mt-1">
          {formatTime(message.createdAt)}
        </div>
      </div>
    </div>
  );
}
