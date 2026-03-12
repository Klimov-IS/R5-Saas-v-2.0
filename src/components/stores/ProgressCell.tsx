'use client';

import { LucideIcon } from 'lucide-react';

interface ProgressCellProps {
  icon: LucideIcon;
  current: number;
  total: number;
  color: string;
}

export function ProgressCell({ icon: Icon, current, total, color }: ProgressCellProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <Icon style={{ width: '14px', height: '14px', color, flexShrink: 0 }} />
      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-foreground)' }}>
        {current.toLocaleString('ru-RU')}
        <span style={{ fontWeight: 400, color: 'var(--color-muted)' }}>
          {' / '}{total.toLocaleString('ru-RU')}
        </span>
      </span>
    </div>
  );
}
