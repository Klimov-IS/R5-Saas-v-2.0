'use client';

import { useChatsInfinite } from '@/hooks/useChats';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useChatsStore } from '@/store/chatsStore';
import { ChatListSidebar } from './ChatListSidebar';
import { ConversationPanel } from './ConversationPanel';
import { Loader2 } from 'lucide-react';

import { TagStats } from '@/types/chats';

interface MessengerViewProps {
  storeId: string;
  tagStats?: TagStats;
}

export function MessengerView({ storeId, tagStats: propTagStats }: MessengerViewProps) {
  const { statusFilter, lastSender, hasDraft, searchQuery, activeChatId } = useChatsStore();

  // 🎯 DEBOUNCE SEARCH: Задержка 300ms перед API запросом
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);

  // ✅ INFINITE SCROLL: Fetch chats with automatic pagination
  const {
    data,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useChatsInfinite({
    storeId,
    status: statusFilter,
    sender: lastSender,
    hasDraft,
    search: debouncedSearchQuery,
    take: 50, // Load 50 chats per page (optimal for performance)
  });

  // ✅ FLATTEN PAGES: Combine all pages into single array
  const chats = data?.pages.flatMap(page => page.data) || [];
  const totalCount = data?.pages[0]?.totalCount || 0;

  // Calculate tag stats (use props if available, otherwise calculate)
  const tagStats: TagStats = propTagStats || {
    active: chats.filter((c) => c.tag === 'active').length,
    successful: chats.filter((c) => c.tag === 'successful').length,
    unsuccessful: chats.filter((c) => c.tag === 'unsuccessful').length,
    no_reply: chats.filter((c) => c.tag === 'no_reply').length,
    untagged: chats.filter((c) => c.tag === 'untagged').length,
    completed: chats.filter((c) => c.tag === 'completed').length,
    deletion_candidate: chats.filter((c) => c.tag === 'deletion_candidate').length,
    deletion_offered: chats.filter((c) => c.tag === 'deletion_offered').length,
    deletion_agreed: chats.filter((c) => c.tag === 'deletion_agreed').length,
    deletion_confirmed: chats.filter((c) => c.tag === 'deletion_confirmed').length,
    refund_requested: chats.filter((c) => c.tag === 'refund_requested').length,
    spam: chats.filter((c) => c.tag === 'spam').length,
  };

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full bg-white rounded-lg border-2 border-red-200 p-8">
        <div className="text-center">
          <p className="text-red-600 font-semibold mb-2">Ошибка загрузки чатов</p>
          <p className="text-sm text-slate-500">{(error as Error).message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-200px)] min-h-[600px] bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      {/* Left Sidebar - Chat List */}
      <ChatListSidebar
        storeId={storeId}
        chats={chats}
        tagStats={tagStats}
        isLoading={isLoading}
        totalCount={totalCount}
        // ✅ INFINITE SCROLL PROPS
        fetchNextPage={fetchNextPage}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
      />

      {/* Right Panel - Conversation */}
      <ConversationPanel storeId={storeId} chatId={activeChatId} />
    </div>
  );
}
