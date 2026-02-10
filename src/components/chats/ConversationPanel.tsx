'use client';

import { useEffect, useRef } from 'react';
import { useChatMessages } from '@/hooks/useChats';
import { MessageBubble } from './MessageBubble';
import { MessageComposer } from './MessageComposer';
import { DeletionCaseInfo } from './DeletionCaseInfo';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ChatTag, ChatStatus } from '@/types/chats';
import { Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

interface ConversationPanelProps {
  storeId: string;
  chatId: string | null;
}

const TAG_LABELS: Record<ChatTag, string> = {
  active: '🟢 Активный',
  successful: '🔵 Успешный',
  unsuccessful: '🔴 Неуспешный',
  no_reply: '🟡 Нет ответа',
  untagged: '⚪ Не размечено',
  completed: '✅ Завершён',
  // Deletion workflow tags
  deletion_candidate: '🎯 Кандидат на удаление',
  deletion_offered: '💰 Предложена компенсация',
  deletion_agreed: '🤝 Клиент согласился',
  deletion_confirmed: '✔️ Отзыв удалён',
  refund_requested: '💸 Запрос возврата',
  spam: '🚫 Спам',
};

const STATUS_LABELS: Record<ChatStatus, string> = {
  inbox: 'Входящие',
  in_progress: 'В работе',
  awaiting_reply: 'Ожидание',
  resolved: 'Решено',
  closed: 'Закрыто',
};

const STATUS_COLORS: Record<ChatStatus, string> = {
  inbox: 'bg-blue-100 text-blue-700 border-blue-200',
  in_progress: 'bg-amber-100 text-amber-700 border-amber-200',
  awaiting_reply: 'bg-orange-100 text-orange-700 border-orange-200',
  resolved: 'bg-green-100 text-green-700 border-green-200',
  closed: 'bg-gray-100 text-gray-600 border-gray-200',
};

export function ConversationPanel({ storeId, chatId }: ConversationPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useChatMessages(storeId, chatId);

  const chat = data?.chat;
  const messages = data?.messages || [];

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle status change
  const handleStatusChange = async (newStatus: string) => {
    if (!chatId) return;

    try {
      const response = await fetch(`/api/stores/${storeId}/chats/${chatId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update status');

      // Invalidate caches
      queryClient.invalidateQueries({ queryKey: ['chat-messages', storeId, chatId] });
      queryClient.invalidateQueries({ queryKey: ['all-chats', storeId] });
      queryClient.invalidateQueries({ queryKey: ['chats-stats', storeId] });
      queryClient.invalidateQueries({ queryKey: ['chats-infinite', storeId] });

      toast.success(`Статус изменён: ${STATUS_LABELS[newStatus as ChatStatus]}`);
    } catch (error) {
      toast.error('Не удалось изменить статус');
      console.error('Failed to update status:', error);
    }
  };

  // Empty state - no chat selected
  if (!chatId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 text-slate-400">
        <div className="text-6xl mb-4">💬</div>
        <h3 className="text-lg font-semibold text-slate-600 mb-2">
          Выберите чат
        </h3>
        <p className="text-sm">
          Выберите чат из списка слева, чтобы увидеть переписку
        </p>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 text-red-500">
        <p className="text-lg font-semibold mb-2">Ошибка загрузки чата</p>
        <p className="text-sm text-slate-500">{(error as Error).message}</p>
      </div>
    );
  }

  // No chat found
  if (!chat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-400">
        <p>Чат не найден</p>
      </div>
    );
  }

  const currentStatus = (chat.status as ChatStatus) || 'inbox';

  return (
    <div className="flex-1 flex flex-col">
      {/* Conversation Header */}
      <div className="px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {chat.clientName}
            </h2>
            <div className="text-sm text-slate-500">
              📦 {chat.productName || `Товар ${chat.productNmId}`} (WB: {chat.productNmId})
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Status Selector */}
            <Select
              value={currentStatus}
              onValueChange={handleStatusChange}
            >
              <SelectTrigger className={`w-40 h-8 text-xs font-medium border ${STATUS_COLORS[currentStatus]}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                      key === 'inbox' ? 'bg-blue-500' :
                      key === 'in_progress' ? 'bg-amber-500' :
                      key === 'awaiting_reply' ? 'bg-orange-500' :
                      key === 'resolved' ? 'bg-green-500' :
                      'bg-gray-400'
                    }`} />
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Tag Selector */}
            <Select
              value={chat.tag}
              onValueChange={(value) => {
                // TODO: Update chat tag via API
                console.log('Update tag to:', value);
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TAG_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Deletion Case Info */}
        {/* TODO: Вернуть плашку "Кандидат на удаление" с улучшенным дизайном */}
        {/* <DeletionCaseInfo storeId={storeId} chatId={chatId} chatTag={chat.tag} /> */}
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-6 py-6 bg-slate-50">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400">
            <p>Нет сообщений</p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Composer */}
      <MessageComposer storeId={storeId} chatId={chatId} />
    </div>
  );
}
