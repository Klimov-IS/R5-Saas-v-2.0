/**
 * Reviews Page V2 — Keyset (cursor) pagination + "Load More"
 * No COUNT query, no OFFSET — O(1) performance at any depth.
 */

'use client';

import { useState, useCallback } from 'react';
import { useQuery, useInfiniteQuery, keepPreviousData } from '@tanstack/react-query';
import { RefreshCw, ChevronDown } from 'lucide-react';
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

type CursorReviewsResponse = {
  data: Review[];
  nextCursor: string | null;
  nextCursorId: string | null;
  hasMore: boolean;
};

const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';

async function fetchReviewsPage(
  storeId: string,
  take: number,
  filters: FilterState,
  cursor?: string,
  cursorId?: string,
): Promise<CursorReviewsResponse> {
  const params = new URLSearchParams({
    take: take.toString(),
    rating: filters.ratings.length > 0 ? filters.ratings.join(',') : 'all',
    complaintStatus: filters.complaintStatuses.length > 0 ? filters.complaintStatuses.join(',') : 'all',
    productStatus: filters.productStatuses.length > 0 ? filters.productStatuses.join(',') : 'all',
    reviewStatusWB: filters.reviewStatusesWB.length > 0 ? filters.reviewStatusesWB.join(',') : 'all',
    chatStatusByReview: filters.chatStatuses.length > 0 ? filters.chatStatuses.join(',') : 'all',
    search: filters.search,
    productIds: filters.productIds && filters.productIds.length > 0 ? filters.productIds.join(',') : 'all',
  });

  if (cursor) params.set('cursor', cursor);
  if (cursorId) params.set('cursorId', cursorId);

  const res = await fetch(`/api/stores/${storeId}/reviews?${params}`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error('Failed to fetch reviews');
  return res.json();
}

export default function ReviewsPageV2() {
  const params = useParams();
  const storeId = params?.storeId as string;

  const [take, setTake] = useState(50);

  const {
    filters,
    setFilters: setFiltersBase,
    resetFilters: resetFiltersBase,
    activeFilterCount,
  } = usePersistedFilters();

  const setFilters = (newFilters: FilterState) => {
    setFiltersBase(newFilters);
  };

  const resetFilters = () => {
    resetFiltersBase();
  };

  const [selectedReviews, setSelectedReviews] = useState<Set<string>>(new Set());

  // Products list (cached independently)
  const { data: productsData } = useQuery({
    queryKey: ['store-products', storeId],
    queryFn: async () => {
      const res = await fetch(`/api/stores/${storeId}/products`, {
        headers: { 'Authorization': `Bearer ${API_KEY}` },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error('Failed to fetch products');
      return res.json() as Promise<Product[]>;
    },
    staleTime: 10 * 60 * 1000,
    enabled: !!storeId,
  });

  // Products map for enrichment
  const productsMap: Record<string, Product> = {};
  productsData?.forEach((p: Product) => { productsMap[p.id] = p; });

  // Rating stats (global, independent of filters)
  const { data: statsData } = useQuery({
    queryKey: ['review-stats', storeId],
    queryFn: async () => {
      const res = await fetch(`/api/stores/${storeId}/reviews/stats`, {
        headers: { 'Authorization': `Bearer ${API_KEY}` },
      });
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json() as Promise<{ ratingCounts: Record<number, number> }>;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!storeId,
  });

  // Infinite query with cursor pagination
  const {
    data,
    isLoading,
    isFetching,
    isFetchingNextPage,
    error,
    fetchNextPage,
    hasNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ['reviews-v2', storeId, take, filters],
    queryFn: ({ pageParam }) =>
      fetchReviewsPage(
        storeId,
        take,
        filters,
        pageParam?.cursor,
        pageParam?.cursorId,
      ),
    initialPageParam: undefined as { cursor: string; cursorId: string } | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.nextCursor
        ? { cursor: lastPage.nextCursor, cursorId: lastPage.nextCursorId || '' }
        : undefined,
    staleTime: 5 * 60 * 1000,
    enabled: !!storeId,
  });

  // Flatten all pages into a single reviews array + enrich with products
  const allReviews: Review[] = (data?.pages ?? []).flatMap(page =>
    page.data.map(review => ({
      ...review,
      product: productsMap[review.product_id] || null,
    }))
  ) as Review[];

  const ratingCounts = statsData?.ratingCounts || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  // Selection handlers
  const handleSelectReview = (id: string, selected: boolean) => {
    const newSelected = new Set(selectedReviews);
    if (selected) newSelected.add(id);
    else newSelected.delete(id);
    setSelectedReviews(newSelected);
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedReviews(new Set(allReviews.map(r => r.id)));
    } else {
      setSelectedReviews(new Set());
    }
  };

  // Sync handlers
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMode, setSyncMode] = useState<'incremental' | 'full'>('incremental');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncMode('incremental');
    const syncToast = toast.loading('Синхронизация отзывов...');
    try {
      const response = await fetch(`/api/stores/${storeId}/reviews/update?mode=incremental`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Ошибка синхронизации');
      }
      const result = await response.json();
      toast.success(`Синхронизация завершена. Обновлено: ${result.newReviews || 0} отзывов`, { id: syncToast });
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Не удалось синхронизировать отзывы', { id: syncToast });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFullSync = async () => {
    setIsSyncing(true);
    setSyncMode('full');
    const syncToast = toast.loading('Полная синхронизация отзывов...');
    try {
      const response = await fetch(`/api/stores/${storeId}/reviews/update?mode=full`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Ошибка полной синхронизации');
      }
      const result = await response.json();
      toast.success(`Полная синхронизация завершена. Загружено: ${result.newReviews || 0} отзывов`, { id: syncToast });
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Не удалось выполнить полную синхронизацию', { id: syncToast });
    } finally {
      setIsSyncing(false);
    }
  };

  // Complaint generation
  const getEligibleReviewIds = (): string[] => {
    const eligibleStatuses = [null, undefined, 'not_sent', 'draft'];
    return allReviews
      .filter(review => {
        if (!selectedReviews.has(review.id)) return false;
        if (review.rating === 5) return false;
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
    const generateToast = toast.loading(`Генерация жалоб для ${eligibleIds.length} отзывов...`);
    try {
      const response = await fetch(`/api/extension/stores/${storeId}/reviews/generate-complaints-batch`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_ids: eligibleIds }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Ошибка генерации жалоб');
      }
      const result = await response.json();
      toast.success(`Сгенерировано жалоб: ${result.stats?.generated || 0}`, { id: generateToast });
      setSelectedReviews(new Set());
      refetch();
    } catch (err: any) {
      toast.error(err.message || 'Не удалось сгенерировать жалобы', { id: generateToast });
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
          Загружено: <strong>{allReviews.length.toLocaleString('ru-RU')} отзывов</strong>
          {hasNextPage && <span className="has-more-hint"> (есть ещё)</span>}
          {isFetching && !isLoading && !isFetchingNextPage && <span className="refetch-indicator">Обновление...</span>}
        </div>
        <div className="page-size-selector">
          <label>Загружать по:</label>
          <select value={take} onChange={(e) => setTake(parseInt(e.target.value))}>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
          </select>
        </div>
      </div>

      {/* Loading State (initial) */}
      {isLoading && (
        <div className="loading-state">
          <RefreshCw className="spinner" style={{ width: '24px', height: '24px' }} />
          Загрузка отзывов...
        </div>
      )}

      {error && (
        <div className="error-state">
          Ошибка загрузки: {(error as Error).message}
        </div>
      )}

      {/* Reviews Table */}
      {!isLoading && !error && allReviews.length > 0 && (
        <div className="reviews-table-wrapper" style={{ opacity: (isFetching && !isFetchingNextPage) ? 0.6 : 1, transition: 'opacity 0.2s' }}>
          <table className="reviews-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={selectedReviews.size === allReviews.length && allReviews.length > 0}
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
              {allReviews.map((review) => (
                <ReviewRow
                  key={review.id}
                  review={review}
                  isSelected={selectedReviews.has(review.id)}
                  onSelect={handleSelectReview}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && allReviews.length === 0 && (
        <div className="empty-state-wrapper">
          <div className="empty-state">
            <p>Отзывов не найдено</p>
            <p className="empty-state-hint">
              Попробуйте изменить фильтры или синхронизировать данные
            </p>
          </div>
        </div>
      )}

      {/* Load More Button */}
      {hasNextPage && (
        <div className="load-more">
          <button
            className="load-more-btn"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <>
                <RefreshCw className="spinner" style={{ width: '16px', height: '16px' }} />
                Загрузка...
              </>
            ) : (
              <>
                <ChevronDown style={{ width: '16px', height: '16px' }} />
                Загрузить ещё {take}
              </>
            )}
          </button>
        </div>
      )}

      {/* End of List */}
      {!hasNextPage && allReviews.length > 0 && !isLoading && (
        <div className="end-of-list">
          Все отзывы загружены ({allReviews.length.toLocaleString('ru-RU')})
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

        .has-more-hint {
          color: var(--color-primary);
          font-size: var(--font-size-xs);
        }

        .refetch-indicator {
          margin-left: var(--spacing-sm);
          color: var(--color-primary);
          font-size: var(--font-size-xs);
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
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

        .empty-state-wrapper {
          background: white;
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
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

        .load-more {
          display: flex;
          justify-content: center;
          margin-top: var(--spacing-2xl);
          padding: var(--spacing-lg);
        }

        .load-more-btn {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          padding: var(--spacing-md) var(--spacing-2xl);
          background: white;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-base);
          font-size: var(--font-size-sm);
          font-weight: 500;
          color: var(--color-foreground);
          cursor: pointer;
          transition: all 0.15s;
        }

        .load-more-btn:hover:not(:disabled) {
          background: var(--color-border-light);
          border-color: var(--color-primary);
          color: var(--color-primary);
        }

        .load-more-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .end-of-list {
          text-align: center;
          padding: var(--spacing-xl);
          font-size: var(--font-size-sm);
          color: var(--color-muted);
        }
      `}</style>
    </div>
  );
}
