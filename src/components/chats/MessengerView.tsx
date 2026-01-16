'use client';

import { useChats } from '@/hooks/useChats';
import { useChatsStore } from '@/store/chatsStore';
import { ChatListSidebar } from './ChatListSidebar';
import { ConversationPanel } from './ConversationPanel';
import { Loader2 } from 'lucide-react';

interface MessengerViewProps {
  storeId: string;
  tagStats?: {
    active: number;
    successful: number;
    unsuccessful: number;
    no_reply: number;
    untagged: number;
  };
}

export function MessengerView({ storeId, tagStats: propTagStats }: MessengerViewProps) {
  const { tagFilter, searchQuery, activeChatId } = useChatsStore();

  // Fetch chats
  const { data, isLoading, error } = useChats({
    storeId,
    tag: tagFilter,
    search: searchQuery,
    take: 100, // Load more chats for messenger view
  });

  const chats = data?.data || [];
  const totalCount = data?.totalCount || 0;

  // Calculate tag stats (use props if available, otherwise calculate)
  const tagStats = propTagStats || {
    active: chats.filter((c) => c.tag === 'active').length,
    successful: chats.filter((c) => c.tag === 'successful').length,
    unsuccessful: chats.filter((c) => c.tag === 'unsuccessful').length,
    no_reply: chats.filter((c) => c.tag === 'no_reply').length,
    untagged: chats.filter((c) => c.tag === 'untagged').length,
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
      />

      {/* Right Panel - Conversation */}
      <ConversationPanel storeId={storeId} chatId={activeChatId} />
    </div>
  );
}
