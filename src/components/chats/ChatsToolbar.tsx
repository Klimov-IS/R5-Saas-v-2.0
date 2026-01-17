'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Table, MessageSquare } from 'lucide-react';
import { useChatsStore } from '@/store/chatsStore';
import { cn } from '@/lib/utils';

interface ChatsToolbarProps {
  storeId: string;
  tagStats?: {
    active: number;
    successful: number;
    unsuccessful: number;
    no_reply: number;
    untagged: number;
    completed?: number;
    deletion_candidate?: number;
    deletion_offered?: number;
    deletion_agreed?: number;
    deletion_confirmed?: number;
    refund_requested?: number;
    spam?: number;
  };
}

export function ChatsToolbar({ storeId, tagStats }: ChatsToolbarProps) {
  const { viewMode, setViewMode, tagFilter, setTagFilter, searchQuery, setSearchQuery } = useChatsStore();
  const [isTagsOpen, setIsTagsOpen] = useState(false);
  const [isDeletionOpen, setIsDeletionOpen] = useState(false);

  const tagsDropdownRef = useRef<HTMLDivElement>(null);
  const deletionDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tagsDropdownRef.current && !tagsDropdownRef.current.contains(event.target as Node)) {
        setIsTagsOpen(false);
      }
      if (deletionDropdownRef.current && !deletionDropdownRef.current.contains(event.target as Node)) {
        setIsDeletionOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTagSelect = (tag: string) => {
    setTagFilter(tag as any);
    setIsTagsOpen(false);
  };

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

          {/* Tags Dropdown */}
          <div className="relative" ref={tagsDropdownRef}>
            <button
              className={cn(
                'flex items-center gap-2 px-3 py-2 border rounded-md text-sm font-medium transition-all',
                tagFilter !== 'all' && tagFilter !== 'deletion_candidate' && tagFilter !== 'deletion_offered' && tagFilter !== 'deletion_agreed' && tagFilter !== 'deletion_confirmed' && tagFilter !== 'refund_requested' && tagFilter !== 'spam'
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              )}
              onClick={() => {
                setIsTagsOpen(!isTagsOpen);
                setIsDeletionOpen(false);
              }}
            >
              Теги
              <ChevronDown className="w-4 h-4" />
            </button>

            {isTagsOpen && (
              <div className="absolute top-full mt-1 left-0 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[280px] z-50 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2">
                <div className="p-2">
                  <button
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm hover:bg-slate-50 transition-colors',
                      tagFilter === 'all' && 'bg-blue-50 text-blue-600'
                    )}
                    onClick={() => handleTagSelect('all')}
                  >
                    <span className="flex items-center gap-2">
                      📋 <span>Все чаты</span>
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                      {(tagStats?.active || 0) + (tagStats?.successful || 0) + (tagStats?.unsuccessful || 0) + (tagStats?.no_reply || 0) + (tagStats?.untagged || 0)}
                    </span>
                  </button>
                  <button
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm hover:bg-slate-50 transition-colors',
                      tagFilter === 'active' && 'bg-blue-50 text-blue-600'
                    )}
                    onClick={() => handleTagSelect('active')}
                  >
                    <span className="flex items-center gap-2">
                      🟢 <span>Активные</span>
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                      {tagStats?.active || 0}
                    </span>
                  </button>
                  <button
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm hover:bg-slate-50 transition-colors',
                      tagFilter === 'no_reply' && 'bg-blue-50 text-blue-600'
                    )}
                    onClick={() => handleTagSelect('no_reply')}
                  >
                    <span className="flex items-center gap-2">
                      🟡 <span>Нет ответа</span>
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                      {tagStats?.no_reply || 0}
                    </span>
                  </button>
                  <button
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm hover:bg-slate-50 transition-colors',
                      tagFilter === 'successful' && 'bg-blue-50 text-blue-600'
                    )}
                    onClick={() => handleTagSelect('successful')}
                  >
                    <span className="flex items-center gap-2">
                      🔵 <span>Успешные</span>
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                      {tagStats?.successful || 0}
                    </span>
                  </button>
                  <button
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm hover:bg-slate-50 transition-colors',
                      tagFilter === 'unsuccessful' && 'bg-blue-50 text-blue-600'
                    )}
                    onClick={() => handleTagSelect('unsuccessful')}
                  >
                    <span className="flex items-center gap-2">
                      🔴 <span>Неуспешные</span>
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                      {tagStats?.unsuccessful || 0}
                    </span>
                  </button>
                  <button
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm hover:bg-slate-50 transition-colors',
                      tagFilter === 'completed' && 'bg-blue-50 text-blue-600'
                    )}
                    onClick={() => handleTagSelect('completed')}
                  >
                    <span className="flex items-center gap-2">
                      ✅ <span>Завершенные</span>
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                      {tagStats?.completed || 0}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Deletion Dropdown */}
          <div className="relative" ref={deletionDropdownRef}>
            <button
              className={cn(
                'flex items-center gap-2 px-3 py-2 border rounded-md text-sm font-medium transition-all',
                ['deletion_candidate', 'deletion_offered', 'deletion_agreed', 'deletion_confirmed', 'refund_requested', 'spam'].includes(tagFilter)
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              )}
              onClick={() => {
                setIsDeletionOpen(!isDeletionOpen);
                setIsTagsOpen(false);
              }}
            >
              🎯 Удаление
              <ChevronDown className="w-4 h-4" />
            </button>

            {isDeletionOpen && (
              <div className="absolute top-full mt-1 left-0 bg-white border border-slate-200 rounded-lg shadow-lg min-w-[280px] z-50 animate-in fade-in-0 zoom-in-95 slide-in-from-top-2">
                <div className="p-2">
                  <div className="px-3 py-2 text-xs font-semibold text-slate-500 uppercase">
                    Воронка удаления отзывов
                  </div>
                  <button
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm hover:bg-slate-50 transition-colors',
                      tagFilter === 'deletion_candidate' && 'bg-blue-50 text-blue-600'
                    )}
                    onClick={() => handleTagSelect('deletion_candidate')}
                  >
                    <span className="flex items-center gap-2">
                      🎯 <span>Кандидаты</span>
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                      {tagStats?.deletion_candidate || 0}
                    </span>
                  </button>
                  <button
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm hover:bg-slate-50 transition-colors',
                      tagFilter === 'deletion_offered' && 'bg-blue-50 text-blue-600'
                    )}
                    onClick={() => handleTagSelect('deletion_offered')}
                  >
                    <span className="flex items-center gap-2">
                      💰 <span>Предложена компенсация</span>
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                      {tagStats?.deletion_offered || 0}
                    </span>
                  </button>
                  <button
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm hover:bg-slate-50 transition-colors',
                      tagFilter === 'deletion_agreed' && 'bg-blue-50 text-blue-600'
                    )}
                    onClick={() => handleTagSelect('deletion_agreed')}
                  >
                    <span className="flex items-center gap-2">
                      🤝 <span>Согласились</span>
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                      {tagStats?.deletion_agreed || 0}
                    </span>
                  </button>
                  <button
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm hover:bg-slate-50 transition-colors',
                      tagFilter === 'deletion_confirmed' && 'bg-blue-50 text-blue-600'
                    )}
                    onClick={() => handleTagSelect('deletion_confirmed')}
                  >
                    <span className="flex items-center gap-2">
                      ✔️ <span>Подтверждено</span>
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                      {tagStats?.deletion_confirmed || 0}
                    </span>
                  </button>
                  <button
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm hover:bg-slate-50 transition-colors',
                      tagFilter === 'refund_requested' && 'bg-blue-50 text-blue-600'
                    )}
                    onClick={() => handleTagSelect('refund_requested')}
                  >
                    <span className="flex items-center gap-2">
                      💸 <span>Возврат</span>
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                      {tagStats?.refund_requested || 0}
                    </span>
                  </button>
                  <button
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-md text-sm hover:bg-slate-50 transition-colors',
                      tagFilter === 'spam' && 'bg-blue-50 text-blue-600'
                    )}
                    onClick={() => handleTagSelect('spam')}
                  >
                    <span className="flex items-center gap-2">
                      🚫 <span>Спам</span>
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                      {tagStats?.spam || 0}
                    </span>
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
              viewMode === 'table'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-50'
            )}
            onClick={() => setViewMode('table')}
          >
            <Table className="w-4 h-4" />
            Таблица
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
        </div>
      </div>
    </div>
  );
}
