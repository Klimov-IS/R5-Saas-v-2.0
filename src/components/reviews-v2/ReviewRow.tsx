/**
 * ReviewRow Component
 * Expandable table row with status badges and details
 */

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Review } from '@/types/reviews';
import { ReviewDetailsPanel } from './ReviewDetailsPanel';
import { StatusBadge } from './StatusBadge';

type Props = {
  review: Review;
  isSelected: boolean;
  onSelect: (id: string, selected: boolean) => void;
};

export const ReviewRow: React.FC<Props> = ({ review, isSelected, onSelect }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getProductImage = () => {
    // TODO: Get actual product image from review.product
    return null;
  };

  return (
    <>
      {/* Main Row */}
      <tr
        className={`review-row ${isExpanded ? 'expanded' : ''}`}
        onClick={toggleExpand}
      >
        {/* Checkbox */}
        <td onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(review.id, e.target.checked)}
          />
        </td>

        {/* Chevron */}
        <td>
          <ChevronDown
            className={`chevron ${isExpanded ? 'rotated' : ''}`}
            style={{ width: '16px', height: '16px' }}
          />
        </td>

        {/* Product */}
        <td className="product-cell">
          <div className="product-info">
            <div className="product-image">
              {review.product?.photo_links?.[0] ? (
                <img
                  src={review.product.photo_links[0]}
                  alt={review.product.name}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : null}
            </div>
            <div className="product-details">
              <div className="product-name">
                {review.product?.name || 'Товар не найден'}
              </div>
              <div className="product-article">
                Арт: {review.product?.nm_id || 'N/A'}
              </div>
            </div>
          </div>
        </td>

        {/* Review */}
        <td className="review-cell">
          <div className="review-meta">
            <div className="stars">
              {Array.from({ length: review.rating }).map((_, i) => (
                <span key={i} className="star">★</span>
              ))}
            </div>
            <span className="author-badge">{review.author}</span>
            <span className="author-badge review-id">ID: {review.id}</span>
          </div>
          <div className="review-text">{review.text}</div>
        </td>

        {/* Status Badges (3 columns) */}
        <td>
          <div className="status-badges">
            {/* Complaint status always visible (first) */}
            <StatusBadge type="complaint_status" status={review.complaint_status} />

            {/* Product status - hide if unknown */}
            {review.product_status_by_review !== 'unknown' && (
              <StatusBadge type="product_status" status={review.product_status_by_review} />
            )}

            {/* Review status - hide if unknown */}
            {review.review_status_wb !== 'unknown' && (
              <StatusBadge type="review_status" status={review.review_status_wb} />
            )}

            {/* Chat status - hide if unknown */}
            {review.chat_status_by_review && review.chat_status_by_review !== 'unknown' && (
              <StatusBadge type="chat_status" status={review.chat_status_by_review} />
            )}
          </div>
        </td>

        {/* Date */}
        <td className="date-cell">{formatDate(review.date)}</td>
      </tr>

      {/* Expanded Details Row */}
      {isExpanded && (
        <tr className="details-row">
          <td colSpan={6}>
            <ReviewDetailsPanel review={review} />
          </td>
        </tr>
      )}

      <style jsx>{`
        .review-row {
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .review-row:hover {
          background-color: #f8fafc;
        }

        .review-row.expanded {
          background-color: #f8fafc;
        }

        .review-row td {
          padding: var(--spacing-lg);
          border-bottom: 1px solid var(--color-border-light);
          font-size: var(--font-size-sm);
          color: var(--color-foreground);
          vertical-align: top;
        }

        .review-row td:first-child {
          width: 40px;
          padding-right: 0;
        }

        .review-row td:nth-child(2) {
          width: 30px;
          padding: var(--spacing-lg) 0;
        }

        .chevron {
          transition: transform 0.2s;
          color: var(--color-muted);
        }

        .chevron.rotated {
          transform: rotate(180deg);
        }

        .product-cell {
          min-width: 200px;
          max-width: 300px;
        }

        .product-info {
          display: flex;
          gap: var(--spacing-md);
          align-items: flex-start;
        }

        .product-image {
          width: 48px;
          height: 64px;
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
          border-radius: var(--radius-base);
          flex-shrink: 0;
          overflow: hidden;
        }

        .product-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .product-details {
          flex: 1;
          min-width: 0;
        }

        .product-name {
          font-weight: 600;
          font-size: var(--font-size-sm);
          color: var(--color-foreground);
          margin-bottom: var(--spacing-xs);
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .product-article {
          font-size: 11px;
          color: var(--color-muted);
          font-family: 'Monaco', 'Courier New', monospace;
        }

        .review-cell {
          min-width: 350px;
        }

        .review-meta {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          margin-bottom: var(--spacing-xs);
          flex-wrap: wrap;
        }

        .stars {
          display: flex;
          gap: 2px;
        }

        .star {
          color: #f59e0b;
          font-size: 14px;
        }

        .author-badge {
          padding: 2px var(--spacing-sm);
          background: var(--color-border-light);
          border-radius: var(--radius-sm);
          font-size: 11px;
          color: var(--color-muted);
        }

        .review-date {
          font-size: 11px;
          color: var(--color-muted);
        }

        .review-id {
          font-family: 'Monaco', 'Courier New', monospace;
          font-size: 10px;
        }

        .review-text {
          color: #334155;
          font-size: var(--font-size-sm);
          line-height: 1.5;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .status-badges {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
          min-width: 140px;
        }

        .date-cell {
          min-width: 100px;
          font-size: var(--font-size-sm);
          color: var(--color-muted);
        }

        .details-row {
          background: #f8fafc;
          border-bottom: 1px solid var(--color-border);
        }

        .details-row td {
          padding: 0 !important;
        }
      `}</style>
    </>
  );
};
