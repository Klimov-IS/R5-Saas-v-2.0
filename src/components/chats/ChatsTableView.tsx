'use client';

import { useChats } from '@/hooks/useChats';
import { useChatsStore } from '@/store/chatsStore';
import { SelectAllCheckbox } from './SelectAllCheckbox';
import { TableBulkActionsFooter } from './TableBulkActionsFooter';
import { MessageSquare, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatsTableViewProps {
  storeId: string;
}

export function ChatsTableView({ storeId }: ChatsTableViewProps) {
  const {
    tagFilter,
    searchQuery,
    selectedChatIds,
    toggleChatSelection,
    selectAllChats,
    deselectAllChats,
    isSelected,
  } = useChatsStore();

  // Fetch chats
  const { data, isLoading } = useChats({
    storeId,
    tag: tagFilter,
    search: searchQuery,
    take: 100,
  });

  const chats = data?.data || [];

  // Select all checkbox state
  const allChatIds = chats.map((c) => c.id);
  const isAllSelected = allChatIds.length > 0 && allChatIds.every((id) => isSelected(id));
  const isIndeterminate =
    allChatIds.some((id) => isSelected(id)) && !isAllSelected;

  const handleSelectAll = () => {
    if (isAllSelected) {
      deselectAllChats();
    } else {
      selectAllChats(allChatIds);
    }
  };

  // Get tag badge style
  const getTagBadgeStyle = (tag: string) => {
    switch (tag) {
      case 'active':
        return 'bg-green-100 text-green-700';
      case 'successful':
        return 'bg-blue-100 text-blue-700';
      case 'unsuccessful':
        return 'bg-red-100 text-red-700';
      case 'no_reply':
        return 'bg-yellow-100 text-yellow-700';
      case 'deletion_candidate':
        return 'bg-purple-100 text-purple-700';
      case 'deletion_offered':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  // Get tag label
  const getTagLabel = (tag: string): string => {
    switch (tag) {
      case 'active':
        return '🟢 Активный';
      case 'successful':
        return '🔵 Успешный';
      case 'unsuccessful':
        return '🔴 Неуспешный';
      case 'no_reply':
        return '🟡 Нет ответа';
      case 'untagged':
        return 'Не размечено';
      case 'completed':
        return '✅ Завершён';
      case 'deletion_candidate':
        return '🎯 Кандидат';
      case 'deletion_offered':
        return '💰 Компенсация';
      case 'deletion_agreed':
        return '🤝 Согласились';
      case 'deletion_confirmed':
        return '✔️ Подтверждено';
      case 'refund_requested':
        return '💸 Возврат';
      case 'spam':
        return '🚫 Спам';
      default:
        return tag;
    }
  };

  // Format time
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
        <div className="inline-block w-8 h-8 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-500">Загрузка чатов...</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col h-[calc(100vh-280px)] min-h-[600px] relative shadow-sm">
      <div className="flex-1 overflow-y-auto">
        <table className="w-full border-collapse">
          <thead className="bg-slate-50 border-b-2 border-slate-200 sticky top-0 z-10">
            <tr>
              <th className="w-10 p-3 text-center">
                <SelectAllCheckbox
                  checked={isAllSelected}
                  indeterminate={isIndeterminate}
                  onChange={handleSelectAll}
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Имя
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Последнее сообщение
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Тег
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Время
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Действия
              </th>
            </tr>
          </thead>
          <tbody>
            {chats.map((chat) => (
              <tr
                key={chat.id}
                className={cn(
                  'border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer',
                  isSelected(chat.id) && 'bg-blue-50/50'
                )}
              >
                <td className="p-3 text-center" onClick={() => toggleChatSelection(chat.id)}>
                  <SelectAllCheckbox
                    checked={isSelected(chat.id)}
                    indeterminate={false}
                    onChange={() => toggleChatSelection(chat.id)}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-sm text-slate-900">{chat.clientName}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-slate-600 max-w-md truncate">
                    {chat.lastMessageText}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                      getTagBadgeStyle(chat.tag)
                    )}
                  >
                    {getTagLabel(chat.tag)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-slate-500">{formatTime(chat.lastMessageDate)}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                      title="Открыть чат"
                    >
                      <MessageSquare className="w-4 h-4 text-slate-600" />
                    </button>
                    <button
                      className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                      title="AI ответ"
                    >
                      <Bot className="w-4 h-4 text-blue-600" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {chats.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <p>Чаты не найдены</p>
          </div>
        )}
      </div>

      {/* Bulk Actions Footer */}
      <TableBulkActionsFooter storeId={storeId} />
    </div>
  );
}
