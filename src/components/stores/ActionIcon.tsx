'use client';

import { LucideIcon } from 'lucide-react';
import { useState } from 'react';

export interface ActionIconProps {
  icon: LucideIcon;
  tooltip: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function ActionIcon({
  icon: Icon,
  tooltip,
  onClick,
  loading = false,
  disabled = false,
}: ActionIconProps) {
  const [isHovered, setIsHovered] = useState(false);

  const isDisabled = disabled || loading;

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        style={{
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          borderRadius: '6px',
          backgroundColor: isHovered && !isDisabled ? 'var(--color-border-light)' : 'transparent',
          color: isDisabled ? 'var(--color-muted)' : 'var(--color-muted)',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s ease',
          transform: isHovered && !isDisabled ? 'translateY(-1px)' : 'translateY(0)',
          opacity: isDisabled ? 0.5 : 1,
        }}
        onClick={(e) => {
          e.stopPropagation();
          if (!isDisabled) {
            onClick();
          }
        }}
        onMouseEnter={() => !isDisabled && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        disabled={isDisabled}
        aria-label={tooltip}
      >
        {loading ? (
          <div
            style={{
              width: '16px',
              height: '16px',
              border: '2px solid var(--color-border)',
              borderTopColor: 'var(--color-primary)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        ) : (
          <Icon
            style={{
              width: '18px',
              height: '18px',
              color: isHovered && !isDisabled ? 'var(--color-foreground)' : 'inherit',
              transition: 'color 0.15s ease',
            }}
          />
        )}
      </button>

      {/* Tooltip */}
      {isHovered && !isDisabled && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'var(--color-foreground)',
            color: 'white',
            padding: '6px 10px',
            borderRadius: '6px',
            fontSize: '12px',
            whiteSpace: 'nowrap',
            zIndex: 100,
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            pointerEvents: 'none',
          }}
        >
          {tooltip}
          {/* Arrow */}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: '50%',
              transform: 'translateX(-50%)',
              width: 0,
              height: 0,
              borderLeft: '5px solid transparent',
              borderRight: '5px solid transparent',
              borderTop: '5px solid var(--color-foreground)',
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
