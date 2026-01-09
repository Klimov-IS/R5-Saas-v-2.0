/**
 * StatusBadge Component
 * Displays status badges with appropriate colors and labels
 */

import React from 'react';
import {
  REVIEW_STATUS_LABELS,
  REVIEW_STATUS_COLORS,
  PRODUCT_STATUS_LABELS,
  PRODUCT_STATUS_COLORS,
  COMPLAINT_STATUS_LABELS,
  COMPLAINT_STATUS_COLORS,
  type ReviewStatusWB,
  type ProductStatusByReview,
  type ComplaintStatus,
} from '@/types/reviews';

type Props =
  | { type: 'review_status'; status: ReviewStatusWB }
  | { type: 'product_status'; status: ProductStatusByReview }
  | { type: 'complaint_status'; status: ComplaintStatus };

export const StatusBadge: React.FC<Props> = ({ type, status }) => {
  let label: string;
  let colors: { bg: string; color: string; border: string };

  switch (type) {
    case 'review_status':
      label = REVIEW_STATUS_LABELS[status];
      colors = REVIEW_STATUS_COLORS[status];
      break;
    case 'product_status':
      label = PRODUCT_STATUS_LABELS[status];
      colors = PRODUCT_STATUS_COLORS[status];
      break;
    case 'complaint_status':
      label = COMPLAINT_STATUS_LABELS[status];
      colors = COMPLAINT_STATUS_COLORS[status];
      break;
  }

  return (
    <>
      <span className="badge" style={{
        background: colors.bg,
        color: colors.color,
        border: `1px solid ${colors.border}`
      }}>
        {label}
      </span>

      <style jsx>{`
        .badge {
          display: inline-flex;
          align-items: center;
          gap: var(--spacing-xs);
          padding: var(--spacing-xs) var(--spacing-md);
          border-radius: var(--radius-base);
          font-size: 11px;
          font-weight: 600;
          text-align: center;
          white-space: nowrap;
          justify-content: center;
        }
      `}</style>
    </>
  );
};
