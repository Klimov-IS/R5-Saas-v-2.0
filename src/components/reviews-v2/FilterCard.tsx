/**
 * FilterCard Component
 * Professional SaaS-style filter system with multi-select checkboxes
 */

import React from 'react';
import { Search, Filter, RefreshCw } from 'lucide-react';

// Filter options
const COMPLAINT_STATUS_OPTIONS = [
  { value: 'not_sent', label: 'Не отправлена' },
  { value: 'draft', label: 'Черновик' },
  { value: 'sent', label: 'Отправлена' },
  { value: 'approved', label: 'Одобрена' },
  { value: 'rejected', label: 'Отклонена' },
  { value: 'pending', label: 'На рассмотрении' },
];

const PRODUCT_STATUS_OPTIONS = [
  { value: 'active', label: 'Активные' },
  { value: 'not_working', label: 'Не в работе' },
  { value: 'paused', label: 'Приостановлено' },
  { value: 'completed', label: 'Завершено' },
];

const REVIEW_STATUS_OPTIONS = [
  { value: 'visible', label: 'Виден' },
  { value: 'unpublished', label: 'Снят с публикации' },
  { value: 'excluded', label: 'Исключён' },
];

export type FilterState = {
  search: string;
  ratings: number[];
  complaintStatuses: string[];  // [] = all
  productStatuses: string[];    // [] = all
  reviewStatusesWB: string[];   // [] = all
};

type Props = {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  ratingCounts: { [key: number]: number };
  onSync?: () => void;
  isSyncing?: boolean;
};

