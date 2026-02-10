'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { useChatMessages } from '@/hooks/useChats';
import { MessageBubble } from './MessageBubble';
import { MessageComposer } from './MessageComposer';
import { Loader2, Package, MessageSquare, X, ChevronDown } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import type { ChatStatus } from '@/db/helpers';

interface ChatPreviewModalProps {
  storeId: string;
  chatId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_LABELS: Record<ChatStatus, string> = {
  inbox: 'Входящие',
  awaiting_reply: 'Ожидание',
  in_progress: 'В работе',
  closed: 'Закрыто',
};

const STATUS_COLORS: Record<ChatStatus, string> = {
  inbox: 'bg-blue-100 text-blue-700 border-blue-200',
  awaiting_reply: 'bg-orange-100 text-orange-700 border-orange-200',
  in_progress: 'bg-amber-100 text-amber-700 border-amber-200',
  closed: 'bg-gray-100 text-gray-600 border-gray-200',
};

const STATUS_DOT_COLORS: Record<ChatStatus, string> = {
  inbox: 'bg-blue-500',
  awaiting_reply: 'bg-orange-500',
  in_progress: 'bg-amber-500',
  closed: 'bg-gray-400',
};

const ALL_STATUSES: ChatStatus[] = ['inbox', 'awaiting_reply', 'in_progress', 'closed'];

export function ChatPreviewModal({ storeId, chatId, open, onOpenChange }: ChatPreviewModalProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [optimisticStatus, setOptimisticStatus] = useState<ChatStatus | null>(null);

  const { data, isLoading, error } = useChatMessages(storeId, open ? chatId : null);

  const chat = data?.chat;
  const messages = data?.messages || [];
  const currentStatus: ChatStatus = optimisticStatus || (chat?.status as ChatStatus) || 'inbox';

  // Reset optimistic status when chat data changes
  useEffect(() => {
    setOptimisticStatus(null);
  }, [chat?.status]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setStatusDropdownOpen(false);
  }, [onOpenChange]);

  // Handle status change
  const handleStatusChange = async (newStatus: ChatStatus) => {
    if (!chatId || newStatus === currentStatus) {
      setStatusDropdownOpen(false);
      return;
    }

    setStatusDropdownOpen(false);
    setOptimisticStatus(newStatus);

    try {
      const response = await fetch(`/api/stores/${storeId}/chats/${chatId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update status');

      queryClient.invalidateQueries({ queryKey: ['chat-messages', storeId, chatId] });
      queryClient.invalidateQueries({ queryKey: ['all-chats', storeId] });
      queryClient.invalidateQueries({ queryKey: ['chats-stats', storeId] });
      queryClient.invalidateQueries({ queryKey: ['chats-infinite', storeId] });

      toast.success(`Статус: ${STATUS_LABELS[newStatus]}`);
    } catch (error) {
      setOptimisticStatus(null);
      toast.error('Не удалось изменить статус');
      console.error('Failed to update status:', error);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    if (!statusDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setStatusDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [statusDropdownOpen]);

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
                {/* Status dropdown */}
                <div ref={statusDropdownRef} className="relative">
                  <button
                    onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                    className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border cursor-pointer transition-all hover:shadow-sm ${STATUS_COLORS[currentStatus]}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${STATUS_DOT_COLORS[currentStatus]}`} />
                    {STATUS_LABELS[currentStatus]}
                    <ChevronDown className={`w-3 h-3 transition-transform ${statusDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {statusDropdownOpen && (
                    <div
                      className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-10"
                    >
                      {ALL_STATUSES.map((s) => (
                        <button
                          key={s}
                          onClick={() => handleStatusChange(s)}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50 transition-colors ${
                            s === currentStatus ? 'bg-slate-50 font-medium' : ''
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT_COLORS[s]}`} />
                          {STATUS_LABELS[s]}
                          {s === currentStatus && (
                            <span className="ml-auto text-xs text-slate-400">✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Close button */}
                <button
                  onClick={handleClose}
                  className="ml-1 p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
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
