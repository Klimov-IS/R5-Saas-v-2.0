'use client';

import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useChatMessages } from '@/hooks/useChats';
import { MessageBubble } from './MessageBubble';
import { MessageComposer } from './MessageComposer';
import { Loader2, Package, MessageSquare, X } from 'lucide-react';
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

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  // Auto-scroll to bottom when messages load
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, handleClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  const modalContent = (
    <>
      {/* Overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
        }}
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 9999,
          width: '90vw',
          maxWidth: '768px',
          height: '85vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex-shrink-0">
          {isLoading ? (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-lg font-semibold">Загрузка...</span>
            </div>
          ) : chat ? (
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-slate-500" />
                  <h2 className="text-lg font-semibold">{chat.clientName}</h2>
                </div>
                {chat.productName && (
                  <div className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                    <Package className="w-3.5 h-3.5" />
                    {chat.productName}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Status badge */}
                {chat.status && (
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[chat.status as ChatStatus] || 'bg-gray-100 text-gray-700'}`}>
                    {STATUS_LABELS[chat.status as ChatStatus] || chat.status}
                  </span>
                )}
                {/* Close button */}
                <button
                  onClick={handleClose}
                  className="ml-2 p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Чат</h2>
              <button
                onClick={handleClose}
                className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

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
      </div>
    </>
  );

  // Portal directly to document.body — guaranteed to bypass any CSS containing blocks
  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
}
