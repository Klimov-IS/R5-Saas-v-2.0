'use client';

import { useState } from 'react';
import { useChatsStore } from '@/store/chatsStore';
import { Button } from '@/components/ui/button';
import { FilterChip } from './FilterChip';
import { Bot, RefreshCw, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { useBulkGenerateAI, useBulkSendMessages, useRefreshChats } from '@/hooks/useChats';
import { toast } from 'react-hot-toast';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { TagStats } from '@/types/chats';

interface FilterPanelProps {
  storeId: string;
  tagStats?: TagStats;
}

export function FilterPanel({ storeId, tagStats }: FilterPanelProps) {
  const {
    tagFilter,
    setTagFilter,
    selectedChatIds,
  } = useChatsStore();

  const [isFiltersOpen, setIsFiltersOpen] = useState(true);
  const [isActionsOpen, setIsActionsOpen] = useState(true);

  const bulkGenerateAI = useBulkGenerateAI(storeId);
  const bulkSend = useBulkSendMessages(storeId);
  const refreshChats = useRefreshChats(storeId);

  const selectedCount = selectedChatIds.size;
  const isAnyAction = bulkGenerateAI.isPending || bulkSend.isPending || refreshChats.isPending;

  // Handle bulk action
  const handleBulkAction = async (action: 'generate' | 'send' | 'refresh') => {
    const chatIds = Array.from(selectedChatIds);

    try {
      switch (action) {
        case 'generate':
          await bulkGenerateAI.mutateAsync(chatIds);
          toast.success(
            selectedCount > 0
              ? `AI ответы сгенерированы для ${selectedCount} чатов`
              : 'AI ответы сгенерированы для всех чатов'
          );
          break;

        case 'send':
          if (selectedCount === 0) {
            const confirmed = confirm('Отправить ответы для ВСЕХ чатов?');
            if (!confirmed) return;
          }
          await bulkSend.mutateAsync(chatIds);
          toast.success(
            selectedCount > 0
              ? `Ответы отправлены для ${selectedCount} чатов`
              : 'Ответы отправлены для всех чатов'
          );
          break;

        case 'refresh':
          await refreshChats.mutateAsync();
          toast.success('Чаты обновлены с WB');
          break;
      }
    } catch (error) {
      toast.error('Ошибка выполнения действия');
      console.error('Bulk action failed:', error);
    }
  };

  return (
    <div className="pb-3 border-b border-slate-200">
      {/* Filters by Tags - Collapsible */}
      <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen} className="mb-3">
        <CollapsibleTrigger className="flex items-center justify-between w-full px-1 py-1.5 hover:bg-slate-50 rounded-md transition-colors">
          <h3 className="text-xs font-semibold text-slate-700">
            Фильтры по тегам
          </h3>
          {isFiltersOpen ? (
            <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="flex flex-wrap gap-1.5">
            <FilterChip
              icon="🎯"
              label="Кандидаты"
              count={tagStats?.deletion_candidate || 0}
              checked={tagFilter === 'deletion_candidate'}
              onChange={() => setTagFilter(tagFilter === 'deletion_candidate' ? 'all' : 'deletion_candidate')}
            />
            <FilterChip
              icon="💰"
              label="Предложена компенсация"
              count={tagStats?.deletion_offered || 0}
              checked={tagFilter === 'deletion_offered'}
              onChange={() => setTagFilter(tagFilter === 'deletion_offered' ? 'all' : 'deletion_offered')}
            />
            <FilterChip
              icon="🤝"
              label="Согласились"
              count={tagStats?.deletion_agreed || 0}
              checked={tagFilter === 'deletion_agreed'}
              onChange={() => setTagFilter(tagFilter === 'deletion_agreed' ? 'all' : 'deletion_agreed')}
            />
            <FilterChip
              icon="✔️"
              label="Подтверждено"
              count={tagStats?.deletion_confirmed || 0}
              checked={tagFilter === 'deletion_confirmed'}
              onChange={() => setTagFilter(tagFilter === 'deletion_confirmed' ? 'all' : 'deletion_confirmed')}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Actions - Collapsible */}
      <Collapsible open={isActionsOpen} onOpenChange={setIsActionsOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full px-1 py-1.5 hover:bg-slate-50 rounded-md transition-colors">
          <h3 className="text-xs font-semibold text-slate-700">
            Действия
          </h3>
          {isActionsOpen ? (
            <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <div className="flex flex-col gap-1.5">
          {/* Generate AI */}
          <Button
            variant="outline"
            size="sm"
            className="justify-start w-full text-xs h-8"
            onClick={() => handleBulkAction('generate')}
            disabled={isAnyAction || selectedCount === 0}
          >
            <Bot className="w-3.5 h-3.5 mr-1.5" />
            Сгенерировать AI ответы
            {selectedCount > 0 && (
              <span className="ml-auto text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">
                {selectedCount}
              </span>
            )}
          </Button>

          {/* Send */}
          <Button
            variant="outline"
            size="sm"
            className="justify-start w-full text-xs h-8"
            onClick={() => handleBulkAction('send')}
            disabled={isAnyAction || selectedCount === 0}
          >
            <Send className="w-3.5 h-3.5 mr-1.5" />
            Отправить ответы
            {selectedCount > 0 && (
              <span className="ml-auto text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">
                {selectedCount}
              </span>
            )}
          </Button>

          {/* AI Classification removed — tags set manually from TG Mini App */}

          {/* Refresh */}
          <Button
            variant="outline"
            size="sm"
            className="justify-start w-full text-xs h-8"
            onClick={() => handleBulkAction('refresh')}
            disabled={isAnyAction}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Обновить
          </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
