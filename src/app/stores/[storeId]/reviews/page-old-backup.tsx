'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  RefreshCw, Search, Filter, ChevronDown, Star, ThumbsUp,
  CornerDownRight, Trash2, Bot, Send, Flag
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useAutoSave } from '@/components/reviews/useAutoSave';
import { useBulkActions } from '@/components/reviews/useBulkActions';
import { BulkActionsBar } from '@/components/reviews/BulkActionsBar';

type Product = {
  id: string;
  nm_id: number;
  name: string;
  vendor_code: string;
  photo_links?: string[];
};

type Review = {
  id: string;
  product_id: string;
  store_id: string;
  rating: number;
  text: string;
  pros: string | null;
  cons: string | null;
  author: string;
  date: string;
  answer: { text: string; state: string } | null;
  draft_reply: string | null;
  complaint_text: string | null;
  complaint_sent_date: string | null;
  has_answer: boolean;
  has_complaint: boolean;
  has_complaint_draft: boolean;
  product?: Product;
};

type ReviewsResponse = {
  data: Review[];
  totalCount: number;
};

async function fetchReviewsData(
  storeId: string,
  skip: number,
  take: number,
  filters: {
    productId: string;
    answerStatus: string;
    complaintStatus: string;
    ratings: number[];
    activeOnly: boolean;
    search: string;
  }
): Promise<{ reviews: Review[]; totalCount: number }> {
  const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';

  // Build query string for filters
  const params = new URLSearchParams({
    skip: skip.toString(),
    take: take.toString(),
    rating: filters.ratings.length > 0 ? filters.ratings.join(',') : 'all',
    hasAnswer: filters.answerStatus,
    hasComplaint: filters.complaintStatus,
    productId: filters.productId !== 'all' ? filters.productId : '',
    activeOnly: filters.activeOnly.toString(),
    search: filters.search
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
    throw new Error(`Не удалось загрузить данные (статус: ${reviewsRes.status})`);
  }

  const reviewsData: ReviewsResponse = await reviewsRes.json();
  const productsData: Product[] = await productsRes.json();

  // Create products map
  const productsMap: Record<string, Product> = {};
  productsData.forEach((p: Product) => {
    productsMap[p.id] = p;
  });

  // Enrich reviews with product data
  // БД уже вернула отфильтрованные данные, нужно только добавить информацию о товарах
  const enrichedReviews = reviewsData.data.map((r: Review) => ({
    ...r,
    product: productsMap[r.product_id]
  }));

  return {
    reviews: enrichedReviews,
    totalCount: reviewsData.totalCount // Количество отфильтрованных отзывов из БД
  };
}

export default function ReviewsPage() {
  const params = useParams();
  const storeId = params.storeId as string;

  // UI state
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [selectedReviews, setSelectedReviews] = useState<string[]>([]);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Review drafts state (для контроля textarea)
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [complaintDrafts, setComplaintDrafts] = useState<Record<string, string>>({});

  // Loading states для кнопок
  const [generatingReply, setGeneratingReply] = useState<Record<string, boolean>>({});
  const [sendingReply, setSendingReply] = useState<Record<string, boolean>>({});
  const [generatingComplaint, setGeneratingComplaint] = useState<Record<string, boolean>>({});
  const [markingComplaint, setMarkingComplaint] = useState<Record<string, boolean>>({});

  // Auto-save hook
  const { scheduleReplyAutoSave, scheduleComplaintAutoSave } = useAutoSave(storeId);

  // Bulk actions hook
  const {
    bulkGeneratingReplies,
    bulkGeneratingComplaints,
    bulkClearingDrafts,
    handleBulkGenerateReplies,
    handleBulkGenerateComplaints,
    handleBulkClearDrafts
  } = useBulkActions(storeId);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [productFilter, setProductFilter] = useState('all');
  const [answerFilter, setAnswerFilter] = useState('all');
  const [complaintFilter, setComplaintFilter] = useState('all');
  const [ratingFilters, setRatingFilters] = useState<number[]>([]);
  const [activeOnlyFilter, setActiveOnlyFilter] = useState(true);

  // Debounce search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setSearchQuery(searchInput);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [productFilter, answerFilter, complaintFilter, ratingFilters, activeOnlyFilter]);

  const skip = (currentPage - 1) * pageSize;

  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['reviews', storeId, skip, pageSize, productFilter, answerFilter, complaintFilter, ratingFilters, activeOnlyFilter, searchQuery],
    queryFn: () => fetchReviewsData(storeId, skip, pageSize, {
      productId: productFilter,
      answerStatus: answerFilter,
      complaintStatus: complaintFilter,
      ratings: ratingFilters,
      activeOnly: activeOnlyFilter,
      search: searchQuery
    }),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const reviews = data?.reviews || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Handlers
  const toggleFilters = () => setFiltersExpanded(!filtersExpanded);

  const clearFilters = () => {
    setProductFilter('all');
    setAnswerFilter('all');
    setComplaintFilter('all');
    setRatingFilters([]);
    setActiveOnlyFilter(true);
    setSearchInput('');
  };

  const toggleRow = (reviewId: string) => {
    setExpandedRows(prev =>
      prev.includes(reviewId)
        ? prev.filter(id => id !== reviewId)
        : [...prev, reviewId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedReviews.length === reviews.length) {
      setSelectedReviews([]);
    } else {
      setSelectedReviews(reviews.map(r => r.id));
    }
  };

  const toggleSelectReview = (reviewId: string) => {
    setSelectedReviews(prev =>
      prev.includes(reviewId)
        ? prev.filter(id => id !== reviewId)
        : [...prev, reviewId]
    );
  };

  const toggleRatingFilter = (rating: number) => {
    setRatingFilters(prev =>
      prev.includes(rating)
        ? prev.filter(r => r !== rating)
        : [...prev, rating]
    );
  };

  const handleSyncReviews = async () => {
    setIsSyncing(true);
    setSyncError(null);

    try {
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';
      const response = await fetch(`/api/stores/${storeId}/reviews/update?mode=incremental`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Ошибка синхронизации');
      }

      const result = await response.json();
      console.log('Sync result:', result);

      // Refresh reviews data after successful sync
      await refetch();
    } catch (error: any) {
      console.error('Sync error:', error);
      setSyncError(error.message || 'Неизвестная ошибка');
    } finally {
      setIsSyncing(false);
    }
  };


  // Обработчики изменения с auto-save
  const handleReplyChange = (reviewId: string, value: string) => {
    setReplyDrafts(prev => ({ ...prev, [reviewId]: value }));
    scheduleReplyAutoSave(reviewId, value);
  };

  const handleComplaintChange = (reviewId: string, value: string) => {
    setComplaintDrafts(prev => ({ ...prev, [reviewId]: value }));
    scheduleComplaintAutoSave(reviewId, value);
  };

  // AI генерация ответа
  const handleGenerateReply = async (reviewId: string) => {
    setGeneratingReply(prev => ({ ...prev, [reviewId]: true }));

    try {
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';
      const response = await fetch(`/api/stores/${storeId}/reviews/${reviewId}/generate-reply`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Ошибка генерации');
      }

      const { draftReply } = await response.json();

      // Удаляем local state чтобы показывался draft_reply из БД
      setReplyDrafts(prev => {
        const newState = { ...prev };
        delete newState[reviewId];
        return newState;
      });

      await refetch();
    } catch (error: any) {
      console.error('Generate reply error:', error);
      alert(`Ошибка: ${error.message}`);
    } finally {
      setGeneratingReply(prev => ({ ...prev, [reviewId]: false }));
    }
  };

  // Отправка ответа на WB (TODO: нужно создать endpoint)
  const handleSendReply = async (reviewId: string) => {
    const draftText = replyDrafts[reviewId] || '';
    if (!draftText.trim()) {
      alert('Текст ответа не может быть пустым');
      return;
    }

    if (!confirm('Отправить ответ на Wildberries?')) {
      return;
    }

    setSendingReply(prev => ({ ...prev, [reviewId]: true }));

    try {
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';
      const response = await fetch(`/api/stores/${storeId}/reviews/${reviewId}/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ replyText: draftText })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Ошибка отправки');
      }

      // Удаляем local state
      setReplyDrafts(prev => {
        const newState = { ...prev };
        delete newState[reviewId];
        return newState;
      });

      await refetch();
      alert('Ответ отправлен');
    } catch (error: any) {
      console.error('Send reply error:', error);
      alert(`Ошибка: ${error.message}`);
    } finally {
      setSendingReply(prev => ({ ...prev, [reviewId]: false }));
    }
  };

  // AI генерация жалобы
  const handleGenerateComplaint = async (reviewId: string) => {
    setGeneratingComplaint(prev => ({ ...prev, [reviewId]: true }));

    try {
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';
      const response = await fetch(`/api/stores/${storeId}/reviews/${reviewId}/generate-complaint`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Ошибка генерации');
      }

      const { complaintText } = await response.json();

      // Удаляем local state чтобы показывался complaint_text из БД
      setComplaintDrafts(prev => {
        const newState = { ...prev };
        delete newState[reviewId];
        return newState;
      });

      await refetch();
    } catch (error: any) {
      console.error('Generate complaint error:', error);
      alert(`Ошибка: ${error.message}`);
    } finally {
      setGeneratingComplaint(prev => ({ ...prev, [reviewId]: false }));
    }
  };

  // Отметить жалобу как отправленную
  const handleMarkComplaintSent = async (reviewId: string) => {
    if (!confirm('Отметить жалобу как отправленную?')) {
      return;
    }

    setMarkingComplaint(prev => ({ ...prev, [reviewId]: true }));

    try {
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';
      const response = await fetch(`/api/stores/${storeId}/reviews/${reviewId}/mark-complaint-sent`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Ошибка');
      }

      // Удаляем local state
      setComplaintDrafts(prev => {
        const newState = { ...prev };
        delete newState[reviewId];
        return newState;
      });

      await refetch();
      alert('Жалоба отмечена как отправленная');
    } catch (error: any) {
      console.error('Mark complaint sent error:', error);
      alert(`Ошибка: ${error.message}`);
    } finally {
      setMarkingComplaint(prev => ({ ...prev, [reviewId]: false }));
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(date);
  };

  const renderStars = (rating: number) => {
    return (
      <div style={{ display: 'flex', gap: '2px' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <Star
            key={i}
            size={16}
            fill={i <= rating ? '#f59e0b' : '#e5e7eb'}
            color={i <= rating ? '#f59e0b' : '#e5e7eb'}
          />
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: 'var(--spacing-4xl)', gap: 'var(--spacing-md)' }}>
        <div style={{
          width: '32px',
          height: '32px',
          border: '3px solid var(--color-border)',
          borderTopColor: 'var(--color-primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ color: 'var(--color-muted)', fontSize: 'var(--font-size-sm)' }}>
          Загрузка отзывов...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 'var(--spacing-4xl)' }}>
        <div style={{
          backgroundColor: '#fef2f2',
          border: '2px dashed var(--color-error)',
          borderRadius: '8px',
          padding: 'var(--spacing-2xl)',
          textAlign: 'center'
        }}>
          <p style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, marginBottom: 'var(--spacing-md)', color: 'var(--color-error)' }}>
            Ошибка загрузки отзывов
          </p>
          <p style={{ color: 'var(--color-muted)', marginBottom: 'var(--spacing-xl)', fontSize: 'var(--font-size-sm)' }}>
            {(error as Error).message}
          </p>
          <button className="btn btn-primary btn-icon" onClick={() => refetch()}>
            <RefreshCw size={16} />
            Повторить попытку
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-section">
      <style jsx>{`
        /* Filters Section */
        .filters-section {
          background: white;
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-lg);
          margin-bottom: var(--spacing-2xl);
          box-shadow: var(--shadow-sm);
        }

        .filters-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--spacing-lg) var(--spacing-2xl);
          cursor: pointer;
          user-select: none;
        }

        .filters-header:hover {
          background-color: var(--color-border-light);
        }

        .filters-title {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
          font-size: var(--font-size-base);
          font-weight: 600;
          color: var(--color-foreground);
        }

        .filters-content {
          max-height: ${filtersExpanded ? '800px' : '0'};
          overflow: hidden;
          transition: max-height 0.3s ease;
        }

        .filters-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: var(--spacing-2xl);
          padding: 0 var(--spacing-2xl) var(--spacing-2xl);
        }

        .filter-group {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-sm);
        }

        .filter-label {
          font-size: var(--font-size-sm);
          font-weight: 600;
          color: var(--color-foreground);
        }

        .filter-radio-group, .filter-checkboxes {
          display: flex;
          gap: var(--spacing-md);
          flex-wrap: wrap;
        }

        .filter-radio, .filter-checkbox {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          cursor: pointer;
        }

        /* Reviews Table */
        .reviews-table-wrapper {
          background: white;
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-sm);
          overflow: hidden;
        }

        .reviews-table {
          width: 100%;
          border-collapse: collapse;
        }

        .reviews-table thead {
          background-color: var(--color-border-light);
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

        .reviews-table td {
          padding: var(--spacing-lg);
          border-top: 1px solid var(--color-border-light);
          font-size: var(--font-size-sm);
          vertical-align: top;
        }

        .reviews-table tbody tr:not(.details-row) {
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .reviews-table tbody tr:not(.details-row):hover {
          background-color: #f8fafc;
        }

        .reviews-table tbody tr.expanded {
          background-color: #f8fafc;
        }

        .details-row {
          background-color: #f8fafc;
        }

        .review-details {
          padding: var(--spacing-2xl);
        }

        .review-details-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: var(--spacing-2xl);
        }

        .review-detail-section {
          background: white;
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-md);
          padding: var(--spacing-lg);
        }

        .review-detail-section.reply-section {
          border-left: 3px solid var(--color-primary);
        }

        .review-detail-section.complaint-section {
          border-left: 3px solid #f59e0b;
        }

        .review-detail-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--spacing-md);
        }

        .review-detail-title {
          font-size: var(--font-size-sm);
          font-weight: 600;
        }

        .review-detail-textarea {
          width: 100%;
          min-height: 120px;
          padding: var(--spacing-md);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          font-size: var(--font-size-sm);
          font-family: inherit;
          resize: vertical;
        }

        .review-detail-textarea:focus {
          outline: none;
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .review-detail-actions {
          display: flex;
          gap: var(--spacing-sm);
          margin-top: var(--spacing-md);
          justify-content: flex-end;
        }

        /* Product Preview */
        .product-preview {
          display: flex;
          gap: var(--spacing-md);
          align-items: flex-start;
        }

        .product-image {
          width: 40px;
          height: 53px;
          border-radius: var(--radius-sm);
          object-fit: cover;
          flex-shrink: 0;
          background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
        }

        .product-info {
          flex: 1;
          min-width: 0;
        }

        .product-name {
          font-weight: 600;
          font-size: var(--font-size-xs);
          color: var(--color-foreground);
          margin-bottom: var(--spacing-xs);
        }

        .product-vendor {
          font-size: 11px;
          color: var(--color-muted);
        }

        /* Review Content */
        .review-meta {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          flex-wrap: wrap;
          margin-bottom: var(--spacing-sm);
        }

        .review-author {
          font-weight: 600;
          font-size: var(--font-size-sm);
        }

        .review-date {
          font-size: var(--font-size-xs);
          color: var(--color-muted);
        }

        .review-text {
          font-size: var(--font-size-sm);
          line-height: 1.5;
          color: var(--color-foreground);
          margin: var(--spacing-sm) 0;
        }

        .review-pros-cons {
          display: flex;
          flex-direction: column;
          gap: var(--spacing-xs);
          margin-top: var(--spacing-sm);
        }

        .review-pros, .review-cons {
          display: flex;
          gap: var(--spacing-xs);
          font-size: var(--font-size-xs);
        }

        .review-pros {
          color: #16a34a;
        }

        .review-cons {
          color: #dc2626;
        }

        /* Bulk Actions */
        .bulk-actions-card {
          background: white;
          border: 1px solid var(--color-border-light);
          border-radius: var(--radius-lg);
          padding: var(--spacing-lg) var(--spacing-2xl);
          margin-bottom: var(--spacing-2xl);
          box-shadow: var(--shadow-sm);
        }

        .bulk-actions-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--spacing-md);
        }

        .bulk-actions-title {
          font-size: var(--font-size-base);
          font-weight: 600;
        }

        .bulk-actions-buttons {
          display: flex;
          gap: var(--spacing-sm);
          flex-wrap: wrap;
        }

        /* Pagination */
        .pagination-controls {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--spacing-lg) 0;
        }

        .pagination-info {
          font-size: var(--font-size-sm);
          color: var(--color-muted);
        }

        .pagination-buttons {
          display: flex;
          gap: var(--spacing-sm);
          align-items: center;
        }

        .page-size-selector {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
        }

        /* Search Row */
        .filters-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--spacing-md);
          margin-bottom: var(--spacing-lg);
        }

        .search-input-wrapper {
          position: relative;
          flex: 1;
          max-width: 400px;
        }

        .search-input {
          width: 100%;
          padding: var(--spacing-sm) var(--spacing-sm) var(--spacing-sm) 40px;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          font-size: var(--font-size-sm);
        }

        .search-icon {
          position: absolute;
          left: var(--spacing-md);
          top: 50%;
          transform: translateY(-50%);
          color: var(--color-muted);
          pointer-events: none;
        }

        .sync-buttons {
          display: flex;
          gap: var(--spacing-sm);
          align-items: center;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Search + Sync Row */}
      <div className="filters-row">
        <div className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Поиск по ID отзыва..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="sync-buttons">
          {syncError ? (
            <span className="badge badge-error" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              Ошибка
            </span>
          ) : (
            <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              Синхронизировано
            </span>
          )}
          <button
            className="btn btn-outline btn-sm btn-icon"
            onClick={handleSyncReviews}
            disabled={isSyncing}
            style={{ position: 'relative' }}
          >
            <RefreshCw
              size={16}
              style={{
                animation: isSyncing ? 'spin 1s linear infinite' : 'none'
              }}
            />
            {isSyncing ? 'Синхронизация...' : 'Обновить отзывы'}
          </button>
        </div>
      </div>

      {/* Collapsible Filters */}
      <div className="filters-section">
        <div className="filters-header" onClick={toggleFilters}>
          <div className="filters-title">
            <Filter size={20} />
            Фильтры
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={(e) => {
                e.stopPropagation();
                clearFilters();
              }}
            >
              <Trash2 size={14} />
              Сбросить
            </button>
            <ChevronDown
              size={20}
              style={{
                transition: 'transform 0.2s ease',
                transform: filtersExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
              }}
            />
          </div>
        </div>
        <div className="filters-content">
          <div className="filters-grid">
            {/* Products Filter */}
            <div className="filter-group">
              <label className="filter-label">По товарам</label>
              <select
                className="filter-dropdown"
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-size-sm)',
                  background: 'white',
                  cursor: 'pointer'
                }}
              >
                <option value="all">Все товары</option>
              </select>
            </div>

            {/* Answer Filter */}
            <div className="filter-group">
              <label className="filter-label">По ответу</label>
              <div className="filter-radio-group">
                <label className="filter-radio">
                  <input
                    type="radio"
                    name="answer"
                    checked={answerFilter === 'all'}
                    onChange={() => setAnswerFilter('all')}
                  />
                  <span style={{ fontSize: 'var(--font-size-sm)' }}>Все</span>
                </label>
                <label className="filter-radio">
                  <input
                    type="radio"
                    name="answer"
                    checked={answerFilter === 'answered'}
                    onChange={() => setAnswerFilter('answered')}
                  />
                  <span style={{ fontSize: 'var(--font-size-sm)' }}>Отвеченные</span>
                </label>
                <label className="filter-radio">
                  <input
                    type="radio"
                    name="answer"
                    checked={answerFilter === 'unanswered'}
                    onChange={() => setAnswerFilter('unanswered')}
                  />
                  <span style={{ fontSize: 'var(--font-size-sm)' }}>Неотвеченные</span>
                </label>
              </div>
            </div>

            {/* Complaint Filter */}
            <div className="filter-group">
              <label className="filter-label">По жалобам</label>
              <div className="filter-radio-group">
                <label className="filter-radio">
                  <input
                    type="radio"
                    name="complaint"
                    checked={complaintFilter === 'all'}
                    onChange={() => setComplaintFilter('all')}
                  />
                  <span style={{ fontSize: 'var(--font-size-sm)' }}>Все</span>
                </label>
                <label className="filter-radio">
                  <input
                    type="radio"
                    name="complaint"
                    checked={complaintFilter === 'with'}
                    onChange={() => setComplaintFilter('with')}
                  />
                  <span style={{ fontSize: 'var(--font-size-sm)' }}>С жалобой</span>
                </label>
                <label className="filter-radio">
                  <input
                    type="radio"
                    name="complaint"
                    checked={complaintFilter === 'draft'}
                    onChange={() => setComplaintFilter('draft')}
                  />
                  <span style={{ fontSize: 'var(--font-size-sm)' }}>С черновиком</span>
                </label>
                <label className="filter-radio">
                  <input
                    type="radio"
                    name="complaint"
                    checked={complaintFilter === 'without'}
                    onChange={() => setComplaintFilter('without')}
                  />
                  <span style={{ fontSize: 'var(--font-size-sm)' }}>Без жалобы</span>
                </label>
              </div>
            </div>

            {/* Ratings Filter */}
            <div className="filter-group">
              <label className="filter-label">По оценкам</label>
              <div className="filter-checkboxes">
                {[5, 4, 3, 2, 1].map(rating => (
                  <label key={rating} className="filter-checkbox">
                    <input
                      type="checkbox"
                      checked={ratingFilters.includes(rating)}
                      onChange={() => toggleRatingFilter(rating)}
                    />
                    <span style={{ fontSize: 'var(--font-size-sm)' }}>{rating}</span>
                    <Star size={14} fill="#f59e0b" color="#f59e0b" />
                  </label>
                ))}
              </div>
            </div>

            {/* Active Products Filter */}
            <div className="filter-group">
              <label className="filter-label">По статусу товара</label>
              <label className="filter-checkbox">
                <input
                  type="checkbox"
                  checked={activeOnlyFilter}
                  onChange={(e) => setActiveOnlyFilter(e.target.checked)}
                />
                <span style={{ fontSize: 'var(--font-size-sm)' }}>Только активные товары</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Actions Card */}
      <BulkActionsBar
        selectedCount={selectedReviews.length}
        onGenerateReplies={() => handleBulkGenerateReplies(selectedReviews, () => {
          refetch();
          setSelectedReviews([]);
        })}
        onGenerateComplaints={() => handleBulkGenerateComplaints(selectedReviews, () => {
          refetch();
          setSelectedReviews([]);
        })}
        onClearDrafts={() => handleBulkClearDrafts(selectedReviews, () => {
          setReplyDrafts({});
          setComplaintDrafts({});
          refetch();
          setSelectedReviews([]);
        })}
        isGeneratingReplies={bulkGeneratingReplies}
        isGeneratingComplaints={bulkGeneratingComplaints}
        isClearingDrafts={bulkClearingDrafts}
      />

      {/* Pagination Controls (top) */}
      <div className="pagination-controls">
        <div className="pagination-info">
          Всего отзывов: <strong>{totalCount}</strong> | Показано: <strong>{reviews.length}</strong>
        </div>
        <div className="page-size-selector">
          <label style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-muted)' }}>На странице:</label>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            style={{
              padding: 'var(--spacing-xs) var(--spacing-sm)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)'
            }}
          >
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="200">200</option>
            <option value="500">500</option>
            <option value="1000">1000</option>
          </select>
        </div>
      </div>

      {/* Reviews Table */}
      <div className="reviews-table-wrapper">
        {reviews.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--spacing-4xl)', color: 'var(--color-muted)' }}>
            Отзывы не найдены
          </div>
        ) : (
          <table className="reviews-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input
                    type="checkbox"
                    checked={selectedReviews.length === reviews.length && reviews.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th style={{ width: '30px' }}></th>
                <th style={{ width: '200px' }}>Товар</th>
                <th>Отзыв</th>
                <th style={{ width: '150px', textAlign: 'right' }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => {
                const isExpanded = expandedRows.includes(review.id);
                const isSelected = selectedReviews.includes(review.id);

                return (
                  <>
                    {/* Main Row */}
                    <tr
                      key={review.id}
                      className={isExpanded ? 'expanded' : ''}
                      onClick={() => toggleRow(review.id)}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectReview(review.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td>
                        <ChevronDown
                          size={16}
                          style={{
                            transition: 'transform 0.2s ease',
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            color: 'var(--color-muted)'
                          }}
                        />
                      </td>
                      <td>
                        <div className="product-preview">
                          <div className="product-image"></div>
                          <div className="product-info">
                            <div className="product-name">
                              {review.product?.name || 'Неизвестный товар'}
                            </div>
                            <div className="product-vendor">
                              Арт: {review.product?.vendor_code || '—'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="review-meta">
                          {renderStars(review.rating)}
                          <span className="badge" style={{ background: 'var(--color-border-light)', color: 'var(--color-muted)' }}>
                            {review.author}
                          </span>
                          <span className="review-date">{formatDate(review.date)}</span>
                        </div>
                        {review.pros && (
                          <div className="review-pros-cons">
                            <div className="review-pros">
                              <ThumbsUp size={14} />
                              <span>{review.pros}</span>
                            </div>
                          </div>
                        )}
                        <p className="review-text">{review.text}</p>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {review.has_answer ? (
                          <span className="badge badge-success">Отвечено</span>
                        ) : (
                          <span className="badge badge-error">Без ответа</span>
                        )}
                      </td>
                    </tr>

                    {/* Expandable Details Row */}
                    {isExpanded && (
                      <tr className="details-row">
                        <td colSpan={5}>
                          <div className="review-details">
                            {/* Display sent reply or complaint in collapsed view */}
                            {review.has_answer && review.answer ? (
                              <>
                                {/* Sent Reply */}
                                <div style={{
                                  padding: 'var(--spacing-lg)',
                                  background: '#f0fdf4',
                                  borderLeft: '3px solid #22c55e',
                                  borderRadius: 'var(--radius-md)',
                                  marginBottom: review.complaint_text || review.has_complaint ? 'var(--spacing-lg)' : 0
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                    <CornerDownRight size={14} color="#16a34a" />
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#16a34a', textTransform: 'uppercase' }}>
                                      Ваш ответ
                                    </span>
                                  </div>
                                  <p style={{ fontSize: '13px', margin: 0, color: '#166534', lineHeight: 1.4 }}>
                                    {review.answer.text}
                                  </p>
                                </div>

                                {/* Sent Complaint (if exists) */}
                                {(review.complaint_text || review.has_complaint) && (
                                  <div style={{
                                    padding: 'var(--spacing-lg)',
                                    background: '#fffbeb',
                                    borderLeft: '3px solid #f59e0b',
                                    borderRadius: 'var(--radius-md)'
                                  }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                      <Flag size={14} color="#f59e0b" />
                                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#f59e0b', textTransform: 'uppercase' }}>
                                        Жалоба на отзыв
                                      </span>
                                      {review.has_complaint && (
                                        <span className="badge" style={{ background: '#f59e0b', color: 'white', fontSize: '10px', padding: '2px 6px' }}>
                                          Отправлена
                                        </span>
                                      )}
                                    </div>
                                    <p style={{ fontSize: '13px', margin: 0, color: '#92400e', lineHeight: 1.4 }}>
                                      {review.complaint_text || 'Жалоба отправлена'}
                                    </p>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div className="review-details-grid">
                                {/* Reply Section */}
                                <div className="review-detail-section reply-section">
                                  <div className="review-detail-header">
                                    <h4 className="review-detail-title">Ответ на отзыв</h4>
                                {replyDrafts[review.id] !== undefined && (
                                  <span style={{ fontSize: '10px', color: '#10b981' }}>✓ Автосохранение</span>
                                )}
                                  </div>
                                  <textarea
                                    className="review-detail-textarea"
                                    placeholder="Введите ответ или сгенерируйте с помощью ИИ..."
                                    value={replyDrafts[review.id] ?? review.draft_reply ?? ''}
                                    onChange={(e) => handleReplyChange(review.id, e.target.value)}
                                  />
                                  <div className="review-detail-actions">
                                    <button
                                      className="btn btn-outline btn-sm btn-icon"
                                      onClick={(e) => { e.stopPropagation(); handleGenerateReply(review.id); }}
                                      disabled={generatingReply[review.id]}
                                    >
                                      <Bot size={14} />
                                      {generatingReply[review.id] ? 'Генерация...' : 'Сгенерировать'}
                                    </button>
                                    <button
                                      className="btn btn-primary btn-sm"
                                      onClick={(e) => { e.stopPropagation(); handleSendReply(review.id); }}
                                      disabled={sendingReply[review.id]}
                                    >
                                      <Send size={14} />
                                      {sendingReply[review.id] ? 'Отправка...' : 'Отправить'}
                                    </button>
                                  </div>
                                </div>

                                {/* Complaint Section */}
                                <div className="review-detail-section complaint-section">
                                  <div className="review-detail-header">
                                    <h4 className="review-detail-title">Жалоба на отзыв</h4>
                                {complaintDrafts[review.id] !== undefined && (
                                  <span style={{ fontSize: '10px', color: '#10b981' }}>✓ Автосохранение</span>
                                )}
                                    <span className="badge" style={{ background: 'var(--color-border-light)', color: 'var(--color-muted)' }}>
                                      {review.has_complaint ? 'С жалобой' : 'Без жалобы'}
                                    </span>
                                  </div>
                                  <textarea
                                    className="review-detail-textarea"
                                    placeholder="Текст жалобы... (можно сгенерировать)"
                                    value={complaintDrafts[review.id] ?? review.complaint_text ?? ''}
                                    onChange={(e) => handleComplaintChange(review.id, e.target.value)}
                                  />
                                  <div className="review-detail-actions">
                                    <button
                                      className="btn btn-outline btn-sm btn-icon"
                                      onClick={(e) => { e.stopPropagation(); handleGenerateComplaint(review.id); }}
                                      disabled={generatingComplaint[review.id]}
                                    >
                                      <Bot size={14} />
                                      {generatingComplaint[review.id] ? 'Генерация...' : 'Сгенерировать'}
                                    </button>
                                    <button
                                      className="btn btn-primary btn-sm"
                                      onClick={(e) => { e.stopPropagation(); handleMarkComplaintSent(review.id); }}
                                      disabled={markingComplaint[review.id]}
                                    >
                                      <Flag size={14} />
                                      {markingComplaint[review.id] ? 'Отправка...' : 'Отметить отправленной'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Controls (bottom) */}
      {totalPages > 1 && (
        <div className="pagination-controls">
          <div className="pagination-buttons">
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Назад
            </button>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-muted)' }}>
              Страница {currentPage} из {totalPages}
            </span>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              Вперёд
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
