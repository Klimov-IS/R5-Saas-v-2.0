'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { ChatStatus, CompletionReason } from '@/db/helpers';

interface ChatKanbanCardProps {
  id: string;
  clientName: string;
  productName?: string | null;
  lastMessageText?: string | null;
  lastMessageSender?: 'client' | 'seller' | null;
  lastMessageDate?: string | null;
  draftReply?: string | null;
  status: ChatStatus;
  messageCount?: number;
  selected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  completionReason?: CompletionReason | null;
}

const STATUS_LABELS: Record<ChatStatus, string> = {
  inbox: 'Новый',
  in_progress: 'В работе',
  awaiting_reply: 'Ожидание',
  resolved: 'Решено',
  closed: 'Закрыто',
};

const STATUS_COLORS: Record<ChatStatus, string> = {
  inbox: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  awaiting_reply: 'bg-orange-100 text-orange-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-700',
};

const COMPLETION_REASON_CONFIG: Record<CompletionReason, { label: string; icon: string; color: string }> = {
  review_deleted: { label: 'Отзыв удален', icon: '🗑️', color: 'bg-green-100 text-green-700 border-green-300' },
  review_upgraded: { label: 'Отзыв дополнен', icon: '⭐', color: 'bg-green-100 text-green-700 border-green-300' },
  no_reply: { label: 'Нет ответа', icon: '🔇', color: 'bg-gray-100 text-gray-600 border-gray-300' },
  old_dialog: { label: 'Старый диалог', icon: '⏰', color: 'bg-gray-100 text-gray-600 border-gray-300' },
  not_our_issue: { label: 'Не наш вопрос', icon: '❓', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  spam: { label: 'Спам', icon: '🚫', color: 'bg-red-100 text-red-700 border-red-300' },
  negative: { label: 'Негатив', icon: '😠', color: 'bg-red-100 text-red-700 border-red-300' },
  other: { label: 'Другое', icon: '📋', color: 'bg-gray-100 text-gray-600 border-gray-300' },
};

export default function ChatKanbanCard({
  id,
  clientName,
  productName,
  lastMessageText,
  lastMessageSender,
  lastMessageDate,
  draftReply,
  status,
  messageCount = 0,
  selected = false,
  onSelect,
  completionReason,
}: ChatKanbanCardProps) {
  const [draftExpanded, setDraftExpanded] = useState(false);
  const [messageExpanded, setMessageExpanded] = useState(false);

  // Calculate waiting time if status is awaiting_reply
  const waitingTime = lastMessageDate && status === 'awaiting_reply' && lastMessageSender === 'seller'
    ? formatDistanceToNow(new Date(lastMessageDate), { locale: ru })
    : null;

  // Time since last message
  const timeSince = lastMessageDate
    ? formatDistanceToNow(new Date(lastMessageDate), { locale: ru, addSuffix: false })
    : '';

  return (
    <div
      className={`
        bg-white rounded-lg border p-3 cursor-grab transition-all duration-150
        hover:shadow-md hover:border-gray-300 hover:-translate-y-0.5
        active:cursor-grabbing
        ${selected ? 'border-blue-500 bg-blue-50 shadow-sm ring-2 ring-blue-200' : 'border-gray-200'}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => {
            e.stopPropagation();
            onSelect?.(id, e.target.checked);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="w-4 h-4 cursor-pointer shrink-0 mt-0.5"
        />
        <div className="flex-1 font-semibold text-sm text-gray-900">
          {clientName}
        </div>
        <div className="text-xs text-gray-500 whitespace-nowrap">
          {timeSince}
        </div>
      </div>

      {/* Product Name */}
      {productName && (
        <div className="text-xs text-gray-600 mb-2 line-clamp-1">
          📦 {productName}
        </div>
      )}

      {/* Last Message */}
      {lastMessageText && (
        <div
          className="bg-gray-50 border-l-2 border-gray-300 p-2 mb-2 rounded text-xs text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors"
          onClick={() => setMessageExpanded(!messageExpanded)}
        >
          <div className="flex items-center justify-between mb-1">
            <strong className="text-[11px]">
              {lastMessageSender === 'client' ? '💬 Клиент' : '📤 Вы'}
            </strong>
            <span
              className="text-[10px] text-gray-500 transition-transform"
              style={{ transform: messageExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              ▼
            </span>
          </div>
          <div className={`text-gray-800 leading-snug transition-all ${messageExpanded ? '' : 'line-clamp-2'}`}>
            {lastMessageText}
          </div>
          {waitingTime && (
            <span className="inline-block mt-1.5 text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
              ⏰ {waitingTime}
            </span>
          )}
        </div>
      )}

      {/* Draft Preview */}
      {draftReply && (
        <div
          className="bg-yellow-50 border-l-2 border-yellow-500 p-2 mb-2 rounded text-xs text-yellow-900 cursor-pointer hover:bg-yellow-100 transition-colors"
          onClick={() => setDraftExpanded(!draftExpanded)}
        >
          <div className="flex items-center justify-between mb-1 font-semibold">
            <span className="flex items-center gap-1">
              ✏️ Черновик ответа
              <span className="text-[9px] font-bold bg-yellow-200 text-yellow-800 px-1.5 py-0.5 rounded">
                AI
              </span>
            </span>
            <span className="text-[10px] text-yellow-600 transition-transform" style={{ transform: draftExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
              ▼
            </span>
          </div>
          <div className={`text-yellow-800 leading-snug transition-all ${draftExpanded ? '' : 'line-clamp-2'}`}>
            {draftReply}
          </div>
        </div>
      )}

      {/* Completion Reason Badge (for closed chats) */}
      {status === 'closed' && completionReason && (
        <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded border text-xs font-medium ${COMPLETION_REASON_CONFIG[completionReason].color}`}>
          <span className="text-sm">{COMPLETION_REASON_CONFIG[completionReason].icon}</span>
          <span>{COMPLETION_REASON_CONFIG[completionReason].label}</span>
        </div>
      )}

    </div>
  );
}
