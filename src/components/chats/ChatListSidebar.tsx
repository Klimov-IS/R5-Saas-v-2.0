'use client';

import { useChatsStore } from '@/store/chatsStore';
import type { Chat } from '@/types/chats';
import { ChatItem } from './ChatItem';
import { SelectAllCheckbox } from './SelectAllCheckbox';
import { BulkActionsPanel } from './BulkActionsPanel';
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
    selectedChatIds,
    selectAllChats,
    deselectAllChats,
    isSelected,
  } = useChatsStore();

  const allChatIds = chats.map((chat) => chat.id);

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
          chats.map((chat) => (
            <ChatItem
              key={chat.id}
              chat={chat}
              isActive={activeChatId === chat.id}
              onClick={() => setActiveChatId(chat.id)}
            />
          ))
        )}

        {/* Bulk Actions Panel */}
        {!isSidebarCollapsed && <BulkActionsPanel storeId={storeId} />}
      </div>
    </div>
  );
}