export const FilterCard: React.FC<Props> = ({
  filters,
  onFiltersChange,
  ratingCounts,
  onSync,
  isSyncing = false,
}) => {
  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleRating = (rating: number) => {
    const newRatings = filters.ratings.includes(rating)
      ? filters.ratings.filter(r => r !== rating)
      : [...filters.ratings, rating];
    updateFilter('ratings', newRatings);
  };

  const toggleComplaintStatus = (status: string) => {
    const newStatuses = filters.complaintStatuses.includes(status)
      ? filters.complaintStatuses.filter(s => s !== status)
      : [...filters.complaintStatuses, status];
    updateFilter('complaintStatuses', newStatuses);
  };

  const toggleProductStatus = (status: string) => {
    const newStatuses = filters.productStatuses.includes(status)
      ? filters.productStatuses.filter(s => s !== status)
      : [...filters.productStatuses, status];
    updateFilter('productStatuses', newStatuses);
  };

  const toggleReviewStatus = (status: string) => {
    const newStatuses = filters.reviewStatusesWB.includes(status)
      ? filters.reviewStatusesWB.filter(s => s !== status)
      : [...filters.reviewStatusesWB, status];
    updateFilter('reviewStatusesWB', newStatuses);
  };

  return (
    <div className="filter-card">
      {/* Header */}
      <div className="filter-header">
        <h3 className="filter-title">
          <Filter style={{ width: '18px', height: '18px' }} />
          Фильтры
        </h3>
        <div className="filter-actions">
          {onSync && (
            <button
              className="btn btn-primary btn-sm"
              onClick={onSync}
              disabled={isSyncing}
            >
              <RefreshCw
                style={{ width: '14px', height: '14px' }}
                className={isSyncing ? 'spinning' : ''}
              />
              {isSyncing ? 'Синхронизация...' : 'Синхронизировать'}
            </button>
          )}
        </div>
      </div>

      {/* Search Row */}
      <div className="search-section">
        <div className="filter-group search-group">
          <label className="filter-label">Поиск</label>
          <div className="search-row">
            <Search className="search-icon-standalone" style={{ width: '18px', height: '18px' }} />
            <input
              type="text"
              className="search-input-no-icon"
              placeholder="ID отзыва, текст, автор..."
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Rating Filters */}
      <div className="filter-section">
        <label className="filter-label">Рейтинг отзыва</label>
        <div className="checkbox-group">
          {[1, 2, 3, 4, 5].map((rating) => (
            <label
              key={rating}
              className={`filter-checkbox ${filters.ratings.includes(rating) ? 'checked' : ''}`}
            >
              <input
                type="checkbox"
                checked={filters.ratings.includes(rating)}
                onChange={() => toggleRating(rating)}
              />
              <span>{'⭐'.repeat(rating)} {rating}</span>
              <span className="filter-count">
                ({(ratingCounts[rating] || 0).toLocaleString('ru-RU')})
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Complaint Status Filters */}
      <div className="filter-section">
        <label className="filter-label">
          Статус жалобы
          {filters.complaintStatuses.length === 0 && <span className="all-hint">(все)</span>}
        </label>
        <div className="checkbox-group">
          {COMPLAINT_STATUS_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`filter-checkbox ${filters.complaintStatuses.includes(opt.value) ? 'checked' : ''}`}
            >
              <input
                type="checkbox"
                checked={filters.complaintStatuses.includes(opt.value)}
                onChange={() => toggleComplaintStatus(opt.value)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Product Status Filters */}
      <div className="filter-section">
        <label className="filter-label">
          Статус товара
          {filters.productStatuses.length === 0 && <span className="all-hint">(все)</span>}
        </label>
        <div className="checkbox-group">
          {PRODUCT_STATUS_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`filter-checkbox ${filters.productStatuses.includes(opt.value) ? 'checked' : ''}`}
            >
              <input
                type="checkbox"
                checked={filters.productStatuses.includes(opt.value)}
                onChange={() => toggleProductStatus(opt.value)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Review Status Filters */}
      <div className="filter-section">
        <label className="filter-label">
          Статус отзыва на WB
          {filters.reviewStatusesWB.length === 0 && <span className="all-hint">(все)</span>}
        </label>
        <div className="checkbox-group">
          {REVIEW_STATUS_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`filter-checkbox ${filters.reviewStatusesWB.includes(opt.value) ? 'checked' : ''}`}
            >
              <input
                type="checkbox"
                checked={filters.reviewStatusesWB.includes(opt.value)}
                onChange={() => toggleReviewStatus(opt.value)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      <style jsx>{`
        .filter-card {
          background: white;
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-lg);
          padding: var(--spacing-2xl) var(--spacing-3xl);
          margin-bottom: var(--spacing-2xl);
          box-shadow: var(--shadow-sm);
        }

        .filter-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--spacing-lg);
        }

        .filter-title {
          font-size: var(--font-size-lg);
          font-weight: 600;
          color: var(--color-foreground);
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
        }

        .filter-actions {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: var(--spacing-xs);
          padding: var(--spacing-sm) var(--spacing-md);
          border-radius: var(--radius-md);
          font-size: var(--font-size-sm);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
          outline: none;
        }

        .btn-sm {
          padding: var(--spacing-xs) var(--spacing-md);
          font-size: var(--font-size-xs);
        }

        .btn-primary {
          background-color: var(--color-primary);
          color: white;
          box-shadow: var(--shadow-sm);
        }

        .btn-primary:hover:not(:disabled) {
          background-color: var(--color-primary-hover);
          box-shadow: var(--shadow-md);
          transform: translateY(-1px);
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .spinning {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .search-section {
          margin-bottom: var(--spacing-lg);
        }

        .filter-section {
          margin-bottom: var(--spacing-lg);
        }

        .filter-section:last-child {
          margin-bottom: 0;
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
        }

        .search-group {
          gap: 0;
        }

        .filter-label {
          font-size: var(--font-size-xs);
          font-weight: 600;
          color: var(--color-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: var(--spacing-sm);
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
        }

        .all-hint {
          font-weight: 400;
          text-transform: none;
          font-size: var(--font-size-xs);
          color: var(--color-muted);
        }

        .search-row {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
        }

        .search-icon-standalone {
          color: var(--color-muted);
          flex-shrink: 0;
        }

        .search-input-no-icon {
          width: 100%;
          max-width: 400px;
          height: 36px;
          padding: var(--spacing-sm) var(--spacing-md);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          font-size: var(--font-size-sm);
          transition: all 0.15s;
          outline: none;
          box-sizing: border-box;
        }

        .search-input-no-icon:focus {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .checkbox-group {
          display: flex;
          gap: var(--spacing-sm);
          flex-wrap: wrap;
        }

        .filter-checkbox {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          padding: var(--spacing-xs) var(--spacing-md);
          background: white;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.15s;
          user-select: none;
          font-size: var(--font-size-sm);
        }

        .filter-checkbox:hover {
          border-color: var(--color-primary);
          background: #eff6ff;
        }

        .filter-checkbox.checked {
          border-color: var(--color-primary);
          background: #eff6ff;
        }

        .filter-checkbox input[type='checkbox'] {
          width: 14px;
          height: 14px;
          cursor: pointer;
        }

        .filter-count {
          font-size: var(--font-size-xs);
          color: var(--color-muted);
          margin-left: 2px;
        }

        @media (max-width: 1200px) {
          .checkbox-group {
            flex-direction: column;
          }

          .filter-checkbox {
            width: fit-content;
          }
        }
      `}</style>
    </div>
  );
};
