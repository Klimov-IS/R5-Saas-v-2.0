'use client';

import { useState, useMemo, useImperativeHandle, forwardRef } from 'react';
import { DndContext, DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors, pointerWithin, rectIntersection } from '@dnd-kit/core';
import KanbanColumn from './KanbanColumn';
import ChatKanbanCard from './ChatKanbanCard';
import CompletionReasonModal from './CompletionReasonModal';
import { ChatPreviewModal } from './ChatPreviewModal';
import { useRouter } from 'next/navigation';
import type { ChatStatus, CompletionReason } from '@/db/helpers';
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
  completionReason?: CompletionReason | null;
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
    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const [pendingCloseChatId, setPendingCloseChatId] = useState<string | null>(null);
    const [isBulkClose, setIsBulkClose] = useState(false);
    const [previewChatId, setPreviewChatId] = useState<string | null>(null);

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

    const chatId = String(active.id);
    const newStatus = over.id as ChatStatus;

    console.log('[DRAG] Chat', chatId, 'dragged to', newStatus);

    // If closing chat, show modal to select completion reason
    if (newStatus === 'closed') {
      console.log('[DRAG] Showing completion modal for chat', chatId);
      setPendingCloseChatId(chatId);
      setShowCompletionModal(true);
      return;
    }

    // Update status via API (for non-closed statuses)
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

  // Handle completion reason confirmation (single chat)
  const handleCompletionReasonConfirm = async (reason: CompletionReason) => {
    setShowCompletionModal(false);

    // If bulk close operation
    if (isBulkClose) {
      setIsBulkClose(false);
      await handleBulkCloseWithReason(reason);
      return;
    }

    // Single chat close
    if (!pendingCloseChatId) return;
    const chatId = pendingCloseChatId;
    setPendingCloseChatId(null);

    const loadingToast = toast.loading('Закрытие чата...');
    try {
      const response = await fetch(`/api/stores/${storeId}/chats/${chatId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'closed',
          completion_reason: reason,
        }),
      });

      if (!response.ok) throw new Error('Failed to close chat');

      // ✅ Invalidate React Query cache
      queryClient.invalidateQueries({ queryKey: ['all-chats', storeId] });
      queryClient.invalidateQueries({ queryKey: ['chats-stats', storeId] });
      queryClient.invalidateQueries({ queryKey: ['chats-infinite', storeId] });

      toast.success('Чат закрыт', { id: loadingToast });
    } catch (error) {
      console.error('Failed to close chat:', error);
      toast.error('Не удалось закрыть чат', { id: loadingToast });
    }
  };

  const handleCompletionModalClose = () => {
    setShowCompletionModal(false);
    setPendingCloseChatId(null);
    setIsBulkClose(false);
  };

  // Handle bulk close with completion reason
  const handleBulkCloseWithReason = async (reason: CompletionReason) => {
    if (selectedChatIds.size === 0) {
      toast.error('Выберите хотя бы один чат');
      return;
    }

    const loadingToast = toast.loading(`Закрытие ${selectedChatIds.size} чатов...`);
    try {
      // Close each chat individually with the same completion reason
      const chatIdsArray = Array.from(selectedChatIds);
      const results = {
        successful: 0,
        failed: 0,
      };

      for (const chatId of chatIdsArray) {
        try {
          const response = await fetch(`/api/stores/${storeId}/chats/${chatId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'closed',
              completion_reason: reason,
            }),
          });

          if (response.ok) {
            results.successful++;
          } else {
            results.failed++;
          }
        } catch (error) {
          results.failed++;
        }
      }

      deselectAllChats();

      // ✅ Invalidate React Query cache
      queryClient.invalidateQueries({ queryKey: ['all-chats', storeId] });
      queryClient.invalidateQueries({ queryKey: ['chats-stats', storeId] });
      queryClient.invalidateQueries({ queryKey: ['chats-infinite', storeId] });

      toast.success(`Чаты закрыты: ${results.successful}/${chatIdsArray.length}`, { id: loadingToast });
    } catch (error) {
      console.error('Bulk close failed:', error);
      toast.error('Не удалось закрыть чаты', { id: loadingToast });
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

    // If closing chats, show modal to select completion reason
    if (newStatus === 'closed') {
      setIsBulkClose(true);
      setShowCompletionModal(true);
      return;
    }

    // For non-closed statuses, proceed normally
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
        collisionDetection={pointerWithin}
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
              onChatClick={(chatId) => setPreviewChatId(chatId)}
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
                completionReason={activeChat.completionReason}
              />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Completion Reason Modal */}
      <CompletionReasonModal
        isOpen={showCompletionModal}
        onClose={handleCompletionModalClose}
        onConfirm={handleCompletionReasonConfirm}
        chatCount={isBulkClose ? selectedChatIds.size : 1}
      />

      {/* Chat Preview Modal */}
      <ChatPreviewModal
        storeId={storeId}
        chatId={previewChatId}
        open={!!previewChatId}
        onOpenChange={(open) => {
          if (!open) setPreviewChatId(null);
        }}
      />
    </div>
  );
});

KanbanBoardView.displayName = 'KanbanBoardView';

export default KanbanBoardView;
