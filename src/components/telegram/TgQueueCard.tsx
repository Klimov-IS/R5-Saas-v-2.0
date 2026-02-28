'use client';


const COMPLETION_REASONS: Record<string, string> = {
  review_deleted: 'Отзыв удален',
  review_upgraded: 'Отзыв дополнен',
  no_reply: 'Нет ответа',
  old_dialog: 'Старый диалог',
  not_our_issue: 'Не наш вопрос',
  spam: 'Спам',
  negative: 'Негатив',
  other: 'Другое',
};

const RATING_COLORS: Record<number, string> = {
  1: '#ef4444', 2: '#f97316', 3: '#f59e0b', 4: '#84cc16', 5: '#22c55e',
};

const ACCENT_COLORS: Record<number, string> = {
  1: '#EF4444', 2: '#F97316', 3: '#F59E0B', 4: '#84CC16', 5: '#22C55E',
};

interface TgQueueCardProps {
  id: string;
  storeId: string;
  storeName: string;
  marketplace?: string;
  clientName: string;
  productName: string | null;
  lastMessageText: string | null;
  lastMessageDate: string | null;
  lastMessageSender?: 'client' | 'seller' | null;
  hasDraft: boolean;
  draftPreview: string | null;
  status?: string;
  completionReason?: string | null;
  isSkipped?: boolean;
  isSelected?: boolean;
  selectionMode?: boolean;
  onToggleSelect?: () => void;
  onClick: () => void;
  reviewRating?: number | null;
  reviewDate?: string | null;
  seqCurrentStep?: number | null;
  seqMaxSteps?: number | null;
  seqStatus?: string | null;
  [key: string]: any;
}

export default function TgQueueCard({
  storeName,
  marketplace,
  clientName,
  productName,
  lastMessageText,
  lastMessageDate,
  lastMessageSender,
  hasDraft,
  status,
  completionReason,
  isSkipped,
  isSelected,
  selectionMode,
  onToggleSelect,
  onClick,
  reviewRating,
  reviewDate,
  seqCurrentStep,
  seqMaxSteps,
  seqStatus,
}: TgQueueCardProps) {
  const timeAgo = lastMessageDate
    ? (() => {
        const d = new Date(lastMessageDate);
        const now = new Date();
        const isToday = d.toDateString() === now.toDateString();
        const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        if (isToday) return time;
        const date = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
        return `${date} ${time}`;
      })()
    : '';

  const reviewDateFormatted = reviewDate
    ? (() => {
        const d = new Date(reviewDate);
        const date = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
        const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        return `${date} ${time}`;
      })()
    : null;

  const senderPrefix = lastMessageSender === 'seller' ? 'Вы: ' : lastMessageSender === 'client' ? 'Покупатель: ' : '';
  const isClosed = status === 'closed';
  const accentColor = reviewRating ? (ACCENT_COLORS[reviewRating] || '#E6E8EC') : '#E6E8EC';

  return (
    <div
      onClick={selectionMode ? onToggleSelect : onClick}
      style={{
        backgroundColor: isSelected ? 'rgba(37,99,235,0.08)' : '#FFFFFF',
        borderRadius: '16px',
        padding: '14px 14px 14px 16px',
        marginBottom: '8px',
        cursor: 'pointer',
        transition: 'all 0.15s ease-out',
        opacity: isSkipped ? 0.5 : 1,
        border: isSelected ? '2px solid #2563EB' : '1px solid #E6E8EC',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        borderLeft: isSelected ? '2px solid #2563EB' : `3px solid ${accentColor}`,
        overflow: 'hidden',
      }}
    >
      {/* Top row: checkbox + store badge + time */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {selectionMode && (
            <div
              onClick={(e) => { e.stopPropagation(); onToggleSelect?.(); }}
              style={{
                width: '20px',
                height: '20px',
                borderRadius: '6px',
                border: isSelected ? 'none' : '2px solid #D1D5DB',
                backgroundColor: isSelected ? '#2563EB' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.15s ease-out',
              }}
            >
              {isSelected && (
                <span style={{ color: '#fff', fontSize: '11px', fontWeight: 700 }}>✓</span>
              )}
            </div>
          )}
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: '8px',
            backgroundColor: '#2563EB',
            color: '#FFFFFF',
          }}>
            {storeName}
          </span>
          {marketplace === 'ozon' && (
            <span style={{
              fontSize: '10px',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '8px',
              backgroundColor: '#005bff',
              color: '#fff',
            }}>
              OZON
            </span>
          )}
        </div>
        <span style={{ fontSize: '11px', color: '#6B7280', fontWeight: 500 }}>
          {timeAgo}
        </span>
      </div>

      {/* Client name + rating + review date */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
        <span style={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>
          {clientName}
        </span>
        {reviewRating != null && (
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            padding: '1px 6px',
            borderRadius: '6px',
            backgroundColor: RATING_COLORS[reviewRating] || '#9ca3af',
            color: '#fff',
            flexShrink: 0,
            lineHeight: '16px',
          }}>
            {'★'.repeat(reviewRating)}
          </span>
        )}
        {reviewDateFormatted && (
          <span style={{ fontSize: '11px', color: '#6B7280', fontWeight: 500, flexShrink: 0 }}>
            {reviewDateFormatted}
          </span>
        )}
      </div>

      {/* Product */}
      {productName && (
        <div style={{
          fontSize: '13px', color: '#6B7280', marginBottom: '4px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {productName}
        </div>
      )}

      {/* Message preview */}
      {lastMessageText && (
        <div className="line-clamp-2" style={{
          fontSize: '13px',
          color: 'rgba(17,24,39,0.8)',
          lineHeight: 1.5,
          marginTop: '4px',
        }}>
          {senderPrefix && (
            <span style={{
              fontWeight: 600,
              color: lastMessageSender === 'seller' ? '#2563EB' : '#F97316',
            }}>
              {senderPrefix}
            </span>
          )}
          {lastMessageText}
        </div>
      )}

      {/* Footer: draft + sequence */}
      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        {isClosed && completionReason ? (
          <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600 }}>
            {COMPLETION_REASONS[completionReason] || completionReason}
          </span>
        ) : hasDraft ? (
          <span style={{ fontSize: '11px', color: '#10B981', fontWeight: 600 }}>
            ✓ Черновик готов
          </span>
        ) : (
          <span style={{ fontSize: '11px', color: '#F97316', fontWeight: 600 }}>
            ○ Нет черновика
          </span>
        )}
        {seqStatus === 'active' && seqCurrentStep != null && seqMaxSteps != null && (
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: '8px',
            backgroundColor: 'rgba(37,99,235,0.1)',
            color: '#2563EB',
          }}>
            Авто {seqCurrentStep}/{seqMaxSteps}
          </span>
        )}
      </div>
    </div>
  );
}
