'use client';

import { useEffect, useRef } from 'react';
import { useChatMessages } from '@/hooks/useChats';
import { MessageBubble } from './MessageBubble';
import { MessageComposer } from './MessageComposer';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Package, MessageSquare } from 'lucide-react';
import type { ChatStatus } from '@/db/helpers';

interface ChatPreviewModalProps {
  storeId: string;
  chatId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_LABELS: Record<ChatStatus, string> = {
  inbox: 'Входящие',
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

export function ChatPreviewModal({ storeId, chatId, open, onOpenChange }: ChatPreviewModalProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = useChatMessages(storeId, open ? chatId : null);

  const chat = data?.chat;
  const messages = data?.messages || [];

  // Auto-scroll to bottom when messages load
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-slate-200 flex-shrink-0">
          {isLoading ? (
            <DialogTitle className="flex items-center gap-2 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Загрузка...
            </DialogTitle>
          ) : chat ? (
            <div className="flex items-start justify-between pr-8">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-slate-500" />
                  {chat.clientName}
                </DialogTitle>
                {chat.productName && (
                  <div className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                    <Package className="w-3.5 h-3.5" />
                    {chat.productName}
                  </div>
                )}
              </div>
              {/* Status badge */}
              {chat.status && (
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[chat.status as ChatStatus] || 'bg-gray-100 text-gray-700'}`}>
                  {STATUS_LABELS[chat.status as ChatStatus] || chat.status}
                </span>
              )}
            </div>
          ) : (
            <DialogTitle>Чат</DialogTitle>
          )}
        </DialogHeader>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 bg-slate-50">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-red-500">
              <p>Ошибка загрузки: {(error as Error).message}</p>
            </div>
          ) : messages.length === 0 ? (
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

        {/* Composer */}
        {chatId && chat && chat.status !== 'closed' && (
          <div className="flex-shrink-0">
            <MessageComposer storeId={storeId} chatId={chatId} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
