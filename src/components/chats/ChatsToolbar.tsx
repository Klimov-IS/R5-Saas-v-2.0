'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Table, MessageSquare, LayoutGrid, Zap } from 'lucide-react';
import { useChatsStore } from '@/store/chatsStore';
import { cn } from '@/lib/utils';
import type { ChatStatus, CompletionReason } from '@/db/helpers';

interface ChatsToolbarProps {
  storeId: string;
  statusStats?: {
    inbox: number;
    in_progress: number;
    awaiting_reply: number;
    resolved: number;
    closed: number;
  };
  selectedCount?: number;
  onBulkGenerate?: () => void;
  onBulkSend?: () => void;
  onBulkChangeStatus?: (status: ChatStatus) => void;
  onClearSelection?: () => void;
}

export function ChatsToolbar({
  storeId,
  statusStats,
  selectedCount = 0,
  onBulkGenerate,
  onBulkSend,
  onBulkChangeStatus,
  onClearSelection,
}: ChatsToolbarProps) {
  const {
    viewMode,
    setViewMode,
    statusFilter,
    setStatusFilter,
    lastSender,
    setLastSender,
    hasDraft,
    setHasDraft,
    searchQuery,
    setSearchQuery,
    completionReasonFilter,
    setCompletionReasonFilter
  } = useChatsStore();

  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isActionsOpen, setIsActionsOpen] = useState(false);

  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const filtersDropdownRef = useRef<HTMLDivElement>(null);
  const actionsDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusOpen(false);
      }
      if (filtersDropdownRef.current && !filtersDropdownRef.current.contains(event.target as Node)) {
        setIsFiltersOpen(false);
      }
      if (actionsDropdownRef.current && !actionsDropdownRef.current.contains(event.target as Node)) {
        setIsActionsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStatusSelect = (status: ChatStatus | 'all') => {
    setStatusFilter(status);
    setIsStatusOpen(false);
  };

  const handleLastSenderToggle = (sender: 'client' | 'seller') => {
    // Toggle logic: if clicking the same, turn it off; if clicking different, switch
    if (lastSender === sender) {
      setLastSender('all');
    } else {
      setLastSender(sender);
    }
  };

  const handleDraftToggle = () => {
    setHasDraft(!hasDraft);
  };

  const handleCompletionReasonToggle = (reason: CompletionReason) => {
    // Toggle logic: if clicking the same, turn it off; if clicking different, switch
    if (completionReasonFilter === reason) {
      setCompletionReasonFilter('all');
    } else {
      setCompletionReasonFilter(reason);
    }
  };

  const STATUS_LABELS: Record<ChatStatus, string> = {
    inbox: 'Входящие',
    awaiting_reply: 'Ожидание',
    in_progress: 'В работе',
    closed: 'Закрыто',
  };

  const STATUS_EMOJIS: Record<ChatStatus, string> = {
    inbox: '📥',
    awaiting_reply: '⏳',
    in_progress: '⚙️',
    closed: '🔒',
  };

  const COMPLETION_REASON_CONFIG: Record<CompletionReason, { label: string; icon: string }> = {
    review_deleted: { label: 'Отзыв удален', icon: '🗑️' },
    review_upgraded: { label: 'Отзыв дополнен', icon: '⭐' },
    no_reply: { label: 'Нет ответа', icon: '🔇' },
    old_dialog: { label: 'Старый диалог', icon: '⏰' },
    not_our_issue: { label: 'Не наш вопрос', icon: '❓' },
    spam: { label: 'Спам', icon: '🚫' },
    negative: { label: 'Негатив', icon: '😠' },
    other: { label: 'Другое', icon: '📋' },
  };

  const totalChats = statusStats
    ? Object.values(statusStats).reduce((sum, count) => sum + count, 0)
    : 0;

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 mb-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        {/* Left: Search + Filters */}
        <div className="flex items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative w-full max-w-[320px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="🔍 Поиск по чатам..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Status Filter */}
          <div className="relative" ref={statusDropdownRef}>
            <button
              className={cn(
                'flex items-center gap-2 px-3 py-2 border rounded-md text-sm font-medium transition-all whitespace-nowrap',
                statusFilter !== 'all'
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              )}
              onClick={() => setIsStatusOpen(!isStatusOpen)}
            >
              {statusFilter === 'all' ? 'Статус' : STATUS_LABELS[statusFilter]}
              <ChevronDown className="w-4 h-4" />
            </button>

            {isStatusOpen && (
              <div className="absolute top-full mt-1 left-0 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[220px] z-50 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2">
                <div className="p-2">
                  <button
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm hover:bg-slate-50 transition-colors',
                      statusFilter === 'all' && 'bg-blue-50 text-blue-600'
                    )}
                    onClick={() => handleStatusSelect('all')}
                  >
                    <span className="flex items-center gap-2">
                      📋 <span>Все статусы</span>
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                      {totalChats}
                    </span>
                  </button>
                  {(Object.keys(STATUS_LABELS) as ChatStatus[]).map((status) => (
                    <button
                      key={status}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm hover:bg-slate-50 transition-colors',
                        statusFilter === status && 'bg-blue-50 text-blue-600'
                      )}
                      onClick={() => handleStatusSelect(status)}
                    >
                      <span className="flex items-center gap-2">
                        {STATUS_EMOJIS[status]} <span>{STATUS_LABELS[status]}</span>
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                        {statusStats?.[status] || 0}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Filters Dropdown */}
          <div className="relative" ref={filtersDropdownRef}>
            <button
              className={cn(
                'flex items-center gap-2 px-3 py-2 border rounded-md text-sm font-medium transition-all whitespace-nowrap',
                (hasDraft || lastSender !== 'all' || completionReasonFilter !== 'all')
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              )}
              onClick={() => setIsFiltersOpen(!isFiltersOpen)}
            >
              Фильтры
              <ChevronDown className="w-4 h-4" />
            </button>

            {isFiltersOpen && (
              <div className="absolute top-full mt-1 left-0 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[240px] z-50 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2">
                <div className="p-2">
                  {/* Section 1: Last Sender */}
                  <div className="px-3 py-1 text-xs font-semibold text-slate-500">
                    Последний написал
                  </div>
                  <label className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-slate-50 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lastSender === 'client'}
                      onChange={() => handleLastSenderToggle('client')}
                      className="rounded border-slate-300"
                    />
                    💬 <span>От клиента</span>
                  </label>
                  <label className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-slate-50 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lastSender === 'seller'}
                      onChange={() => handleLastSenderToggle('seller')}
                      className="rounded border-slate-300"
                    />
                    📤 <span>От нас</span>
                  </label>

                  {/* Divider */}
                  <div className="border-t border-slate-200 my-2"></div>

                  {/* Section 2: Has Draft */}
                  <label className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-slate-50 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasDraft}
                      onChange={handleDraftToggle}
                      className="rounded border-slate-300"
                    />
                    📝 <span>С черновиком</span>
                  </label>

                  {/* Divider */}
                  <div className="border-t border-slate-200 my-2"></div>

                  {/* Section 3: Completion Reason (only for closed chats) */}
                  <div className="px-3 py-1 text-xs font-semibold text-slate-500">
                    Причина закрытия
                  </div>
                  {(Object.keys(COMPLETION_REASON_CONFIG) as CompletionReason[]).map((reason) => (
                    <label
                      key={reason}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={completionReasonFilter === reason}
                        onChange={() => handleCompletionReasonToggle(reason)}
                        className="rounded border-slate-300"
                      />
                      {COMPLETION_REASON_CONFIG[reason].icon} <span>{COMPLETION_REASON_CONFIG[reason].label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions Dropdown - Always visible */}
          <div className="relative" ref={actionsDropdownRef}>
            <button
              className={cn(
                "flex items-center gap-2 px-3 py-2 border rounded-md text-sm font-medium transition-all",
                selectedCount > 0
                  ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                  : "bg-gray-100 text-gray-400 border-gray-300 cursor-not-allowed"
              )}
              onClick={() => selectedCount > 0 && setIsActionsOpen(!isActionsOpen)}
              disabled={selectedCount === 0}
              title={selectedCount === 0 ? "Выберите хотя бы один чат" : `Действия с ${selectedCount} чатами`}
            >
              <Zap className="w-4 h-4" />
              Действия {selectedCount > 0 && `(${selectedCount})`}
              <ChevronDown className="w-4 h-4" />
            </button>

            {isActionsOpen && selectedCount > 0 && (
                <div className="absolute top-full mt-1 left-0 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[240px] z-50 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2">
                  <div className="p-2">
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-slate-50 transition-colors text-left"
                      onClick={() => {
                        onBulkGenerate?.();
                        setIsActionsOpen(false);
                      }}
                    >
                      🤖 <span>Генерировать ответы</span>
                    </button>
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-slate-50 transition-colors text-left"
                      onClick={() => {
                        onBulkSend?.();
                        setIsActionsOpen(false);
                      }}
                    >
                      📤 <span>Отправить все</span>
                    </button>
                    <div className="border-t border-slate-200 my-1"></div>
                    <div className="px-3 py-1 text-xs font-semibold text-slate-500">
                      Изменить статус:
                    </div>
                    {(Object.keys(STATUS_LABELS) as ChatStatus[]).map((status) => (
                      <button
                        key={status}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-slate-50 transition-colors text-left"
                        onClick={() => {
                          onBulkChangeStatus?.(status);
                          setIsActionsOpen(false);
                        }}
                      >
                        {STATUS_EMOJIS[status]} <span>{STATUS_LABELS[status]}</span>
                      </button>
                    ))}
                    <div className="border-t border-slate-200 my-1"></div>
                    <button
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-red-50 text-red-600 transition-colors text-left"
                      onClick={() => {
                        onClearSelection?.();
                        setIsActionsOpen(false);
                      }}
                    >
                      ✕ <span>Отменить выбор</span>
                    </button>
                  </div>
                </div>
              )}
          </div>
        </div>

        {/* Right: View Mode Toggle */}
        <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-0.5 gap-0.5">
          <button
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5',
              viewMode === 'kanban'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            )}
            onClick={() => setViewMode('kanban')}
          >
            <LayoutGrid className="w-4 h-4" />
            Канбан
          </button>
          <button
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5',
              viewMode === 'messenger'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            )}
            onClick={() => setViewMode('messenger')}
          >
            <MessageSquare className="w-4 h-4" />
            Чат
          </button>
          <button
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5',
              viewMode === 'table'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            )}
            onClick={() => setViewMode('table')}
          >
            <Table className="w-4 h-4" />
            Таблица
          </button>
        </div>
      </div>
    </div>
  );
}
