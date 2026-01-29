'use client';

import { LucideIcon } from 'lucide-react';

export interface TaskKPICardProps {
  icon: LucideIcon;
  label: string;
  value: number;
  bgColor: string;
  iconColor: string;
  description?: string;
}

export function TaskKPICard({
  icon: Icon,
  label,
  value,
  bgColor,
  iconColor,
  description,
}: TaskKPICardProps) {
  return (
    <div className="kpi-item">
      <div
        className="kpi-icon"
        style={{
          backgroundColor: bgColor,
        }}
      >
        <Icon
          style={{
            width: '24px',
            height: '24px',
            color: iconColor,
          }}
        />
      </div>

      <div className="kpi-content">
        <h3>{label}</h3>
        <p>{value.toLocaleString('ru-RU')}</p>
        {description && (
          <span
            style={{
              fontSize: '12px',
              color: 'var(--color-text-secondary)',
              marginTop: '2px',
            }}
          >
            {description}
          </span>
        )}
      </div>
    </div>
  );
}
