'use client';

import { LucideIcon } from 'lucide-react';
import { ReactNode, useState } from 'react';

export interface InteractiveKPICardProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  actionIcon: LucideIcon;
  actionTooltip: string;
  onClick: () => void;
  bgColor: string;
  iconColor: string;
  isLoading?: boolean;
  isSyncing?: boolean;
  subtitle?: string;
  subtitleColor?: string;
  extraAction?: {
    label: string;
    tooltip: string;
    onClick: () => void;
  };
}

export function InteractiveKPICard({
  icon: Icon,
  label,
  value,
  actionIcon: ActionIcon,
  actionTooltip,
  onClick,
  bgColor,
  iconColor,
  isLoading = false,
  isSyncing = false,
  subtitle,
  subtitleColor,
  extraAction,
}: InteractiveKPICardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className={`kpi-item ${isSyncing ? 'syncing' : ''}`}
      style={{
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.2s ease',
        transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
        backgroundColor: isHovered ? 'var(--color-border-light)' : 'transparent',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyPress={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`${label}: ${value}. ${actionTooltip}`}
    >
      <div
        className="kpi-icon"
        style={{
          backgroundColor: bgColor,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Icon
          style={{
            width: '24px',
            height: '24px',
            color: iconColor,
            transition: 'opacity 0.2s ease',
            opacity: isHovered ? 0.3 : 1,
          }}
        />

        {/* Action overlay */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(59, 130, 246, 0.95)',
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 0.2s ease',
            pointerEvents: 'none',
          }}
        >
          {isLoading ? (
            <div
              style={{
                width: '20px',
                height: '20px',
                border: '2px solid white',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
          ) : (
            <ActionIcon
              style={{
                width: '20px',
                height: '20px',
                color: 'white',
              }}
            />
          )}
        </div>
      </div>

      <div className="kpi-content">
        <h3>{label}</h3>
        <p>{typeof value === 'number' ? value.toLocaleString('ru-RU') : value}</p>
        {subtitle && (
          <span style={{
            fontSize: '12px',
            fontWeight: 500,
            color: subtitleColor || 'var(--color-muted)',
            marginTop: '2px',
            display: 'block',
            lineHeight: 1.3,
          }}>
            {subtitle}
          </span>
        )}
      </div>

      {/* Extra action button (e.g. OZON) */}
      {extraAction && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            extraAction.onClick();
          }}
          title={extraAction.tooltip}
          style={{
            position: 'absolute',
            top: '6px',
            right: '6px',
            padding: '2px 6px',
            fontSize: '10px',
            fontWeight: 700,
            color: 'white',
            background: 'linear-gradient(135deg, #005BFF, #003399)',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            opacity: 0.9,
            transition: 'opacity 0.2s',
            zIndex: 5,
            lineHeight: '16px',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.9'; }}
        >
          {extraAction.label}
        </button>
      )}

      {/* Tooltip */}
      {isHovered && !isLoading && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'var(--color-foreground)',
            color: 'white',
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '13px',
            whiteSpace: 'nowrap',
            zIndex: 10,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          }}
        >
          {actionTooltip}
          {/* Arrow */}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: '6px solid var(--color-foreground)',
            }}
          />
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
