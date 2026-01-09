'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import type { StoreStatus } from '@/db/helpers';
import { STATUS_OPTIONS } from './StatusMultiSelect';

export interface StatusDropdownProps {
  currentStatus: StoreStatus;
  storeId: string;
  storeName: string;
  onChange: (storeId: string, newStatus: StoreStatus) => Promise<void>;
  isUpdating?: boolean;
}

export function StatusDropdown({
  currentStatus,
  storeId,
  storeName,
  onChange,
  isUpdating = false,
}: StatusDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentOption = STATUS_OPTIONS.find((opt) => opt.value === currentStatus) || STATUS_OPTIONS[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleStatusChange = async (newStatus: StoreStatus) => {
    setIsOpen(false);

    // Confirmation for critical status changes
    if (currentStatus === 'active' && newStatus === 'archived') {
      const confirmed = window.confirm(
        `Архивировать магазин "${storeName}"?\n\nМагазин будет скрыт из основного списка.`
      );
      if (!confirmed) return;
    }

    if (currentStatus === 'active' && newStatus === 'stopped') {
      const confirmed = window.confirm(
        `Остановить магазин "${storeName}"?\n\nВсе автоматизации будут отключены.`
      );
      if (!confirmed) return;
    }

    // Call onChange handler (async)
    await onChange(storeId, newStatus);
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Status Badge Button */}
      <button
        className="badge"
        style={{
          backgroundColor: `${currentOption.color}26`, // 15% opacity
          color: currentOption.color,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 10px',
          cursor: isUpdating ? 'wait' : 'pointer',
          border: 'none',
          borderRadius: '6px',
          fontSize: '13px',
          fontWeight: 500,
          transition: 'all 0.15s ease',
          opacity: isUpdating ? 0.6 : 1,
        }}
        onClick={() => !isUpdating && setIsOpen(!isOpen)}
        onMouseEnter={(e) => {
          if (!isUpdating) {
            e.currentTarget.style.backgroundColor = `${currentOption.color}40`; // 25% opacity
          }
        }}
        onMouseLeave={(e) => {
          if (!isUpdating) {
            e.currentTarget.style.backgroundColor = `${currentOption.color}26`;
          }
        }}
        disabled={isUpdating}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>{currentOption.emoji}</span>
        <span>{currentOption.label.replace('ые', 'ый').replace('вые', 'вой')}</span>
        {isUpdating ? (
          <div
            style={{
              width: '12px',
              height: '12px',
              border: `2px solid ${currentOption.color}`,
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        ) : (
          <ChevronDown style={{ width: '14px', height: '14px' }} />
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && !isUpdating && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            minWidth: '160px',
            backgroundColor: 'white',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            zIndex: 50,
            overflow: 'hidden',
          }}
          role="listbox"
        >
          {STATUS_OPTIONS.map((option) => {
            const isCurrentStatus = option.value === currentStatus;

            return (
              <div
                key={option.value}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  backgroundColor: isCurrentStatus ? 'var(--color-border-light)' : 'white',
                  transition: 'background-color 0.15s ease',
                  borderLeft: isCurrentStatus ? `3px solid ${option.color}` : '3px solid transparent',
                }}
                onClick={() => handleStatusChange(option.value)}
                onMouseEnter={(e) => {
                  if (!isCurrentStatus) {
                    e.currentTarget.style.backgroundColor = 'var(--color-background)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isCurrentStatus) {
                    e.currentTarget.style.backgroundColor = 'white';
                  }
                }}
                role="option"
                aria-selected={isCurrentStatus}
              >
                <span>{option.emoji}</span>
                <span style={{ fontSize: '14px', fontWeight: isCurrentStatus ? 600 : 500 }}>
                  {option.label.replace('ые', 'ый').replace('вые', 'вой')}
                </span>
              </div>
            );
          })}
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
