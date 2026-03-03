'use client';


const COMPLETION_REASONS: Record<string, string> = {
  review_deleted: 'Отзыв удален',
  review_upgraded: 'Отзыв дополнен',
  review_resolved: 'Не влияет на рейтинг',
  refusal: 'Отказ',
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

const TAG_LABELS: Record<string, string> = {
  deletion_candidate: 'Кандидат',
  deletion_offered: 'Оффер отправлен',
  deletion_agreed: 'Клиент согласен',
  deletion_confirmed: 'Отзыв удалён',
};

const TAG_META_COLORS: Record<string, string> = {
  deletion_candidate: '#92400E',
  deletion_offered: '#1E40AF',
  deletion_agreed: '#065F46',
  deletion_confirmed: '#065F46',
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
  tag?: string | null;
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
  lastMessageText,
  lastMessageDate,
  lastMessageSender,
  hasDraft,
  status,
  tag,
  completionReason,
  isSkipped,
  isSelected,
  selectionMode,
  onToggleSelect,
  onClick,
  reviewRating,
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
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (d.toDateString() === yesterday.toDateString()) return `вчера ${time}`;
        const date = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
        return `${date}`;
      })()
    : '';

  const senderPrefix = lastMessageSender === 'seller' ? 'Вы: ' : lastMessageSender === 'client' ? 'Покупатель: ' : '';
  const isClosed = status === 'closed';
  const accentColor = reviewRating ? (ACCENT_COLORS[reviewRating] || '#E6E8EC') : '#E6E8EC';
  const ratingStars = reviewRating != null ? '★'.repeat(reviewRating) : null;
  const ratingColor = reviewRating != null ? (RATING_COLORS[reviewRating] || '#9CA3AF') : undefined;

  // Build meta-line parts: store name + optional tag
  const tagLabel = tag && TAG_LABELS[tag] ? TAG_LABELS[tag] : null;
  const tagColor = tag && TAG_META_COLORS[tag] ? TAG_META_COLORS[tag] : undefined;
  const ozonBadge = marketplace === 'ozon';

  return (
    <div
      onClick={selectionMode ? onToggleSelect : onClick}
      style={{
        backgroundColor: isSelected ? 'rgba(37,99,235,0.08)' : '#FFFFFF',
        borderRadius: '16px',
        padding: '12px 14px 12px 14px',
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
      {/* Row 1: Rating stars + name + time */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
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
          {ratingStars && (
            <span style={{ fontSize: '12px', color: ratingColor, letterSpacing: '-1px', flexShrink: 0 }}>
              {ratingStars}
            </span>
          )}
          <span style={{ fontSize: '15px', fontWeight: 600, color: '#111827' }}>
            {clientName}
          </span>
        </div>
        <span style={{ fontSize: '11px', color: '#6B7280', fontWeight: 500, flexShrink: 0 }}>
          {timeAgo}
        </span>
      </div>

      {/* Row 2: Message preview */}
      {lastMessageText && (
        <div className="line-clamp-2" style={{
          fontSize: '13px',
          color: 'rgba(17,24,39,0.8)',
          lineHeight: 1.5,
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

      {/* Row 3: Status indicators (draft + sequence) */}
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

      {/* Row 4: Meta-line (store + tag + OZON badge) — only if useful */}
      <div style={{ marginTop: '6px', fontSize: '10px', color: '#9CA3AF', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span>{storeName}</span>
        {ozonBadge && (
          <>
            <span style={{ color: '#D1D5DB' }}>·</span>
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              padding: '1px 5px', borderRadius: '4px',
              background: '#005bff', color: 'white',
              fontSize: '9px', fontWeight: 700, letterSpacing: '0.5px',
            }}>
              OZ
            </span>
          </>
        )}
        {tagLabel && (
          <>
            <span style={{ color: '#D1D5DB' }}>·</span>
            <span style={{ color: tagColor, fontWeight: 600 }}>{tagLabel}</span>
          </>
        )}
      </div>
    </div>
  );
}
