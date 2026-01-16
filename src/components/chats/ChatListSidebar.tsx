'use client';

import { useChatsStore } from '@/store/chatsStore';
import type { Chat } from '@/types/chats';
import { ChatItem } from './ChatItem';
import { FilterPanel } from './FilterPanel';
import { BulkActionsBar } from './BulkActionsBar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

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
}

export function ChatListSidebar({ storeId, chats, tagStats, isLoading }: ChatListSidebarProps) {
  const {
    activeChatId,
    setActiveChatId,
    isSidebarCollapsed,
    toggleSidebar,
    searchQuery,
    setSearchQuery,
  } = useChatsStore();

  const allChatIds = chats.map((chat) => chat.id);

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

        {/* Search */}
        {!isSidebarCollapsed && (
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Поиск по клиенту, товару..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        )}

        {/* Filters Panel */}
        {!isSidebarCollapsed && (
          <FilterPanel storeId={storeId} tagStats={tagStats} />
        )}
      </div>

      {/* Bulk Actions Bar */}
      {!isSidebarCollapsed && <BulkActionsBar allChatIds={allChatIds} />}

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : chats.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-500">
            Чаты не найдены
          </div>
        ) : (
          chats.map((chat) => (
            <ChatItem
              key={chat.id}
              chat={chat}
              isActive={activeChatId === chat.id}
              onClick={() => setActiveChatId(chat.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
