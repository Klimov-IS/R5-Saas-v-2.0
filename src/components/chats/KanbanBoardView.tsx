'use client';

import { useState, useMemo, useImperativeHandle, forwardRef } from 'react';
import { DndContext, DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import KanbanColumn from './KanbanColumn';
import ChatKanbanCard from './ChatKanbanCard';
import { useRouter } from 'next/navigation';
import type { ChatStatus } from '@/db/helpers';
import { useChatsStore } from '@/store/chatsStore';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

interface Chat {
  id: string;
  storeId: string;
  clientName: string;
  productName?: string | null;
  lastMessageText?: string | null;
  lastMessageSender?: 'client' | 'seller' | null;
  lastMessageDate?: string | null;
  draftReply?: string | null;
  status: ChatStatus;
  messageCount?: number;
}

interface KanbanBoardViewProps {
  chats: Chat[];
  storeId: string;
}

export interface KanbanBoardViewRef {
  selectedCount: number;
  handleBulkGenerate: () => void;
  handleBulkSend: () => void;
  handleBulkChangeStatus: (status: ChatStatus) => void;
  clearSelection: () => void;
}

const COLUMNS: { status: ChatStatus; title: string }[] = [
  { status: 'inbox', title: 'Входящие' },
  { status: 'in_progress', title: 'В работе' },
  { status: 'awaiting_reply', title: 'Ожидание' },
  { status: 'resolved', title: 'Решено' },
  { status: 'closed', title: 'Закрыто' },
];

const KanbanBoardView = forwardRef<KanbanBoardViewRef, KanbanBoardViewProps>(
  function KanbanBoardView({ chats, storeId }, ref) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { selectedChatIds, toggleChatSelection, selectAllChats, deselectAllChats, isSelected } = useChatsStore();
    const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Group chats by status
  const chatsByStatus = useMemo(() => {
    const grouped: Record<ChatStatus, Chat[]> = {
      inbox: [],
      in_progress: [],
      awaiting_reply: [],
      resolved: [],
      closed: [],
    };

    chats.forEach(chat => {
      grouped[chat.status]?.push(chat);
    });

    return grouped;
  }, [chats]);

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const chatId = active.id as string;
    const newStatus = over.id as ChatStatus;

    // Update status via API
    const loadingToast = toast.loading('Обновление статуса...');
    try {
      const response = await fetch(`/api/stores/${storeId}/chats/${chatId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error('Failed to update status');

      // ✅ Invalidate React Query cache instead of full page reload
      queryClient.invalidateQueries({ queryKey: ['all-chats', storeId] });
      queryClient.invalidateQueries({ queryKey: ['chats-stats', storeId] });
      queryClient.invalidateQueries({ queryKey: ['chats-infinite', storeId] });

      toast.success('Статус обновлён', { id: loadingToast });
    } catch (error) {
      console.error('Failed to update chat status:', error);
      toast.error('Не удалось обновить статус чата', { id: loadingToast });
    }
  };

  // Handle chat selection
  const handleSelectChat = (chatId: string, selected: boolean) => {
    toggleChatSelection(chatId);
  };

  // Handle select all chats in a column
  const handleSelectAll = (chatIds: string[], selected: boolean) => {
    if (selected) {
      // Add all to existing selection
      const currentIds = Array.from(selectedChatIds);
      const allIds = [...new Set([...currentIds, ...chatIds])];
      selectAllChats(allIds);
    } else {
      // Remove these IDs from selection
      const remainingIds = Array.from(selectedChatIds).filter(id => !chatIds.includes(id));
      if (remainingIds.length === 0) {
        deselectAllChats();
      } else {
        selectAllChats(remainingIds);
      }
    }
  };

  // Bulk actions
  const handleBulkGenerate = async () => {
    if (selectedChatIds.size === 0) {
      toast.error('Выберите хотя бы один чат');
      return;
    }

    const loadingToast = toast.loading(`Генерация ответов для ${selectedChatIds.size} чатов...`);
    try {
      const response = await fetch(`/api/stores/${storeId}/chats/bulk-actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatIds: Array.from(selectedChatIds),
          action: 'generate',
        }),
      });

      if (!response.ok) throw new Error('Failed to generate');

      const result = await response.json();
      toast.success(`Генерация завершена: ${result.results.successful}/${result.results.total}`, { id: loadingToast });
      deselectAllChats();

      // ✅ Invalidate React Query cache instead of full page reload
      queryClient.invalidateQueries({ queryKey: ['all-chats', storeId] });
      queryClient.invalidateQueries({ queryKey: ['chats-stats', storeId] });
      queryClient.invalidateQueries({ queryKey: ['chats-infinite', storeId] });
    } catch (error) {
      console.error('Bulk generate failed:', error);
      toast.error('Не удалось сгенерировать ответы', { id: loadingToast });
    }
  };

  const handleBulkSend = async () => {
    if (selectedChatIds.size === 0) {
      toast.error('Выберите хотя бы один чат');
      return;
    }

    const loadingToast = toast.loading(`Отправка сообщений в ${selectedChatIds.size} чатов...`);
    try {
      const response = await fetch(`/api/stores/${storeId}/chats/bulk-actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatIds: Array.from(selectedChatIds),
          action: 'send',
        }),
      });

      if (!response.ok) throw new Error('Failed to send');

      const result = await response.json();
      toast.success(`Отправка завершена: ${result.results.successful}/${result.results.total}`, { id: loadingToast });
      deselectAllChats();

      // ✅ Invalidate React Query cache instead of full page reload
      queryClient.invalidateQueries({ queryKey: ['all-chats', storeId] });
      queryClient.invalidateQueries({ queryKey: ['chats-stats', storeId] });
      queryClient.invalidateQueries({ queryKey: ['chats-infinite', storeId] });
    } catch (error) {
      console.error('Bulk send failed:', error);
      toast.error('Не удалось отправить сообщения', { id: loadingToast });
    }
  };

  const handleBulkChangeStatus = async (newStatus: ChatStatus) => {
    if (selectedChatIds.size === 0) {
      toast.error('Выберите хотя бы один чат');
      return;
    }

    const loadingToast = toast.loading(`Изменение статуса для ${selectedChatIds.size} чатов...`);
    try {
      const response = await fetch(`/api/stores/${storeId}/chats/bulk-actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatIds: Array.from(selectedChatIds),
          action: 'change_status',
          status: newStatus,
        }),
      });

      if (!response.ok) throw new Error('Failed to change status');

      const result = await response.json();
      toast.success(`Статус изменен: ${result.results.successful}/${result.results.total}`, { id: loadingToast });
      deselectAllChats();

      // ✅ Invalidate React Query cache instead of full page reload
      queryClient.invalidateQueries({ queryKey: ['all-chats', storeId] });
      queryClient.invalidateQueries({ queryKey: ['chats-stats', storeId] });
      queryClient.invalidateQueries({ queryKey: ['chats-infinite', storeId] });
    } catch (error) {
      console.error('Bulk status change failed:', error);
      toast.error('Не удалось изменить статус', { id: loadingToast });
    }
  };

  const clearSelection = () => {
    deselectAllChats();
  };

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    selectedCount: selectedChatIds.size,
    handleBulkGenerate,
    handleBulkSend,
    handleBulkChangeStatus,
    clearSelection,
  }));

  const activeChat = activeId ? chats.find(c => c.id === activeId) : null;

  return (
    <div className="flex flex-col h-full">
      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        onDragStart={(event) => setActiveId(event.active.id as string)}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-5 gap-4 flex-1 overflow-hidden">
          {COLUMNS.map(column => (
            <KanbanColumn
              key={column.status}
              status={column.status}
              title={column.title}
              chats={chatsByStatus[column.status]}
              selectedChatIds={selectedChatIds}
              onSelectChat={handleSelectChat}
              onSelectAll={handleSelectAll}
            />
          ))}
        </div>

        <DragOverlay>
          {activeChat && (
            <div className="opacity-80 rotate-2 scale-105">
              <ChatKanbanCard
                id={activeChat.id}
                clientName={activeChat.clientName}
                productName={activeChat.productName}
                lastMessageText={activeChat.lastMessageText}
                lastMessageSender={activeChat.lastMessageSender}
                lastMessageDate={activeChat.lastMessageDate}
                draftReply={activeChat.draftReply}
                status={activeChat.status}
                messageCount={activeChat.messageCount}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
});

KanbanBoardView.displayName = 'KanbanBoardView';

export default KanbanBoardView;
