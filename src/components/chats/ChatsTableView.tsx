'use client';

import { useState, useEffect } from 'react';
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

  // ✅ PAGINATION STATE
  const [skip, setSkip] = useState(0);
  const [take, setTake] = useState(50);

  // ✅ AUTO-RESET: Return to page 1 when filters change
  useEffect(() => {
    setSkip(0);
  }, [tagFilter, searchQuery]);

  // Fetch chats with pagination
  const { data, isLoading } = useChats({
    storeId,
    tag: tagFilter,
    search: searchQuery,
    skip,
    take,
  });

  const chats = data?.data || [];
  const totalCount = data?.totalCount || 0;

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
    <div className="flex flex-col gap-4">
      {/* ✅ RESULTS BAR */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border border-slate-200 rounded-lg shadow-sm">
        <div className="text-sm text-slate-600">
          Всего: <strong className="text-slate-900">{totalCount.toLocaleString('ru-RU')} чатов</strong>
          {' '} | Показано: <strong className="text-slate-900">{chats.length}</strong>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <label>На странице:</label>
          <select
            value={take}
            onChange={(e) => {
              setTake(parseInt(e.target.value));
              setSkip(0); // Reset to first page
            }}
            className="px-3 py-1.5 border border-slate-300 rounded-md text-sm cursor-pointer hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
          </select>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col h-[calc(100vh-350px)] min-h-[500px] relative shadow-sm">
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
                    <span className="text-slate-500">
                      {chat.lastMessageSender === 'seller' ? 'Вы: ' : 'Покупатель: '}
                    </span>
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
                  <div className="flex gap-2 items-center">
                    {/* ✅ Draft indicator */}
                    {chat.draftReply && (
                      <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                        <Bot className="w-3 h-3 mr-1" />
                        Черновик
                      </span>
                    )}
                    <button
                      className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                      title="Открыть чат"
                    >
                      <MessageSquare className="w-4 h-4 text-slate-600" />
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

      {/* ✅ PAGINATION CONTROLS */}
      {totalCount > take && (
        <div className="flex items-center justify-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-lg shadow-sm">
          <button
            onClick={() => setSkip(Math.max(0, skip - take))}
            disabled={skip === 0}
            className="px-4 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
          >
            ← Назад
          </button>

          <span className="text-sm text-slate-600 mx-2">
            Страница <strong className="text-slate-900">{Math.floor(skip / take) + 1}</strong> из{' '}
            <strong className="text-slate-900">{Math.ceil(totalCount / take)}</strong>
          </span>

          <button
            onClick={() => setSkip(skip + take)}
            disabled={skip + take >= totalCount}
            className="px-4 py-2 bg-white border border-slate-300 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors"
          >
            Вперёд →
          </button>
        </div>
      )}
    </div>
  );
}
