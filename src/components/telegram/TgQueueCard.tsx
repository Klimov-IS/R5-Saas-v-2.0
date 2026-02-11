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
  onClick: () => void;
}

const STORE_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-purple-100 text-purple-700',
  'bg-orange-100 text-orange-700',
  'bg-pink-100 text-pink-700',
];

function getStoreColor(storeName: string): string {
  let hash = 0;
  for (let i = 0; i < storeName.length; i++) {
    hash = ((hash << 5) - hash) + storeName.charCodeAt(i);
    hash |= 0;
  }
  return STORE_COLORS[Math.abs(hash) % STORE_COLORS.length];
}

export default function TgQueueCard({
  storeName,
  clientName,
  productName,
  lastMessageText,
  lastMessageDate,
  hasDraft,
  isSkipped,
  onClick,
}: TgQueueCardProps) {
  const timeAgo = lastMessageDate
    ? formatDistanceToNow(new Date(lastMessageDate), { locale: ru, addSuffix: false })
    : '';

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: 'var(--tg-secondary-bg)',
        borderRadius: '12px',
        padding: '12px 14px',
        marginBottom: '8px',
        cursor: 'pointer',
        transition: 'opacity 0.15s',
        opacity: isSkipped ? 0.5 : 1,
      }}
    >
      {/* Top row: store badge + time */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
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
