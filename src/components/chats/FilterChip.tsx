'use client';

import { Checkbox } from '@/components/ui/checkbox';

interface FilterChipProps {
  icon: string;
  label: string;
  count: number;
  checked: boolean;
  onChange: () => void;
}

export function FilterChip({ icon, label, count, checked, onChange }: FilterChipProps) {
  return (
    <label className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer transition-all duration-200 text-xs">
      <Checkbox
        checked={checked}
        onCheckedChange={onChange}
        className="h-3.5 w-3.5"
      />
      <span className="flex items-center gap-1">
        <span className="text-sm">{icon}</span>
        <span className="font-medium text-slate-700">{label}</span>
      </span>
      <span className="ml-0.5 px-1.5 py-0.5 bg-slate-100 rounded-full text-xs font-semibold text-slate-600">
        {count}
      </span>
    </label>
  );
}
