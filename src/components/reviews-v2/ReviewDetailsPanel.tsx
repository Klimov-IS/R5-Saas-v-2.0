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
  return (
    <div className="details-content">
      <ComplaintBox review={review} />

      <style jsx>{`
        .details-content {
          padding: 24px 32px;
          background: #f8fafc;
          max-width: 1200px;
          margin: 0 auto;
        }
      `}</style>
    </div>
  );
};
