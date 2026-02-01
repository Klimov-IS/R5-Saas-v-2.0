'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export type BulkAction =
  | { type: 'apply_default_rules' }
  | { type: 'apply_custom_rules' }
  | { type: 'copy_rules' }
  | { type: 'update_status'; status: 'not_working' | 'active' | 'paused' | 'completed' };

type BulkActionsBarProps = {
  selectedCount: number;
  onClearSelection: () => void;
  onAction: (action: BulkAction) => void;
  onOpenCustomRulesModal?: () => void;
};

export function BulkActionsBar({ selectedCount, onClearSelection, onAction, onOpenCustomRulesModal }: BulkActionsBarProps) {
  const [applyRulesOpen, setApplyRulesOpen] = useState(false);
  const [changeStatusOpen, setChangeStatusOpen] = useState(false);

  const applyRulesRef = useRef<HTMLDivElement>(null);
  const changeStatusRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (applyRulesRef.current && !applyRulesRef.current.contains(event.target as Node)) {
        setApplyRulesOpen(false);
      }
      if (changeStatusRef.current && !changeStatusRef.current.contains(event.target as Node)) {
        setChangeStatusOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (selectedCount === 0) return null;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '16px 32px',
      background: '#eff6ff',
      borderBottom: '2px solid #3b82f6'
    }}>
      <span style={{
        fontSize: '14px',
        color: '#1e40af',
        fontWeight: 600,
        marginRight: 'auto'
      }}>
        ☑ Выбрано: {selectedCount} {selectedCount === 1 ? 'товар' : selectedCount < 5 ? 'товара' : 'товаров'}
      </span>

      <button
        className="btn btn-outline btn-sm"
        onClick={onClearSelection}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px'
        }}
      >
        Снять выделение
      </button>

      {/* Dropdown: Применить правила */}
      <div style={{ position: 'relative' }} ref={applyRulesRef}>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => {
            setApplyRulesOpen(!applyRulesOpen);
            setChangeStatusOpen(false);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          ⚙️ Применить правила
          <ChevronDown style={{ width: '14px', height: '14px' }} />
        </button>

        {applyRulesOpen && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '4px',
            background: 'white',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            minWidth: '240px',
            zIndex: 100
          }}>
            <button
              onClick={() => {
                onAction({ type: 'apply_default_rules' });
                setApplyRulesOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '10px 16px',
                fontSize: '13px',
                color: 'hsl(var(--foreground))',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid #f1f5f9',
                cursor: 'pointer',
                transition: 'background 0.15s',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              ⚡ Стандартные правила
            </button>

            <button
              onClick={() => {
                if (onOpenCustomRulesModal) {
                  onOpenCustomRulesModal();
                }
                setApplyRulesOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '10px 16px',
                fontSize: '13px',
                color: 'hsl(var(--foreground))',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid #f1f5f9',
                cursor: 'pointer',
                transition: 'background 0.15s',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              ⚙️ Кастомные правила...
            </button>

            <button
              onClick={() => {
                onAction({ type: 'copy_rules' });
                setApplyRulesOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '10px 16px',
                fontSize: '13px',
                color: 'hsl(var(--foreground))',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.15s',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              📋 Скопировать из другого товара...
            </button>
          </div>
        )}
      </div>

      {/* Dropdown: Изменить статус */}
      <div style={{ position: 'relative' }} ref={changeStatusRef}>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => {
            setChangeStatusOpen(!changeStatusOpen);
            setApplyRulesOpen(false);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          🔄 Изменить статус
          <ChevronDown style={{ width: '14px', height: '14px' }} />
        </button>

        {changeStatusOpen && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '4px',
            background: 'white',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            minWidth: '220px',
            zIndex: 100
          }}>
            <button
              onClick={() => {
                onAction({ type: 'update_status', status: 'active' });
                setChangeStatusOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '10px 16px',
                fontSize: '13px',
                color: 'hsl(var(--foreground))',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid #f1f5f9',
                cursor: 'pointer',
                transition: 'background 0.15s',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              🟢 Активная работа
            </button>

            <button
              onClick={() => {
                onAction({ type: 'update_status', status: 'not_working' });
                setChangeStatusOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '10px 16px',
                fontSize: '13px',
                color: 'hsl(var(--foreground))',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid #f1f5f9',
                cursor: 'pointer',
                transition: 'background 0.15s',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              ⚪ Не в работе
            </button>

            <button
              onClick={() => {
                onAction({ type: 'update_status', status: 'paused' });
                setChangeStatusOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '10px 16px',
                fontSize: '13px',
                color: 'hsl(var(--foreground))',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid #f1f5f9',
                cursor: 'pointer',
                transition: 'background 0.15s',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              🟡 Приостановлено
            </button>

            <button
              onClick={() => {
                onAction({ type: 'update_status', status: 'completed' });
                setChangeStatusOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                width: '100%',
                padding: '10px 16px',
                fontSize: '13px',
                color: 'hsl(var(--foreground))',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.15s',
                textAlign: 'left'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              🔵 Завершено
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
