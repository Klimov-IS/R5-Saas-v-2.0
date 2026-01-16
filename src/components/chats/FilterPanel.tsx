'use client';

import { useState } from 'react';
import { useChatsStore } from '@/store/chatsStore';
import { Button } from '@/components/ui/button';
import { FilterChip } from './FilterChip';
import { Bot, RefreshCw, Send, Tag, ChevronDown, ChevronUp } from 'lucide-react';
import { useBulkGenerateAI, useBulkSendMessages, useBulkClassify, useRefreshChats } from '@/hooks/useChats';
import { toast } from 'react-hot-toast';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface FilterPanelProps {
  storeId: string;
  tagStats?: {
    active: number;
    successful: number;
    unsuccessful: number;
    no_reply: number;
    untagged: number;
  };
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
  const bulkClassify = useBulkClassify(storeId);
  const refreshChats = useRefreshChats(storeId);

  const selectedCount = selectedChatIds.size;
  const isAnyAction = bulkGenerateAI.isPending || bulkSend.isPending || bulkClassify.isPending || refreshChats.isPending;

  // Handle bulk action
  const handleBulkAction = async (action: 'generate' | 'send' | 'classify' | 'refresh') => {
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

        case 'classify':
          await bulkClassify.mutateAsync(chatIds);
          toast.success(
            selectedCount > 0
              ? `Классифицировано ${selectedCount} чатов`
              : 'Классифицированы все чаты'
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
              icon="🟢"
              label="Активные"
              count={tagStats?.active || 0}
              checked={tagFilter === 'active'}
              onChange={() => setTagFilter(tagFilter === 'active' ? 'all' : 'active')}
            />
            <FilterChip
              icon="🟡"
              label="Нет ответа"
              count={tagStats?.no_reply || 0}
              checked={tagFilter === 'no_reply'}
              onChange={() => setTagFilter(tagFilter === 'no_reply' ? 'all' : 'no_reply')}
            />
            <FilterChip
              icon="🔵"
              label="Успешные"
              count={tagStats?.successful || 0}
              checked={tagFilter === 'successful'}
              onChange={() => setTagFilter(tagFilter === 'successful' ? 'all' : 'successful')}
            />
            <FilterChip
              icon="🔴"
              label="Неуспешные"
              count={tagStats?.unsuccessful || 0}
              checked={tagFilter === 'unsuccessful'}
              onChange={() => setTagFilter(tagFilter === 'unsuccessful' ? 'all' : 'unsuccessful')}
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

          {/* Classify */}
          <Button
            variant="outline"
            size="sm"
            className="justify-start w-full text-xs h-8"
            onClick={() => handleBulkAction('classify')}
            disabled={isAnyAction || selectedCount === 0}
          >
            <Tag className="w-3.5 h-3.5 mr-1.5" />
            Классифицировать AI
            {selectedCount > 0 && (
              <span className="ml-auto text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">
                {selectedCount}
              </span>
            )}
          </Button>

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
