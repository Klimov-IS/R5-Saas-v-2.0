'use client';

import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';

interface TgQueueCardProps {
  id: string;
  storeId: string;
  storeName: string;
  clientName: string;
  productName: string | null;
  lastMessageText: string | null;
  lastMessageDate: string | null;
  hasDraft: boolean;
  draftPreview: string | null;
  isSkipped?: boolean;
  isSelected?: boolean;
  selectionMode?: boolean;
  onToggleSelect?: () => void;
  onClick: () => void;
}

export default function TgQueueCard({
  storeName,
  clientName,
  productName,
  lastMessageText,
  lastMessageDate,
  hasDraft,
  isSkipped,
  isSelected,
  selectionMode,
  onToggleSelect,
  onClick,
}: TgQueueCardProps) {
  const timeAgo = lastMessageDate
    ? formatDistanceToNow(new Date(lastMessageDate), { locale: ru, addSuffix: false })
    : '';

  return (
    <div
      onClick={selectionMode ? onToggleSelect : onClick}
      style={{
        backgroundColor: isSelected ? 'rgba(59,130,246,0.12)' : 'var(--tg-secondary-bg)',
        borderRadius: '12px',
        padding: '12px 14px',
        marginBottom: '8px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        opacity: isSkipped ? 0.5 : 1,
        border: isSelected ? '2px solid #3b82f6' : '2px solid transparent',
      }}
    >
      {/* Top row: checkbox (if selection mode) + store badge + time */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {selectionMode && (
            <div
              onClick={(e) => { e.stopPropagation(); onToggleSelect?.(); }}
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '4px',
                border: isSelected ? 'none' : '2px solid var(--tg-hint)',
                backgroundColor: isSelected ? '#3b82f6' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.15s',
              }}
            >
              {isSelected && (
                <span style={{ color: '#fff', fontSize: '12px', fontWeight: 700 }}>✓</span>
              )}
            </div>
          )}
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '10px',
              backgroundColor: 'var(--tg-button)',
              color: 'var(--tg-button-text)',
            }}
          >
            {storeName}
          </span>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--tg-hint)' }}>
          {timeAgo}
        </span>
      </div>

      {/* Client name */}
      <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '2px', color: 'var(--tg-text)' }}>
        {clientName}
      </div>

      {/* Product */}
      {productName && (
        <div style={{ fontSize: '13px', color: 'var(--tg-hint)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {productName}
        </div>
      )}

      {/* Message preview */}
      {lastMessageText && (
        <div style={{
          fontSize: '13px',
          color: 'var(--tg-text)',
          opacity: 0.8,
          lineHeight: 1.4,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          marginTop: '4px',
        }}>
          {lastMessageText}
        </div>
      )}

      {/* Draft indicator */}
      <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
        {hasDraft ? (
          <span style={{ fontSize: '11px', color: '#22c55e', fontWeight: 600 }}>
            ✓ Черновик готов
          </span>
        ) : (
          <span style={{ fontSize: '11px', color: '#f97316', fontWeight: 600 }}>
            ○ Нет черновика
          </span>
        )}
      </div>
    </div>
  );
}
