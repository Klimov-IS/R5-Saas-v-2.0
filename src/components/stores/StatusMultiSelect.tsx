'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import type { StoreStatus } from '@/db/helpers';

export interface StatusOption {
  value: StoreStatus;
  label: string;
  color: string;
  emoji: string;
}

export const STATUS_OPTIONS: StatusOption[] = [
  { value: 'active', label: 'Активные', color: '#10b981', emoji: '🟢' },
  { value: 'paused', label: 'На паузе', color: '#f59e0b', emoji: '🟡' },
  { value: 'stopped', label: 'Остановлены', color: '#ef4444', emoji: '🔴' },
  { value: 'trial', label: 'Тестовые', color: '#3b82f6', emoji: '🔵' },
  { value: 'archived', label: 'Архивные', color: '#6b7280', emoji: '⚫' },
];

export interface StatusMultiSelectProps {
  selectedStatuses: StoreStatus[];
  onChange: (statuses: StoreStatus[]) => void;
}

export function StatusMultiSelect({ selectedStatuses, onChange }: StatusMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  const handleToggleStatus = (status: StoreStatus) => {
    if (selectedStatuses.includes(status)) {
      // Remove status
      const newStatuses = selectedStatuses.filter((s) => s !== status);
      onChange(newStatuses);
    } else {
      // Add status
      onChange([...selectedStatuses, status]);
    }
  };

  // Calculate label
  const getLabel = () => {
    const count = selectedStatuses.length;

    if (count === 0 || count === STATUS_OPTIONS.length) {
      return 'Все статусы';
    }

    if (count === 1) {
      const option = STATUS_OPTIONS.find((opt) => opt.value === selectedStatuses[0]);
      return option?.label || 'Все статусы';
    }

    return `Выбрано: ${count}`;
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', minWidth: '200px' }}>
      {/* Button */}
      <button
        className="btn btn-outline"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          gap: '8px',
        }}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span>{getLabel()}</span>
        <ChevronDown
          style={{
            width: '16px',
            height: '16px',
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            backgroundColor: 'white',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            zIndex: 50,
            overflow: 'hidden',
          }}
          role="listbox"
          aria-multiselectable="true"
        >
          {STATUS_OPTIONS.map((option) => {
            const isSelected = selectedStatuses.includes(option.value);

            return (
              <div
                key={option.value}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  backgroundColor: isSelected ? 'var(--color-border-light)' : 'white',
                  transition: 'background-color 0.15s ease',
                }}
                onClick={() => handleToggleStatus(option.value)}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = 'var(--color-background)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = 'white';
                  }
                }}
                role="option"
                aria-selected={isSelected}
              >
                {/* Checkbox */}
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    border: `2px solid ${isSelected ? option.color : 'var(--color-border)'}`,
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isSelected ? option.color : 'white',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isSelected && (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M10 3L4.5 8.5L2 6"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>

                {/* Emoji + Label */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <span>{option.emoji}</span>
                  <span style={{ fontSize: '14px', fontWeight: 500 }}>{option.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
