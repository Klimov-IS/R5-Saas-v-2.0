/**
 * Reviews Page V2
 * Complete redesign with professional filter system and complaint management
 */

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';
import type { Review } from '@/types/reviews';
import { FilterCard, type FilterState } from '@/components/reviews-v2/FilterCard';
import { ReviewRow } from '@/components/reviews-v2/ReviewRow';
import { ReviewBulkActionsBar } from '@/components/reviews-v2/ReviewBulkActionsBar';
import { usePersistedFilters } from '@/hooks/usePersistedFilters';

type Product = {
  id: string;
  nm_id: number;
  name: string;
  vendor_code: string;
  photo_links?: string[];
};

type ReviewsResponse = {
  data: Review[];
  totalCount: number;
};

async function fetchReviewsData(
  storeId: string,
  skip: number,
  take: number,
  filters: FilterState
): Promise<{ reviews: Review[]; totalCount: number }> {
  const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';

  // Build query params (empty array = 'all')
  const params = new URLSearchParams({
    skip: skip.toString(),
    take: take.toString(),
    rating: filters.ratings.length > 0 ? filters.ratings.join(',') : 'all',
    complaintStatus: filters.complaintStatuses.length > 0 ? filters.complaintStatuses.join(',') : 'all',
    productStatus: filters.productStatuses.length > 0 ? filters.productStatuses.join(',') : 'all',
    reviewStatusWB: filters.reviewStatusesWB.length > 0 ? filters.reviewStatusesWB.join(',') : 'all',
    search: filters.search,
    productIds: filters.productIds && filters.productIds.length > 0 ? filters.productIds.join(',') : 'all',
  });

  // Load reviews and products in parallel
  const [reviewsRes, productsRes] = await Promise.all([
    fetch(`/api/stores/${storeId}/reviews?${params}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    }),
    fetch(`/api/stores/${storeId}/products`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(15000),
    })
  ]);

  if (!reviewsRes.ok || !productsRes.ok) {
    throw new Error(`Failed to fetch data`);
  }

  const reviewsData: ReviewsResponse = await reviewsRes.json();
  const productsData: Product[] = await productsRes.json();

  // Create products map
  const productsMap: Record<string, Product> = {};
  productsData.forEach((p: Product) => {
    productsMap[p.id] = p;
  });

  // Enrich reviews with product data
  const enrichedReviews = reviewsData.data.map(review => ({
    ...review,
    product: productsMap[review.product_id] || null,
  }));

  return {
    reviews: enrichedReviews as Review[],
    totalCount: reviewsData.totalCount
  };
}

export default function ReviewsPageV2() {
  const params = useParams();
  const storeId = params?.storeId as string;

  // Pagination state
  const [skip, setSkip] = useState(0);
  const [take, setTake] = useState(50);

  // Filter state with session persistence
  // Filters are preserved on page refresh and when switching stores
  const {
    filters,
    setFilters: setFiltersBase,
    resetFilters: resetFiltersBase,
    activeFilterCount,
  } = usePersistedFilters();

  // Wrap setFilters to reset pagination when filters change
  const setFilters = (newFilters: FilterState) => {
    setFiltersBase(newFilters);
    setSkip(0); // Reset to first page when filters change
  };

  // Wrap resetFilters to also reset pagination
  const resetFilters = () => {
    resetFiltersBase();
    setSkip(0); // Reset to first page
  };

  const [selectedReviews, setSelectedReviews] = useState<Set<string>>(new Set());

  // Fetch reviews data
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['reviews-v2', storeId, skip, take, filters],
    queryFn: () => fetchReviewsData(storeId, skip, take, filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!storeId,
  });

  // Fetch rating statistics separately (independent of filters)
  // This shows TOTAL counts for ALL reviews, not just filtered ones
  const { data: statsData } = useQuery({
    queryKey: ['review-stats', storeId],
    queryFn: async () => {
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';
      const response = await fetch(`/api/stores/${storeId}/reviews/stats`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json() as Promise<{ ratingCounts: Record<number, number> }>;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!storeId,
  });

  // Fetch products list for dropdown filter (cached independently)
  const { data: productsData } = useQuery({
    queryKey: ['store-products', storeId],
    queryFn: async () => {
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';
      const response = await fetch(`/api/stores/${storeId}/products`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error('Failed to fetch products');
      return response.json() as Promise<Product[]>;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes - products change less frequently
    enabled: !!storeId,
  });

  // Use stats from API (or fallback to zeros)
  const ratingCounts = statsData?.ratingCounts || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  // Handle review selection
  const handleSelectReview = (id: string, selected: boolean) => {
    const newSelected = new Set(selectedReviews);
    if (selected) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedReviews(newSelected);
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected && data?.reviews) {
      setSelectedReviews(new Set(data.reviews.map(r => r.id)));
    } else {
      setSelectedReviews(new Set());
    }
  };

  // Handle sync
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMode, setSyncMode] = useState<'incremental' | 'full'>('incremental');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncMode('incremental');
    const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';

    const syncToast = toast.loading('Синхронизация отзывов...');

    try {
      const response = await fetch(`/api/stores/${storeId}/reviews/update?mode=incremental`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ошибка синхронизации');
      }

      const result = await response.json();
      toast.success(`Синхронизация завершена. Обновлено: ${result.newReviews || 0} отзывов`, {
        id: syncToast,
      });

      // Refresh data
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Не удалось синхронизировать отзывы', {
        id: syncToast,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFullSync = async () => {
    setIsSyncing(true);
    setSyncMode('full');
    const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';

    const syncToast = toast.loading('Полная синхронизация отзывов...');

    try {
      const response = await fetch(`/api/stores/${storeId}/reviews/update?mode=full`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ошибка полной синхронизации');
      }

      const result = await response.json();
      toast.success(`Полная синхронизация завершена. Загружено: ${result.newReviews || 0} отзывов`, {
        id: syncToast,
      });

      // Refresh data
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Не удалось выполнить полную синхронизацию', {
        id: syncToast,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Get eligible reviews for complaint generation
  // Rules: no 5-star reviews, no reviews with complaint_status other than null/not_sent/draft
  const getEligibleReviewIds = (): string[] => {
    if (!data?.reviews) return [];

    const eligibleStatuses = [null, undefined, 'not_sent', 'draft'];

    return data.reviews
      .filter(review => {
        // Skip if not selected
        if (!selectedReviews.has(review.id)) return false;
        // Skip 5-star reviews
        if (review.rating === 5) return false;
        // Skip reviews with complaint in progress
        if (!eligibleStatuses.includes(review.complaint_status as any)) return false;
        return true;
      })
      .map(r => r.id);
  };

  const handleGenerateComplaints = async () => {
    const eligibleIds = getEligibleReviewIds();

    if (eligibleIds.length === 0) {
      toast.error('Нет отзывов, подходящих для генерации жалоб');
      return;
    }

    setIsGenerating(true);
    const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';

    const generateToast = toast.loading(`Генерация жалоб для ${eligibleIds.length} отзывов...`);

    try {
      const response = await fetch(`/api/extension/stores/${storeId}/reviews/generate-complaints-batch`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ review_ids: eligibleIds }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Ошибка генерации жалоб');
      }

      const result = await response.json();
      toast.success(`Сгенерировано жалоб: ${result.stats?.generated || 0}`, {
        id: generateToast,
      });

      // Clear selection and refresh data
      setSelectedReviews(new Set());
      refetch();
    } catch (error: any) {
      toast.error(error.message || 'Не удалось сгенерировать жалобы', {
        id: generateToast,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="reviews-page">
      {/* Filters */}
      <FilterCard
        filters={filters}
        onFiltersChange={setFilters}
        ratingCounts={ratingCounts}
        onSync={handleSync}
        onFullSync={handleFullSync}
        isSyncing={isSyncing}
        syncMode={syncMode}
        onReset={resetFilters}
        activeFilterCount={activeFilterCount}
        products={productsData || []}
      />

      {/* Bulk Actions Bar */}
      <ReviewBulkActionsBar
        selectedCount={selectedReviews.size}
        eligibleCount={getEligibleReviewIds().length}
        onClearSelection={() => setSelectedReviews(new Set())}
        onGenerateComplaints={handleGenerateComplaints}
        isGenerating={isGenerating}
      />

      {/* Results Bar */}
      <div className="results-bar">
        <div className="results-count">
          Всего: <strong>{(data?.totalCount || 0).toLocaleString('ru-RU')} отзывов</strong> |
          Показано: <strong>{(data?.reviews.length || 0).toLocaleString('ru-RU')}</strong>
        </div>
        <div className="page-size-selector">
          <label>На странице:</label>
          <select value={take} onChange={(e) => setTake(parseInt(e.target.value))}>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
            <option value="500">500</option>
          </select>
        </div>
      </div>

      {/* Loading/Error States */}
      {isLoading && (
        <div className="loading-state">
          <RefreshCw className="spinner" style={{ width: '24px', height: '24px' }} />
          Загрузка отзывов...
        </div>
      )}

      {error && (
        <div className="error-state">
          ❌ Ошибка загрузки: {(error as Error).message}
        </div>
      )}

      {/* Reviews Table */}
      {!isLoading && !error && data && (
        <div className="reviews-table-wrapper">
          <table className="reviews-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selectedReviews.size === data.reviews.length && data.reviews.length > 0}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </th>
                <th></th>
                <th>Товар</th>
                <th>Отзыв</th>
                <th>Статусы</th>
                <th>Дата</th>
              </tr>
            </thead>
            <tbody>
              {data.reviews.map((review) => (
                <ReviewRow
                  key={review.id}
                  review={review}
                  isSelected={selectedReviews.has(review.id)}
                  onSelect={handleSelectReview}
                />
              ))}
            </tbody>
          </table>

          {data.reviews.length === 0 && (
            <div className="empty-state">
              <p>Отзывов не найдено</p>
              <p className="empty-state-hint">
                Попробуйте изменить фильтры или синхронизировать данные
              </p>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {data && data.totalCount > take && (
        <div className="pagination">
          <button
            className="pagination-btn"
            disabled={skip === 0}
            onClick={() => setSkip(Math.max(0, skip - take))}
          >
            ← Назад
          </button>
          <span className="pagination-info">
            Страница {Math.floor(skip / take) + 1} из {Math.ceil(data.totalCount / take)}
          </span>
          <button
            className="pagination-btn"
            disabled={skip + take >= data.totalCount}
            onClick={() => setSkip(skip + take)}
          >
            Вперёд →
          </button>
        </div>
      )}

      <style jsx>{`
        .reviews-page {
          /* Inherits from parent layout */
        }

        .results-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--spacing-lg);
          padding: var(--spacing-md) 0;
        }

        .results-count {
          font-size: var(--font-size-sm);
          color: var(--color-muted);
        }

        .results-count strong {
          color: var(--color-foreground);
          font-weight: 600;
        }

        .page-size-selector {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          font-size: var(--font-size-sm);
          color: var(--color-muted);
        }

        .page-size-selector select {
          padding: var(--spacing-xs) var(--spacing-sm);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-base);
          font-size: var(--font-size-sm);
          cursor: pointer;
        }

        .loading-state, .error-state {
          background: white;
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-lg);
          padding: var(--spacing-4xl);
          text-align: center;
          box-shadow: var(--shadow-sm);
        }

        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--spacing-md);
          color: var(--color-muted);
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .error-state {
          color: var(--color-error);
        }

        .reviews-table-wrapper {
          background: white;
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-lg);
          overflow: hidden;
          box-shadow: var(--shadow-sm);
        }

        .reviews-table {
          width: 100%;
          border-collapse: collapse;
        }

        .reviews-table thead {
          background-color: var(--color-border-light);
          border-bottom: 2px solid var(--color-border);
        }

        .reviews-table th {
          padding: var(--spacing-md) var(--spacing-lg);
          text-align: left;
          font-size: var(--font-size-xs);
          font-weight: 600;
          color: var(--color-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .reviews-table th:first-child {
          width: 40px;
          padding-right: 0;
        }

        .reviews-table th:nth-child(2) {
          width: 30px;
          padding: var(--spacing-md) 0;
        }

        .empty-state {
          padding: var(--spacing-4xl);
          text-align: center;
          color: var(--color-muted);
        }

        .empty-state p {
          font-size: var(--font-size-lg);
          margin-bottom: var(--spacing-sm);
        }

        .empty-state-hint {
          font-size: var(--font-size-sm);
        }

        .pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: var(--spacing-sm);
          margin-top: var(--spacing-2xl);
          padding: var(--spacing-lg);
        }

        .pagination-btn {
          padding: var(--spacing-sm) var(--spacing-md);
          background: white;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-base);
          font-size: var(--font-size-sm);
          cursor: pointer;
          transition: all 0.15s;
        }

        .pagination-btn:hover:not(:disabled) {
          background: var(--color-border-light);
          border-color: var(--color-primary);
        }

        .pagination-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .pagination-info {
          font-size: var(--font-size-sm);
          color: var(--color-muted);
          margin: 0 var(--spacing-md);
        }
      `}</style>
    </div>
  );
}
