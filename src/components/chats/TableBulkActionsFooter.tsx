'use client';

import { useChatsStore } from '@/store/chatsStore';
import { BulkActionsDropdown } from './BulkActionsDropdown';
import { useBulkGenerateAI, useBulkSendMessages } from '@/hooks/useChats';
import { toast } from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface TableBulkActionsFooterProps {
  storeId: string;
  className?: string;
}

export function TableBulkActionsFooter({ storeId, className }: TableBulkActionsFooterProps) {
  const { selectedChatIds, deselectAllChats } = useChatsStore();
  const bulkGenerateAI = useBulkGenerateAI(storeId);
  const bulkSend = useBulkSendMessages(storeId);

  const selectedCount = selectedChatIds.size;

  if (selectedCount === 0) return null;

  const handleAction = async (action: 'generate' | 'send' | 'mark-unread' | 'change-tag') => {
    const chatIds = Array.from(selectedChatIds);

    // ⚠️ Safety checks
    if (chatIds.length === 0) {
      toast.error('Выберите хотя бы один чат');
      return;
    }

    try {
      switch (action) {
        case 'generate':
          await bulkGenerateAI.mutateAsync(chatIds);
          toast.success(`AI ответы сгенерированы и сохранены для ${selectedCount} чатов`);
          break;

        case 'send':
          // ⚠️ Confirmation dialog for mass send
          const confirmed = window.confirm(
            `Вы уверены, что хотите отправить черновики в ${selectedCount} чатов?\n\nЭто действие нельзя отменить.`
          );
          if (!confirmed) return;

          await bulkSend.mutateAsync(chatIds);
          toast.success(`Черновики отправлены в ${selectedCount} чатов`);
          deselectAllChats(); // Clear selection after successful send
          break;

        case 'mark-unread':
          toast.success(`Отметка ${selectedCount} чатов как непрочитанные...`);
          break;

        case 'change-tag':
          toast.success(`Изменение тега для ${selectedCount} чатов...`);
          break;
      }
    } catch (error) {
      toast.error('Ошибка выполнения действия');
      console.error('Bulk action failed:', error);
    }
  };

  return (
    <div
      className={cn(
        'sticky bottom-0 left-0 right-0 bg-gradient-to-r from-blue-500 to-purple-600 p-4 flex items-center justify-between gap-4 shadow-lg z-50 animate-slide-up rounded-b-lg',
        className
      )}
    >
      <div className="flex items-center gap-3 text-white">
        <span className="text-base font-semibold">{selectedCount} выбрано</span>
        <button
          className="px-3 py-1 bg-white/20 hover:bg-white/30 border border-white/30 rounded text-sm transition-colors"
          onClick={deselectAllChats}
        >
          Снять выбор
        </button>
      </div>

      <BulkActionsDropdown selectedCount={selectedCount} onAction={handleAction} />
    </div>
  );
}
