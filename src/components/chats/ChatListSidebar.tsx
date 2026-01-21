'use client';

import { useEffect, useRef } from 'react';
import { useChatsStore } from '@/store/chatsStore';
import type { Chat } from '@/types/chats';
import { ChatItem } from './ChatItem';
import { SelectAllCheckbox } from './SelectAllCheckbox';
import { BulkActionsPanel } from './BulkActionsPanel';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

interface ChatListSidebarProps {
  storeId: string;
  chats: Chat[];
  tagStats?: {
    active: number;
    successful: number;
    unsuccessful: number;
    no_reply: number;
    untagged: number;
  };
  isLoading?: boolean;
  totalCount?: number;
  // ✅ INFINITE SCROLL PROPS
  fetchNextPage?: () => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
}

export function ChatListSidebar({
  storeId,
  chats,
  tagStats,
  isLoading,
  totalCount = 0,
  fetchNextPage,
  hasNextPage,
  isFetchingNextPage,
}: ChatListSidebarProps) {
  const {
    activeChatId,
    setActiveChatId,
    isSidebarCollapsed,
    toggleSidebar,
    searchQuery,
    setSearchQuery,
    selectedChatIds,
    selectAllChats,
    deselectAllChats,
    isSelected,
  } = useChatsStore();

  const allChatIds = chats.map((chat) => chat.id);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // ✅ INFINITE SCROLL: Auto-load when user scrolls to bottom
  useEffect(() => {
    if (!loadMoreRef.current || !hasNextPage || isFetchingNextPage || !fetchNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          console.log('[INFINITE SCROLL] Triggering fetchNextPage');
          fetchNextPage();
        }
      },
      { threshold: 0.5 } // Trigger when 50% visible
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Select all checkbox state
  const isAllSelected = allChatIds.length > 0 && allChatIds.every((id) => isSelected(id));
  const isIndeterminate = allChatIds.some((id) => isSelected(id)) && !isAllSelected;

  const handleSelectAll = () => {
    if (isAllSelected) {
      deselectAllChats();
    } else {
      selectAllChats(allChatIds);
    }
  };

  return (
    <div
      className={`
        flex flex-col border-r border-slate-200 bg-slate-50 transition-all duration-300
        ${isSidebarCollapsed ? 'w-16' : 'w-96'}
      `}
    >
      {/* Sidebar Header */}
      <div className="relative px-4 py-4 border-b border-slate-200 bg-white">
        {/* Collapse Button */}
        <Button
          variant="ghost"
          size="sm"
          className={`
            absolute top-4 right-4 w-7 h-7 p-0
            ${isSidebarCollapsed ? 'static mx-auto' : ''}
          `}
          onClick={toggleSidebar}
          title={isSidebarCollapsed ? 'Развернуть' : 'Свернуть'}
        >
          {isSidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </Button>

        {/* Chat Count Header with Select All */}
        {!isSidebarCollapsed && (
          <div className="flex items-center gap-2 mb-3">
            <SelectAllCheckbox
              checked={isAllSelected}
              indeterminate={isIndeterminate}
              onChange={handleSelectAll}
            />
            <span className="text-sm font-semibold text-slate-700">
              Чаты ({chats.length})
            </span>
          </div>
        )}

        {/* Search */}
        {!isSidebarCollapsed && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Поиск по клиенту, товару..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
            {/* Debounce hint */}
            {searchQuery && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                {isLoading ? '⏳' : '✓'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto relative">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : chats.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            Чаты не найдены
          </div>
        ) : (
          <>
            {chats.map((chat) => (
              <ChatItem
                key={chat.id}
                chat={chat}
                isActive={activeChatId === chat.id}
                onClick={() => setActiveChatId(chat.id)}
              />
            ))}

            {/* ✅ INFINITE SCROLL TRIGGER */}
            {hasNextPage && (
              <div ref={loadMoreRef} className="py-4 px-4">
                {isFetchingNextPage ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-slate-500">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Загрузка...</span>
                  </div>
                ) : (
                  <button
                    onClick={() => fetchNextPage?.()}
                    className="w-full py-2 px-4 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-md font-medium text-sm transition-colors border border-slate-200"
                  >
                    Загрузить ещё ({totalCount - chats.length} осталось)
                  </button>
                )}
              </div>
            )}

            {/* ✅ END OF LIST INDICATOR */}
            {!hasNextPage && chats.length > 0 && (
              <div className="py-4 text-center text-xs text-slate-400">
                Все чаты загружены ({chats.length} из {totalCount})
              </div>
            )}
          </>
        )}

        {/* Bulk Actions Panel */}
        {!isSidebarCollapsed && <BulkActionsPanel storeId={storeId} />}
      </div>
    </div>
  );
}
