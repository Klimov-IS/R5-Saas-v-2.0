'use client';

import { useEffect, useRef } from 'react';
import { useChatMessages } from '@/hooks/useChats';
import { MessageBubble } from './MessageBubble';
import { MessageComposer } from './MessageComposer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ChatTag } from '@/types/chats';
import { Loader2 } from 'lucide-react';

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
};

export function ConversationPanel({ storeId, chatId }: ConversationPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = useChatMessages(storeId, chatId);

  const chat = data?.chat;
  const messages = data?.messages || [];

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
