/**
 * FilterCard Component
 * Professional SaaS-style filter system with multi-select dropdowns
 *
 * Layout: 2 rows + divider
 *   Row 1 (primary):  Search | Rating pills | Exclude toggle
 *   ---divider---
 *   Row 2 (secondary): Product dropdown | 4 status dropdowns | Reset button
 */

import React from 'react';
import { Search, RotateCcw } from 'lucide-react';
import { MultiSelectDropdown } from './MultiSelectDropdown';

// Filter options
// Статус 'sent' удалён - при отправке сразу ставится 'pending'
const COMPLAINT_STATUS_OPTIONS = [
  { value: 'not_sent', label: 'Без черновика' },
  { value: 'draft', label: 'Черновик' },
  { value: 'pending', label: 'На рассмотрении' },
  { value: 'approved', label: 'Одобрена' },
  { value: 'rejected', label: 'Отклонена' },
  { value: 'reconsidered', label: 'Пересмотрена' },
  { value: 'not_applicable', label: 'Нельзя подать' },
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
  { value: 'deleted', label: 'Удалён' },
];

const CHAT_STATUS_OPTIONS = [
  { value: 'unavailable', label: 'Недоступен' },
  { value: 'available', label: 'Доступен' },
  { value: 'opened', label: 'Открыт' },
  { value: 'unknown', label: 'Неизвестно' },
];

export type FilterState = {
  search: string;
  ratings: number[];
  complaintStatuses: string[];  // [] = all
  productStatuses: string[];    // [] = all
  reviewStatusesWB: string[];   // [] = all
  chatStatuses: string[];       // [] = all
  productIds: string[];         // [] = all products, array of nm_ids
  hideRatingExcluded: boolean;  // hide reviews excluded from WB rating
};

type ProductOption = {
  id: string;
  nm_id: number;
  name: string;
  vendor_code?: string;
};

type Props = {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  ratingCounts: { [key: number]: number };
  onReset?: () => void;
  activeFilterCount?: number;
  products?: ProductOption[];
};

