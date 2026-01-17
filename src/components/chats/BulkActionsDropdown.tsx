'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Mail, Tag, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BulkActionsDropdownProps {
  selectedCount: number;
  onAction: (action: 'generate' | 'send' | 'mark-unread' | 'change-tag') => void;
  className?: string;
}

export function BulkActionsDropdown({
  selectedCount,
  onAction,
  className,
}: BulkActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAction = (action: 'generate' | 'send' | 'mark-unread' | 'change-tag') => {
    onAction(action);
    setIsOpen(false);
  };

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      <button
        className="flex items-center gap-2 px-4 py-2 bg-white text-slate-700 rounded-md border border-slate-200 hover:bg-slate-50 transition-all shadow-sm font-medium text-sm"
        onClick={() => setIsOpen(!isOpen)}
      >
        ⚡ Действия
        <ChevronUp
          className={cn(
            'w-4 h-4 transition-transform',
            isOpen ? 'rotate-0' : 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 right-0 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[280px] overflow-hidden animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2">
          {/* Generate AI */}
          <button
            className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-100"
            onClick={() => handleAction('generate')}
          >
            <Bot className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-sm text-slate-900">
                Сгенерировать AI ответы
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Deepseek создаст ответы для выбранных чатов
              </div>
            </div>
          </button>

          {/* Send Messages */}
          <button
            className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-100"
            onClick={() => handleAction('send')}
          >
            <Send className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-sm text-slate-900">
                Отправить сообщения
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Отправить готовые ответы в чаты
              </div>
            </div>
          </button>

          {/* Mark Unread */}
          <button
            className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-100"
            onClick={() => handleAction('mark-unread')}
          >
            <Mail className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-sm text-slate-900">
                Отметить непрочитанным
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Вернуть чаты в список непрочитанных
              </div>
            </div>
          </button>

          {/* Change Tag */}
          <button
            className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
            onClick={() => handleAction('change-tag')}
          >
            <Tag className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-medium text-sm text-slate-900">
                Изменить тег
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Присвоить новый тег выбранным чатам
              </div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
