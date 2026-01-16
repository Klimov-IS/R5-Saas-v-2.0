'use client';

import { useChatsStore } from '@/store/chatsStore';
import { Checkbox } from '@/components/ui/checkbox';
import { useEffect, useRef } from 'react';

interface BulkActionsBarProps {
  allChatIds: string[];
}

export function BulkActionsBar({ allChatIds }: BulkActionsBarProps) {
  const { selectedChatIds, selectAllChats, deselectAllChats } = useChatsStore();
  const checkboxRef = useRef<HTMLButtonElement>(null);

  const selectedCount = selectedChatIds.size;
  const allSelected = selectedCount === allChatIds.length && allChatIds.length > 0;
  const someSelected = selectedCount > 0 && selectedCount < allChatIds.length;

  // Set indeterminate state via DOM ref
  useEffect(() => {
    if (checkboxRef.current) {
      (checkboxRef.current as any).indeterminate = someSelected;
    }
  }, [someSelected]);

  const handleSelectAll = () => {
    if (allSelected) {
      deselectAllChats();
    } else {
      selectAllChats(allChatIds);
    }
  };

  if (selectedCount === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
      <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
        <Checkbox
          ref={checkboxRef}
          checked={allSelected}
          onCheckedChange={handleSelectAll}
        />
        <span>Выбрать все</span>
      </label>

      <span className="text-sm text-slate-500 font-medium">
        Выбрано: {selectedCount}
      </span>
    </div>
  );
}
