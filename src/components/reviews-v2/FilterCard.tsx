/**
 * FilterCard Component
 * Professional SaaS-style filter system with preset pills and advanced filters
 */

import React from 'react';
import { Search, Filter, Save, RefreshCw } from 'lucide-react';
import type { ReviewStatusWB, ProductStatusByReview, ComplaintStatus } from '@/types/reviews';

export type FilterState = {
  search: string;
  ratings: number[];
  complaintStatus: ComplaintStatus | 'all';
  productStatus: 'all' | 'active' | 'not_working' | 'paused' | 'completed';
  reviewStatusWB: ReviewStatusWB | 'all';
};

export type PresetFilter = 'attention' | 'approved' | 'rejected' | 'drafts' | 'all';

type Props = {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  activePreset: PresetFilter;
  onPresetChange: (preset: PresetFilter) => void;
  stats: {
    attention: number;
    approved: number;
    rejected: number;
    drafts: number;
    total: number;
  };
  ratingCounts: { [key: number]: number };
  onSync?: () => void;
  isSyncing?: boolean;
};

export const FilterCard: React.FC<Props> = ({
  filters,
  onFiltersChange,
  activePreset,
  onPresetChange,
  stats,
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
          <button className="save-view-button">
            <Save style={{ width: '14px', height: '14px' }} />
            Сохранить вид
          </button>
        </div>
      </div>

      {/* Preset Quick Filters */}
      <div className="preset-filters">
        <button
          className={`preset-pill ${activePreset === 'attention' ? 'active' : ''}`}
          onClick={() => onPresetChange('attention')}
        >
          🔥 Требуют внимания ({stats.attention.toLocaleString('ru-RU')})
        </button>
        <button
          className={`preset-pill ${activePreset === 'approved' ? 'active' : ''}`}
          onClick={() => onPresetChange('approved')}
        >
          ✅ Жалобы одобрены ({stats.approved.toLocaleString('ru-RU')})
        </button>
        <button
          className={`preset-pill ${activePreset === 'rejected' ? 'active' : ''}`}
          onClick={() => onPresetChange('rejected')}
        >
          ❌ Жалобы отклонены ({stats.rejected.toLocaleString('ru-RU')})
        </button>
        <button
          className={`preset-pill ${activePreset === 'drafts' ? 'active' : ''}`}
          onClick={() => onPresetChange('drafts')}
        >
          📝 Черновики жалоб ({stats.drafts.toLocaleString('ru-RU')})
        </button>
        <button
          className={`preset-pill ${activePreset === 'all' ? 'active' : ''}`}
          onClick={() => onPresetChange('all')}
        >
          👁️ Все отзывы ({stats.total.toLocaleString('ru-RU')})
        </button>
      </div>

      {/* Advanced Filters Grid */}
      <div className="filters-grid">
        {/* Search */}
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

        {/* Complaint Status */}
        <div className="filter-group">
          <label className="filter-label">Статус жалобы</label>
          <select
            className="filter-select"
            value={filters.complaintStatus}
            onChange={(e) => updateFilter('complaintStatus', e.target.value as any)}
          >
            <option value="not_sent">Не отправлена</option>
            <option value="all">Все статусы</option>
            <option value="draft">Черновик</option>
            <option value="sent">Отправлена</option>
            <option value="approved">Одобрена</option>
            <option value="rejected">Отклонена</option>
            <option value="pending">На рассмотрении</option>
          </select>
        </div>

        {/* Product Status */}
        <div className="filter-group">
          <label className="filter-label">Статус товара</label>
          <select
            className="filter-select"
            value={filters.productStatus}
            onChange={(e) => updateFilter('productStatus', e.target.value as any)}
          >
            <option value="active">Только активные</option>
            <option value="all">Все товары</option>
            <option value="not_working">Не в работе</option>
            <option value="paused">Приостановлено</option>
            <option value="completed">Завершено</option>
          </select>
        </div>

        {/* Review Status WB */}
        <div className="filter-group">
          <label className="filter-label">Статус отзыва</label>
          <select
            className="filter-select"
            value={filters.reviewStatusWB}
            onChange={(e) => updateFilter('reviewStatusWB', e.target.value as any)}
          >
            <option value="all">Все отзывы</option>
            <option value="visible">Виден</option>
            <option value="unpublished">Снят с публикации</option>
            <option value="excluded">Исключён</option>
          </select>
        </div>
      </div>

      {/* Rating Filters */}
      <div className="rating-filters-group">
        <label className="filter-label">Рейтинг отзыва</label>
        <div className="rating-filters">
          {[1, 2, 3, 4, 5].map((rating) => (
            <label
              key={rating}
              className={`rating-checkbox ${filters.ratings.includes(rating) ? 'checked' : ''}`}
            >
              <input
                type="checkbox"
                checked={filters.ratings.includes(rating)}
                onChange={() => toggleRating(rating)}
              />
              <span>{'⭐'.repeat(rating)} {rating}</span>
              <span className="rating-count">
                ({(ratingCounts[rating] || 0).toLocaleString('ru-RU')})
              </span>
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
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        .save-view-button {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          padding: var(--spacing-sm) var(--spacing-md);
          background: var(--color-border-light);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          font-size: var(--font-size-sm);
          cursor: pointer;
          transition: all 0.15s;
          font-weight: 500;
        }

        .save-view-button:hover {
          background: var(--color-border);
        }

        .preset-filters {
          display: flex;
          gap: var(--spacing-sm);
          margin-bottom: var(--spacing-xl);
          flex-wrap: wrap;
        }

        .preset-pill {
          padding: var(--spacing-sm) var(--spacing-lg);
          background: white;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          font-size: var(--font-size-sm);
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }

        .preset-pill:hover {
          border-color: var(--color-primary);
          background: #eff6ff;
        }

        .preset-pill.active {
          background: var(--color-primary);
          color: white;
          border-color: var(--color-primary);
        }

        .filters-grid {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          gap: var(--spacing-lg);
          margin-bottom: var(--spacing-lg);
          align-items: flex-end;
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
          margin-bottom: var(--spacing-xs);
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

        /* Legacy styles - keep for backward compatibility if needed */
        .search-wrapper {
          position: relative;
        }

        .search-icon {
          position: absolute;
          left: var(--spacing-md);
          top: 50%;
          transform: translateY(-50%);
          color: var(--color-muted);
          pointer-events: none;
        }

        .search-input {
          width: 100%;
          height: 36px;
          padding: var(--spacing-sm) var(--spacing-md);
          padding-left: 40px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          font-size: var(--font-size-sm);
          transition: all 0.15s;
          outline: none;
          box-sizing: border-box;
        }

        .search-input:focus {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .filter-select {
          height: 36px;
          padding: var(--spacing-sm) var(--spacing-md);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          font-size: var(--font-size-sm);
          background: white;
          cursor: pointer;
          transition: border-color 0.15s;
          outline: none;
          box-sizing: border-box;
        }

        .filter-select:focus {
          border-color: var(--color-primary);
        }

        .rating-filters-group {
          margin-top: var(--spacing-md);
        }

        .rating-filters {
          display: flex;
          gap: var(--spacing-md);
          flex-wrap: wrap;
        }

        .rating-checkbox {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-sm) var(--spacing-md);
          background: white;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          cursor: pointer;
          transition: all 0.15s;
          user-select: none;
          font-size: var(--font-size-sm);
        }

        .rating-checkbox:hover {
          border-color: var(--color-primary);
          background: #eff6ff;
        }

        .rating-checkbox.checked {
          border-color: var(--color-primary);
          background: #eff6ff;
        }

        .rating-checkbox input[type='checkbox'] {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }

        .rating-count {
          font-size: var(--font-size-xs);
          color: var(--color-muted);
          margin-left: 2px;
        }

        @media (max-width: 1200px) {
          .filters-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};
