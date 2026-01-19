import { useChatsStore } from '@/store/chatsStore';
import type { Chat } from '@/types/chats';
import { Checkbox } from '@/components/ui/checkbox';
import { FileEdit, MessageCircle } from 'lucide-react';

interface ChatItemProps {
  chat: Chat;
  isActive: boolean;
  onClick: () => void;
}

export function ChatItem({ chat, isActive, onClick }: ChatItemProps) {
  const { isSelected, toggleChatSelection, isSidebarCollapsed } = useChatsStore();
  const selected = isSelected(chat.id);

  // Determine if chat is unread (seller hasn't replied yet)
  const isUnread = chat.lastMessageSender === 'client';

  // Check if chat has draft reply
  const hasDraft = !!chat.draftReply;

  // Format time
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 60) {
      return `${diffMins} мин`;
    } else if (diffHours < 24) {
      return `${diffHours} час`;
    } else {
      const diffDays = Math.floor(diffMs / 86400000);
      return `${diffDays} дн`;
    }
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // Collapsed view
  if (isSidebarCollapsed) {
    return (
      <div
        className={`
          flex items-center justify-center p-3 border-b border-slate-100 cursor-pointer
          transition-all duration-200
          ${isActive ? 'bg-blue-50' : 'hover:bg-slate-50'}
        `}
        onClick={onClick}
      >
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center text-white text-sm font-semibold">
          {chat.clientName.substring(0, 2).toUpperCase()}
        </div>
      </div>
    );
  }

  // Full view
  return (
    <div
      className={`
        relative flex items-start gap-3 p-3 pl-12 border-b border-slate-100 cursor-pointer
        transition-all duration-200
        ${isActive ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-slate-50'}
        ${selected ? 'bg-blue-50 border-l-4 border-l-blue-500 pl-11' : ''}
      `}
      onClick={onClick}
    >
      {/* Checkbox */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2" onClick={handleCheckboxClick}>
        <Checkbox
          checked={selected}
          onCheckedChange={() => {
            toggleChatSelection(chat.id);
          }}
          className="accent-blue-500"
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className={`font-semibold text-sm text-slate-900`}>
              {chat.clientName}
            </span>
          </div>
          <span className="text-xs text-slate-400">
            {formatRelativeTime(chat.lastMessageDate)}
          </span>
        </div>

        {/* Product */}
        <div className="text-xs text-slate-500 mb-1 truncate">
          📦 {chat.productName || `Товар ${chat.productNmId}`}
        </div>

        {/* Last Message and Indicators Container */}
        <div className="flex items-end justify-between gap-2">
          {/* Last Message */}
          <div
            className={`text-sm truncate flex-1 ${
              isUnread ? 'font-semibold text-slate-900' : 'text-slate-600'
            }`}
          >
            <span className="text-slate-500">
              {chat.lastMessageSender === 'seller' ? 'Вы: ' : 'Покупатель: '}
            </span>
            {chat.lastMessageText}
          </div>

          {/* Indicators (bottom right) */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Unread indicator */}
            {isUnread && (
              <MessageCircle className="w-3.5 h-3.5 text-red-500" title="Не отвечен" />
            )}
            {/* Draft indicator */}
            {hasDraft && (
              <FileEdit className="w-3.5 h-3.5 text-blue-500" title="Есть черновик ответа" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
