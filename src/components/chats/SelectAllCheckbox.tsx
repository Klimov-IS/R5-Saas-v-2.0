'use client';

import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SelectAllCheckboxProps {
  checked: boolean; // All selected
  indeterminate: boolean; // Some selected
  onChange: () => void;
  className?: string;
}

export function SelectAllCheckbox({
  checked,
  indeterminate,
  onChange,
  className,
}: SelectAllCheckboxProps) {
  return (
    <div
      className={cn(
        'w-5 h-5 border-2 rounded cursor-pointer transition-all flex items-center justify-center',
        checked || indeterminate
          ? 'bg-blue-500 border-blue-500'
          : 'border-slate-300 hover:border-blue-500',
        className
      )}
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
    >
      {checked && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
      {indeterminate && !checked && (
        <Minus className="w-3.5 h-3.5 text-white" strokeWidth={3} />
      )}
    </div>
  );
}