export const FilterCard: React.FC<Props> = ({
  filters,
  onFiltersChange,
  ratingCounts,
  onReset,
  activeFilterCount = 0,
  products = [],
}) => {
  const productOptions = products.map(p => ({
    value: String(p.nm_id),
    label: p.name ? `${p.name} (${p.nm_id})` : String(p.nm_id),
  }));

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
      {/* Row 1: Search + Rating pills + Exclude toggle */}
      <div className="filter-row-primary">
        {/* Search */}
        <div className="filter-group search-group">
          <label className="filter-label">Поиск</label>
          <div className="search-wrapper">
            <Search className="search-icon" style={{ width: '16px', height: '16px' }} />
            <input
              type="text"
              className="search-input"
              placeholder="ID, текст, автор..."
              value={filters.search}
              onChange={(e) => updateFilter('search', e.target.value)}
            />
          </div>
        </div>

        {/* Rating pills */}
        <div className="filter-group rating-group">
          <label className="filter-label">Рейтинг</label>
          <div className="rating-pills">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                type="button"
                className={`rating-pill ${filters.ratings.includes(rating) ? 'active' : ''}`}
                onClick={() => toggleRating(rating)}
              >
                <span className="star">★</span>
                {rating}
                <span className="count">
                  {(ratingCounts[rating] || 0).toLocaleString('ru-RU')}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Hide rating-excluded toggle — logically next to rating */}
        <div className="filter-group toggle-group">
          <label className="filter-label">&nbsp;</label>
          <label className={`toggle-pill ${filters.hideRatingExcluded ? 'active' : ''}`}>
            <input
              type="checkbox"
              checked={filters.hideRatingExcluded}
              onChange={(e) => updateFilter('hideRatingExcluded', e.target.checked)}
            />
            Без исключённых
          </label>
        </div>
      </div>

      <div className="filter-divider" />

      {/* Row 2: All dropdowns + Reset */}
      <div className="filter-row-secondary">
        {/* Product */}
        <div className="filter-group products-group">
          <label className="filter-label">Товар</label>
          <MultiSelectDropdown
            options={productOptions}
            selected={filters.productIds}
            onChange={(selected) => updateFilter('productIds', selected)}
            allLabel="Все товары"
            searchable={true}
            searchPlaceholder="Поиск по названию или артикулу..."
          />
        </div>

        {/* Complaint Status */}
        <div className="filter-group dropdown-group">
          <label className="filter-label">Жалоба</label>
          <MultiSelectDropdown
            options={COMPLAINT_STATUS_OPTIONS}
            selected={filters.complaintStatuses}
            onChange={(selected) => updateFilter('complaintStatuses', selected)}
            allLabel="Все статусы"
          />
        </div>

        {/* Product Status */}
        <div className="filter-group dropdown-group">
          <label className="filter-label">Статус товара</label>
          <MultiSelectDropdown
            options={PRODUCT_STATUS_OPTIONS}
            selected={filters.productStatuses}
            onChange={(selected) => updateFilter('productStatuses', selected)}
            allLabel="Все статусы"
          />
        </div>

        {/* Review Status WB */}
        <div className="filter-group dropdown-group">
          <label className="filter-label">Видимость (WB)</label>
          <MultiSelectDropdown
            options={REVIEW_STATUS_OPTIONS}
            selected={filters.reviewStatusesWB}
            onChange={(selected) => updateFilter('reviewStatusesWB', selected)}
            allLabel="Все"
          />
        </div>

        {/* Chat Status */}
        <div className="filter-group dropdown-group">
          <label className="filter-label">Чат</label>
          <MultiSelectDropdown
            options={CHAT_STATUS_OPTIONS}
            selected={filters.chatStatuses}
            onChange={(selected) => updateFilter('chatStatuses', selected)}
            allLabel="Все"
          />
        </div>

        {/* Reset — at the end of the dropdowns row */}
        {onReset && activeFilterCount > 0 && (
          <div className="filter-group reset-group">
            <label className="filter-label">&nbsp;</label>
            <button
              className="btn-reset"
              onClick={onReset}
              title="Сбросить все фильтры"
            >
              <RotateCcw style={{ width: '14px', height: '14px' }} />
              Сбросить
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        .filter-card {
          background: white;
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-lg);
          padding: var(--spacing-xl) var(--spacing-2xl);
          margin-bottom: var(--spacing-2xl);
          box-shadow: var(--shadow-sm);
        }

        /* === Row 1: Primary filters === */
        .filter-row-primary {
          display: flex;
          align-items: flex-end;
          gap: var(--spacing-2xl);
          margin-bottom: var(--spacing-lg);
        }

        .filter-group {
          display: flex;
          flex-direction: column;
        }

        .filter-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--color-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: var(--spacing-sm);
        }

        /* Search */
        .search-group {
          flex: 0 1 360px;
          min-width: 200px;
        }

        .search-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .search-icon {
          position: absolute;
          left: 10px;
          color: var(--color-muted);
          pointer-events: none;
        }

        .search-input {
          width: 100%;
          height: 36px;
          padding: 0 12px 0 34px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          font-size: var(--font-size-sm);
          color: var(--color-foreground);
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          box-sizing: border-box;
        }

        .search-input:focus {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .search-input::placeholder {
          color: #94A3B8;
        }

        /* Rating pills */
        .rating-group {
          flex: 0 0 auto;
        }

        .rating-pills {
          display: flex;
          gap: 6px;
        }

        .rating-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          height: 36px;
          padding: 0 12px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background: white;
          font-size: var(--font-size-sm);
          color: var(--color-foreground);
          cursor: pointer;
          transition: all 0.15s;
          user-select: none;
          white-space: nowrap;
          outline: none;
        }

        .rating-pill:hover {
          border-color: var(--color-primary);
          background: #eff6ff;
        }

        .rating-pill.active {
          border-color: var(--color-primary);
          background: #eff6ff;
          color: var(--color-primary);
          font-weight: 600;
        }

        .rating-pill .star {
          color: #F59E0B;
          font-size: 14px;
          line-height: 1;
        }

        .rating-pill .count {
          font-size: 11px;
          color: var(--color-muted);
          font-weight: 400;
        }

        .rating-pill.active .count {
          color: #60A5FA;
        }

        /* Exclude toggle */
        .toggle-group {
          flex: 0 0 auto;
          align-self: flex-end;
        }

        .toggle-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          height: 36px;
          padding: 0 14px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          background: white;
          font-size: var(--font-size-sm);
          color: var(--color-foreground-muted, #475569);
          cursor: pointer;
          transition: all 0.15s;
          user-select: none;
          white-space: nowrap;
        }

        .toggle-pill:hover {
          border-color: var(--color-primary);
        }

        .toggle-pill.active {
          border-color: var(--color-primary);
          background: #eff6ff;
          color: var(--color-primary);
        }

        .toggle-pill input[type='checkbox'] {
          width: 14px;
          height: 14px;
          accent-color: var(--color-primary);
          cursor: pointer;
        }

        /* === Divider === */
        .filter-divider {
          height: 1px;
          background: var(--color-border-light);
          margin-bottom: var(--spacing-lg);
        }

        /* === Row 2: Secondary filters (dropdowns) === */
        .filter-row-secondary {
          display: flex;
          align-items: flex-end;
          gap: var(--spacing-lg);
          flex-wrap: wrap;
        }

        .products-group {
          flex: 1;
          min-width: 220px;
          max-width: 320px;
        }

        .dropdown-group {
          flex: 1;
          min-width: 150px;
          max-width: 200px;
        }

        /* Reset button */
        .reset-group {
          flex: 0 0 auto;
          align-self: flex-end;
        }

        .btn-reset {
          display: inline-flex;
          align-items: center;
          gap: var(--spacing-xs);
          height: 36px;
          padding: 0 var(--spacing-md);
          border-radius: var(--radius-md);
          font-size: var(--font-size-xs);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
          background: transparent;
          color: var(--color-muted);
          border: 1px solid var(--color-border);
          outline: none;
        }

        .btn-reset:hover {
          background: var(--color-border-light);
          color: var(--color-foreground);
        }

        /* === Responsive === */
        @media (max-width: 1200px) {
          .filter-row-primary {
            flex-wrap: wrap;
          }

          .search-group {
            flex: 1 1 100%;
            max-width: none;
          }

          .rating-pills {
            flex-wrap: wrap;
          }

          .filter-row-secondary {
            flex-direction: column;
          }

          .products-group,
          .dropdown-group {
            max-width: none;
            width: 100%;
          }
        }

        @media (max-width: 768px) {
          .filter-card {
            padding: var(--spacing-lg);
          }

          .filter-row-primary {
            gap: var(--spacing-lg);
          }

          .rating-pills {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </div>
  );
};
