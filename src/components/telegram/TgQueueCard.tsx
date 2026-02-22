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
  1: '#ef4444',
  2: '#f97316',
  3: '#f59e0b',
  4: '#84cc16',
  5: '#22c55e',
};

const PRODUCT_STATUS_LABELS: Record<string, string> = {
  purchased: 'Выкуп',
  refused: 'Отказ',
  returned: 'Возврат',
  return_requested: 'Запрошен возврат',
  not_specified: 'Не указан',
};

const COMPLAINT_STATUS_LABELS: Record<string, string> = {
  not_sent: 'Не отправлена',
  draft: 'Черновик',
  sent: 'Отправлена',
  approved: 'Одобрена',
  rejected: 'Отклонена',
  pending: 'На рассмотрении',
  reconsidered: 'Пересмотрена',
  not_applicable: 'Нельзя подать',
};

const STRATEGY_LABELS: Record<string, string> = {
  upgrade_to_5: 'Повышение до 5',
  delete: 'Удаление',
  both: 'Обе стратегии',
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
  // Review & product rules
  reviewRating?: number | null;
  reviewDate?: string | null;
  complaintStatus?: string | null;
  productStatus?: string | null;
  offerCompensation?: boolean | null;
  maxCompensation?: string | null;
  compensationType?: string | null;
  compensationBy?: string | null;
  chatStrategy?: string | null;
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
  complaintStatus,
  productStatus,
  offerCompensation,
  maxCompensation,
  compensationBy,
  chatStrategy,
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
    ? new Date(reviewDate).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })
    : null;

  const senderPrefix = lastMessageSender === 'seller' ? 'Вы: ' : lastMessageSender === 'client' ? 'Покупатель: ' : '';
  const isClosed = status === 'closed';

  // Build compact info chips for review data
  const hasReviewInfo = reviewRating != null || productStatus || complaintStatus || chatStrategy;

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
        <span style={{ fontSize: '11px', color: 'var(--tg-hint)' }}>
          {timeAgo}
        </span>
      </div>

      {/* Client name + review rating & date */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
        <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--tg-text)' }}>
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
          }}>
            {'★'.repeat(reviewRating)}
          </span>
        )}
        {reviewDateFormatted && (
          <span style={{ fontSize: '11px', color: 'var(--tg-hint)', flexShrink: 0 }}>
            {reviewDateFormatted}
          </span>
        )}
      </div>

      {/* Product */}
      {productName && (
        <div style={{ fontSize: '13px', color: 'var(--tg-hint)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {productName}
        </div>
      )}

      {/* Compact info chips: product status, complaint, strategy, cashback */}
      {hasReviewInfo && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px', marginBottom: '4px' }}>
          {productStatus && productStatus !== 'unknown' && productStatus !== 'not_specified' && (
            <span style={{
              fontSize: '10px',
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: '6px',
              backgroundColor: productStatus === 'refused' ? 'rgba(239,68,68,0.12)' :
                productStatus === 'purchased' ? 'rgba(34,197,94,0.12)' :
                'rgba(156,163,175,0.12)',
              color: productStatus === 'refused' ? '#ef4444' :
                productStatus === 'purchased' ? '#22c55e' : '#6b7280',
            }}>
              {PRODUCT_STATUS_LABELS[productStatus] || productStatus}
            </span>
          )}
          {complaintStatus && complaintStatus !== 'not_sent' && (
            <span style={{
              fontSize: '10px',
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: '6px',
              backgroundColor: complaintStatus === 'rejected' ? 'rgba(239,68,68,0.12)' :
                complaintStatus === 'approved' ? 'rgba(34,197,94,0.12)' :
                'rgba(245,158,11,0.12)',
              color: complaintStatus === 'rejected' ? '#ef4444' :
                complaintStatus === 'approved' ? '#22c55e' : '#f59e0b',
            }}>
              {COMPLAINT_STATUS_LABELS[complaintStatus] || complaintStatus}
            </span>
          )}
          {chatStrategy && (
            <span style={{
              fontSize: '10px',
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: '6px',
              backgroundColor: 'rgba(59,130,246,0.12)',
              color: '#3b82f6',
            }}>
              {STRATEGY_LABELS[chatStrategy] || chatStrategy}
            </span>
          )}
          {offerCompensation && maxCompensation && (
            <span style={{
              fontSize: '10px',
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: '6px',
              backgroundColor: 'rgba(168,85,247,0.12)',
              color: '#a855f7',
            }}>
              {maxCompensation}₽ {compensationBy === 'r5' ? '(R5)' : compensationBy === 'seller' ? '(продавец)' : ''}
            </span>
          )}
        </div>
      )}

      {/* Message preview with sender prefix */}
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
          {senderPrefix && (
            <span style={{ fontWeight: 600, color: lastMessageSender === 'seller' ? '#3b82f6' : '#f97316' }}>
              {senderPrefix}
            </span>
          )}
          {lastMessageText}
        </div>
      )}

      {/* Footer: draft indicator OR completion reason */}
      <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
        {isClosed && completionReason ? (
          <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: 600 }}>
            {COMPLETION_REASONS[completionReason] || completionReason}
          </span>
        ) : hasDraft ? (
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
