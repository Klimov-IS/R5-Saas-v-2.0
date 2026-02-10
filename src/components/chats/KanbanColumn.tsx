'use client';

import { useDroppable } from '@dnd-kit/core';
import DraggableKanbanCard from './DraggableKanbanCard';
import type { ChatStatus, CompletionReason } from '@/db/helpers';

interface Chat {
  id: string;
  clientName: string;
  productName?: string | null;
  lastMessageText?: string | null;
  lastMessageSender?: 'client' | 'seller' | null;
  lastMessageDate?: string | null;
  draftReply?: string | null;
  status: ChatStatus;
  messageCount?: number;
  completionReason?: CompletionReason | null;
}

interface KanbanColumnProps {
  status: ChatStatus;
  title: string;
  chats: Chat[];
  selectedChatIds: Set<string>;
  onSelectChat: (chatId: string, selected: boolean) => void;
  onSelectAll: (chatIds: string[], selected: boolean) => void;
  onChatClick?: (chatId: string) => void;
}

const COLUMN_COLORS: Record<ChatStatus, string> = {
  inbox: 'border-blue-300 bg-blue-50',
  in_progress: 'border-amber-300 bg-amber-50',
  awaiting_reply: 'border-orange-300 bg-orange-50',
  resolved: 'border-green-300 bg-green-50',
  closed: 'border-gray-300 bg-gray-50',
};

const COLUMN_HEADER_COLORS: Record<ChatStatus, string> = {
  inbox: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-amber-100 text-amber-800',
  awaiting_reply: 'bg-orange-100 text-orange-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
};

export default function KanbanColumn({
  status,
  title,
  chats,
  selectedChatIds,
  onSelectChat,
  onSelectAll,
  onChatClick,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  // Check if all chats in this column are selected
  const allSelected = chats.length > 0 && chats.every(chat => selectedChatIds.has(chat.id));
  const someSelected = chats.some(chat => selectedChatIds.has(chat.id)) && !allSelected;

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const chatIds = chats.map(c => c.id);
    onSelectAll(chatIds, e.target.checked);
  };

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col rounded-lg border-2 transition-colors
        ${COLUMN_COLORS[status]}
        ${isOver ? 'border-blue-500 shadow-lg' : ''}
      `}
    >
      {/* Column Header */}
      <div className={`px-4 py-3 rounded-t-lg ${COLUMN_HEADER_COLORS[status]}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Select All Checkbox */}
            <input
              type="checkbox"
              checked={allSelected}
              ref={(input) => {
                if (input) {
                  input.indeterminate = someSelected;
                }
              }}
              onChange={handleSelectAll}
              className="w-4 h-4 cursor-pointer shrink-0"
              title={allSelected ? 'Снять выделение со всех' : 'Выбрать все в колонке'}
            />
            <h3 className="font-semibold text-sm">{title}</h3>
          </div>
          <div className="flex items-center justify-center w-6 h-6 bg-white rounded-full text-xs font-bold">
            {chats.length}
          </div>
        </div>
      </div>

      {/* Cards Container */}
      <div
        className="flex-1 p-3 space-y-3 overflow-y-auto min-h-[500px] max-h-[calc(100vh-280px)]"
      >
        {chats.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
            Нет чатов
          </div>
        ) : (
          chats.map(chat => (
            <DraggableKanbanCard
              key={chat.id}
              id={chat.id}
              clientName={chat.clientName}
              productName={chat.productName}
              lastMessageText={chat.lastMessageText}
              lastMessageSender={chat.lastMessageSender}
              lastMessageDate={chat.lastMessageDate}
              draftReply={chat.draftReply}
              status={chat.status}
              messageCount={chat.messageCount}
              selected={selectedChatIds.has(chat.id)}
              onSelect={onSelectChat}
              completionReason={chat.completionReason}
              onChatClick={onChatClick}
            />
          ))
        )}
      </div>
    </div>
  );
}
