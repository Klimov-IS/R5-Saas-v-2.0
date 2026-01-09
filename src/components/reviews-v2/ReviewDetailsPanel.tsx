/**
 * ReviewDetailsPanel Component
 * Expanded row details with 2-column grid: review details + complaint management
 */

import React from 'react';
import { Review } from '@/types/reviews';
import { ComplaintBox } from './ComplaintBox';
import { StatusBadge } from './StatusBadge';

type Props = {
  review: Review;
};

export const ReviewDetailsPanel: React.FC<Props> = ({ review }) => {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="details-content">
      <div className="details-grid">
        {/* Left Column: Review Details */}
        <div className="detail-section">
          <div className="detail-header">📋 Детали отзыва</div>

          {/* Full Review Text */}
          <div className="full-review-text">
            <strong>Текст отзыва:</strong>
            <br />
            {review.text}
            {review.pros && (
              <>
                <br />
                <br />
                <strong>Достоинства:</strong> {review.pros}
              </>
            )}
            {review.cons && (
              <>
                <br />
                <br />
                <strong>Недостатки:</strong> {review.cons}
              </>
            )}
          </div>

          {/* Status Details */}
          <div className="detail-item">
            <span className="detail-label">Статус на WB:</span>
            <span className="detail-value">
              <StatusBadge type="review_status" status={review.review_status_wb} />
            </span>
          </div>

          <div className="detail-item">
            <span className="detail-label">Статус товара:</span>
            <span className="detail-value">
              <StatusBadge type="product_status" status={review.product_status_by_review} />
            </span>
          </div>

          <div className="detail-item">
            <span className="detail-label">Статус чата:</span>
            <span className="detail-value">
              {review.chat_status_by_review === 'available' ? '💬 Доступен' : '🔒 Недоступен'}
            </span>
          </div>

          <div className="detail-item">
            <span className="detail-label">Дата покупки:</span>
            <span className="detail-value">{formatDate(review.purchase_date)}</span>
          </div>

          <div className="detail-item">
            <span className="detail-label">ID отзыва:</span>
            <span className="detail-value" style={{ fontFamily: 'monospace', fontSize: '12px' }}>
              {review.id}
            </span>
          </div>

          {/* Answer Display (if exists) */}
          {review.answer && (
            <>
              <div className="detail-header" style={{ marginTop: 'var(--spacing-lg)' }}>
                💬 Ответ продавца
              </div>
              <div className="answer-box">
                <div className="answer-text">{review.answer.text}</div>
                <div className="answer-meta">
                  Статус: <strong>{review.answer.state}</strong>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Divider */}
        <div className="divider"></div>

        {/* Right Column: Complaint Management */}
        <div className="detail-section">
          <div className="detail-header">⚠️ Жалоба на отзыв</div>
          <ComplaintBox review={review} />
        </div>
      </div>

      <style jsx>{`
        .details-content {
          padding: var(--spacing-2xl) var(--spacing-3xl);
        }

        .details-grid {
          display: grid;
          grid-template-columns: 1fr 1px 1fr;
          gap: var(--spacing-2xl);
        }

        .divider {
          background: var(--color-border);
        }

        .detail-section {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-lg);
        }

        .detail-header {
          font-size: var(--font-size-xs);
          font-weight: 600;
          color: var(--color-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: var(--spacing-sm);
        }

        .detail-item {
          display: flex;
          gap: var(--spacing-md);
        }

        .detail-label {
          min-width: 140px;
          font-size: var(--font-size-sm);
          font-weight: 500;
          color: var(--color-muted);
        }

        .detail-value {
          font-size: var(--font-size-sm);
          color: var(--color-foreground);
          flex: 1;
        }

        .full-review-text {
          background: white;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          padding: var(--spacing-lg);
          font-size: var(--font-size-sm);
          line-height: 1.6;
          color: #334155;
        }

        .answer-box {
          background: #f0f9ff;
          border: 1px solid #3b82f6;
          border-left: 4px solid #3b82f6;
          border-radius: var(--radius-md);
          padding: var(--spacing-lg);
        }

        .answer-text {
          font-size: var(--font-size-sm);
          line-height: 1.5;
          color: #1e40af;
          margin-bottom: var(--spacing-sm);
        }

        .answer-meta {
          font-size: var(--font-size-xs);
          color: var(--color-muted);
        }

        @media (max-width: 1200px) {
          .details-grid {
            grid-template-columns: 1fr;
          }

          .divider {
            display: none;
          }
        }
      `}</style>
    </div>
  );
};
