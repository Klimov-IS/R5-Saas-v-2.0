'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Store as StoreIcon, Package, Star, MessageSquare, Plus, RefreshCw, Edit, Search, RotateCcw } from 'lucide-react';
import { InteractiveKPICard } from '@/components/stores/InteractiveKPICard';
import { ActionIcon } from '@/components/stores/ActionIcon';
import { AddStoreModal } from '@/components/stores/AddStoreModal';
import { AddOzonStoreModal } from '@/components/stores/AddOzonStoreModal';
import { MarketplaceSelector } from '@/components/stores/MarketplaceSelector';
import { EditStoreModal } from '@/components/stores/EditStoreModal';
import { ProgressModal } from '@/components/sync/ProgressModal';
import { StageSelector } from '@/components/ui/StageSelector';
import { ProgressCell } from '@/components/stores/ProgressCell';
import type { Store, DashboardStats, StoreProgressMap } from '@/db/helpers';
import { type StoreStage, STORE_STAGE_LABELS } from '@/types/stores';
import { useRouter } from 'next/navigation';
import { toast } from '@/lib/toast';
import { useSyncStore } from '@/lib/sync-store';
import type { SyncType } from '@/lib/sync-store';

// Helper: debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Fetch stores function
async function fetchStores(): Promise<Store[]> {
  const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';

  const response = await fetch('/api/stores', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch stores: ${response.status}`);
  }

  return response.json();
}

// Fetch dashboard stats
async function fetchDashboardStats(): Promise<DashboardStats> {
  const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';

  const response = await fetch('/api/dashboard/stats', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch dashboard stats: ${response.status}`);
  }

  return response.json();
}

// Fetch store progress metrics
async function fetchStoreProgress(): Promise<StoreProgressMap> {
  const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';

  const response = await fetch('/api/dashboard/store-progress', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch store progress: ${response.status}`);
  }

  return response.json();
}

export default function Home() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { tasks, activeKpiTypes, startTask, updateTask, addLog, minimizeTask, expandTask, removeTask } = useSyncStore();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [sortBy, setSortBy] = useState<string>('date_desc');
  const [updatingStatus, setUpdatingStatus] = useState<Record<string, boolean>>({});
  const [updatingStage, setUpdatingStage] = useState<Record<string, boolean>>({});  // Sprint 006 Phase 3
  const [syncingProducts, setSyncingProducts] = useState<Record<string, boolean>>({});
  const [syncingReviews, setSyncingReviews] = useState<Record<string, boolean>>({});
  const [syncingChats, setSyncingChats] = useState<Record<string, boolean>>({});
  const [syncingFull, setSyncingFull] = useState<Record<string, boolean>>({});
  const [showMarketplaceSelector, setShowMarketplaceSelector] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddOzonModal, setShowAddOzonModal] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);

  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fetch stores
  const {
    data: stores = [],
    isLoading,
    error
  } = useQuery({
    queryKey: ['stores'],
    queryFn: fetchStores,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch dashboard stats
  const { data: dashboardStats } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: fetchDashboardStats,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch store progress metrics (per-store active/processed/opened)
  const { data: storeProgress = {} } = useQuery<StoreProgressMap>({
    queryKey: ['storeProgress'],
    queryFn: fetchStoreProgress,
    staleTime: 15 * 60 * 1000, // 15 minutes (matches server cache)
  });

  // Calculate totals
  const totalProducts = stores.reduce((sum, store) => sum + (store.product_count || 0), 0);
  const totalReviews = stores.reduce((sum, store) => sum + (store.total_reviews || 0), 0);
  const totalChats = stores.reduce((sum, store) => sum + (store.total_chats || 0), 0);

  // Filter and sort stores
  const filteredStores = useMemo(() => {
    let filtered = stores;

    // Filter by search query
    if (debouncedSearch) {
      filtered = filtered.filter((store) =>
        store.name.toLowerCase().includes(debouncedSearch.toLowerCase())
      );
    }

    // Filter by active status
    if (!showInactive) {
      filtered = filtered.filter((store) => store.is_active);
    }

    // Sort
    const sorted = [...filtered];
    switch (sortBy) {
      case 'date_desc':
        sorted.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        break;
      case 'name_asc':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name_desc':
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'products_desc':
        sorted.sort((a, b) => (storeProgress[b.id]?.products.active ?? b.product_count ?? 0) - (storeProgress[a.id]?.products.active ?? a.product_count ?? 0));
        break;
      case 'reviews_desc':
        sorted.sort((a, b) => (storeProgress[b.id]?.reviews.totalInWork ?? 0) - (storeProgress[a.id]?.reviews.totalInWork ?? 0));
        break;
      case 'chats_desc':
        sorted.sort((a, b) => (storeProgress[b.id]?.dialogues.required ?? 0) - (storeProgress[a.id]?.dialogues.required ?? 0));
        break;
    }

    return sorted;
  }, [stores, debouncedSearch, showInactive, sortBy, storeProgress]);

  // Handle active toggle
  const handleToggleActive = async (storeId: string, newValue: boolean) => {
    const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';

    setUpdatingStatus((prev) => ({ ...prev, [storeId]: true }));

    try {
      const response = await fetch(`/api/stores/${storeId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: newValue }),
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      // Invalidate and refetch stores
      await queryClient.invalidateQueries({ queryKey: ['stores'] });
      toast.success('Статус обновлен', newValue ? 'Магазин активирован' : 'Магазин деактивирован');
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Ошибка обновления статуса', error instanceof Error ? error.message : 'Не удалось обновить статус');
    } finally {
      setUpdatingStatus((prev) => ({ ...prev, [storeId]: false }));
    }
  };

  // Handle stage change - Sprint 006 Phase 3
  const handleStageChange = async (storeId: string, newStage: StoreStage) => {
    const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';

    setUpdatingStage((prev) => ({ ...prev, [storeId]: true }));

    try {
      const response = await fetch(`/api/stores/${storeId}/stage`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ stage: newStage }),
      });

      if (!response.ok) {
        throw new Error('Failed to update stage');
      }

      // Invalidate and refetch stores
      await queryClient.invalidateQueries({ queryKey: ['stores'] });
      toast.success('Этап обновлен', `Новый этап: ${STORE_STAGE_LABELS[newStage]}`);
    } catch (error) {
      console.error('Error updating stage:', error);
      toast.error('Ошибка обновления этапа', error instanceof Error ? error.message : 'Не удалось обновить этап');
    } finally {
      setUpdatingStage((prev) => ({ ...prev, [storeId]: false }));
    }
  };

  // Handle sync products (single store)
  const handleSyncProducts = async (storeId: string) => {
    const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';
    setSyncingProducts((prev) => ({ ...prev, [storeId]: true }));

    const storeName = stores.find(s => s.id === storeId)?.name || 'Магазин';

    try {
      const response = await fetch(`/api/stores/${storeId}/products/update`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });

      if (!response.ok) throw new Error('Sync failed');

      await queryClient.invalidateQueries({ queryKey: ['stores'] });
      toast.success('Синхронизация завершена', `Товары для "${storeName}" обновлены`);
    } catch (error) {
      toast.error('Ошибка синхронизации', `Не удалось обновить товары для "${storeName}"`);
    } finally {
      setSyncingProducts((prev) => ({ ...prev, [storeId]: false }));
    }
  };

  // Handle sync reviews (single store)
  const handleSyncReviews = async (storeId: string) => {
    const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';
    setSyncingReviews((prev) => ({ ...prev, [storeId]: true }));

    const storeName = stores.find(s => s.id === storeId)?.name || 'Магазин';

    try {
      const response = await fetch(`/api/stores/${storeId}/reviews/update?mode=incremental`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });

      if (!response.ok) throw new Error('Sync failed');

      await queryClient.invalidateQueries({ queryKey: ['stores'] });
      toast.success('Синхронизация завершена', `Отзывы для "${storeName}" обновлены`);
    } catch (error) {
      toast.error('Ошибка синхронизации', `Не удалось обновить отзывы для "${storeName}"`);
    } finally {
      setSyncingReviews((prev) => ({ ...prev, [storeId]: false }));
    }
  };

  // Handle sync chats (single store)
  const handleSyncChats = async (storeId: string) => {
    const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';
    setSyncingChats((prev) => ({ ...prev, [storeId]: true }));

    const storeName = stores.find(s => s.id === storeId)?.name || 'Магазин';

    try {
      const response = await fetch(`/api/stores/${storeId}/dialogues/update`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });

      if (!response.ok) throw new Error('Sync failed');

      await queryClient.invalidateQueries({ queryKey: ['stores'] });
      toast.success('Синхронизация завершена', `Диалоги для "${storeName}" обновлены`);
    } catch (error) {
      toast.error('Ошибка синхронизации', `Не удалось обновить диалоги для "${storeName}"`);
    } finally {
      setSyncingChats((prev) => ({ ...prev, [storeId]: false }));
    }
  };

  // Handle full sync (products + reviews full + chats)
  const handleFullSync = async (storeId: string) => {
    const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';
    setSyncingFull((prev) => ({ ...prev, [storeId]: true }));

    const storeName = stores.find(s => s.id === storeId)?.name || 'Магазин';
    const toastId = toast.loading('Полное обновление', `${storeName}: Подготовка...`);

    try {
      // 1. Products
      toast.loading('Полное обновление', `${storeName}: Обновление товаров...`, toastId);
      const productsRes = await fetch(`/api/stores/${storeId}/products/update`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (!productsRes.ok) throw new Error('Ошибка обновления товаров');

      // 2. Reviews (full mode)
      toast.loading('Полное обновление', `${storeName}: Обновление отзывов (полная)...`, toastId);
      const reviewsRes = await fetch(`/api/stores/${storeId}/reviews/update?mode=full`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (!reviewsRes.ok) throw new Error('Ошибка обновления отзывов');

      // 3. Chats
      toast.loading('Полное обновление', `${storeName}: Обновление диалогов...`, toastId);
      const chatsRes = await fetch(`/api/stores/${storeId}/dialogues/update`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });
      if (!chatsRes.ok) throw new Error('Ошибка обновления диалогов');

      await queryClient.invalidateQueries({ queryKey: ['stores'] });
      toast.success('Полное обновление завершено', `${storeName}: Все данные обновлены`, toastId);
    } catch (error) {
      toast.error('Ошибка полного обновления', error instanceof Error ? error.message : `Не удалось обновить "${storeName}"`, toastId);
    } finally {
      setSyncingFull((prev) => ({ ...prev, [storeId]: false }));
    }
  };

  // Handle global sync with progress widget
  const handleGlobalSync = async (type: SyncType) => {
    const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';

    // Filter active stores
    const activeStores = stores.filter(s => s.is_active);

    if (activeStores.length === 0) {
      toast.error('Нет активных магазинов', 'Добавьте хотя бы один активный магазин');
      return;
    }

    const titles = {
      products: 'Синхронизация товаров',
      reviews: 'Синхронизация отзывов',
      chats: 'Синхронизация диалогов',
    };

    const subtitles = {
      products: `Обновление товаров для ${activeStores.length} магазинов`,
      reviews: `Обновление отзывов для ${activeStores.length} магазинов`,
      chats: `Обновление диалогов для ${activeStores.length} магазинов`,
    };

    const endpoints = {
      products: (storeId: string) => `/api/stores/${storeId}/products/update`,
      reviews: (storeId: string) => `/api/stores/${storeId}/reviews/update?mode=incremental`,
      chats: (storeId: string) => `/api/stores/${storeId}/dialogues/update`,
    };

    // Start task (will show modal initially since isMinimized defaults to false)
    const taskId = startTask({
      type,
      title: titles[type],
      subtitle: subtitles[type],
      storeIds: activeStores.map(s => s.id),
      storeNames: activeStores.map(s => s.name),
    });

    // Process stores sequentially
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < activeStores.length; i++) {
      const store = activeStores[i];

      addLog(taskId, { message: `Обработка: ${store.name}...`, type: 'info' });

      try {
        const response = await fetch(endpoints[type](store.id), {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}` },
        });

        if (response.ok) {
          successCount++;
          updateTask(taskId, {
            currentIndex: i + 1,
            successCount,
            errorCount,
          });
          addLog(taskId, { message: `✓ ${store.name} - успешно`, type: 'success' });
        } else {
          errorCount++;
          updateTask(taskId, {
            currentIndex: i + 1,
            successCount,
            errorCount,
          });
          addLog(taskId, { message: `✗ ${store.name} - ошибка`, type: 'error' });
        }
      } catch (error) {
        errorCount++;
        updateTask(taskId, {
          currentIndex: i + 1,
          successCount,
          errorCount,
        });
        addLog(taskId, { message: `✗ ${store.name} - ошибка сети`, type: 'error' });
      }
    }

    // Complete task
    updateTask(taskId, { status: 'completed' });
    addLog(taskId, { message: 'Синхронизация завершена!', type: 'success' });

    // Refresh data
    await queryClient.invalidateQueries({ queryKey: ['stores'] });

    toast.success('Синхронизация завершена', `Обработано магазинов: ${activeStores.length}`);
  };

  // Format date
  const formatRelativeDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return 'Сегодня, ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    if (diffInHours < 48) {
      return 'Вчера, ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{
          width: '32px',
          height: '32px',
          border: '3px solid var(--color-border)',
          borderTopColor: 'var(--color-primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ marginTop: '16px', color: 'var(--color-muted)' }}>Загрузка магазинов...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p style={{ color: 'var(--color-error)' }}>Ошибка: {(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: '1280px', margin: '0 auto', padding: 'var(--spacing-2xl) var(--spacing-3xl)' }}>
      {/* Navigation */}
      <div style={{ marginBottom: '24px', display: 'flex', gap: '12px' }}>
        <a
          href="/"
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            backgroundColor: 'var(--color-primary)',
            border: '1px solid var(--color-primary)',
            textDecoration: 'none',
            color: 'white',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          🏪 Кабинеты
        </a>
        <a
          href="/tasks"
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            backgroundColor: 'var(--color-background)',
            border: '1px solid var(--color-border)',
            textDecoration: 'none',
            color: 'var(--color-foreground)',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          🎯 Задачи
        </a>
      </div>

      {/* Page Header */}
      <header style={{ marginBottom: 'var(--spacing-3xl)' }}>
        <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700, marginBottom: 'var(--spacing-sm)' }}>
          🏪 Кабинеты
        </h1>
        <p style={{ color: 'var(--color-muted)', fontSize: 'var(--font-size-base)' }}>
          Управление магазинами Wildberries
        </p>
      </header>

      {/* Interactive KPI Cards */}
      <section style={{ marginBottom: 'var(--spacing-4xl)' }}>
        <div className="kpi-container">
          <InteractiveKPICard
            icon={StoreIcon}
            label="Активных клиентов"
            value={dashboardStats?.stores.active ?? stores.filter(s => s.is_active).length}
            subtitle={dashboardStats ? `+${dashboardStats.stores.newThisMonth} за месяц` : undefined}
            subtitleColor={dashboardStats && dashboardStats.stores.newThisMonth > 0 ? 'var(--color-success, #22c55e)' : undefined}
            actionIcon={Plus}
            actionTooltip="Подключить магазин"
            onClick={() => setShowMarketplaceSelector(true)}
            bgColor="var(--category-chats-bg)"
            iconColor="var(--category-chats-text)"
          />

          <div className="kpi-divider"></div>

          <InteractiveKPICard
            icon={Package}
            label="Товаров в работе"
            value={dashboardStats?.products.active ?? totalProducts}
            subtitle={dashboardStats ? `${dashboardStats.products.active.toLocaleString('ru-RU')} из ${dashboardStats.products.total.toLocaleString('ru-RU')}` : undefined}
            actionIcon={RefreshCw}
            actionTooltip="Синхронизировать товары"
            onClick={() => handleGlobalSync('products')}
            isSyncing={activeKpiTypes.has('products')}
            bgColor="var(--category-products-bg)"
            iconColor="var(--category-products-text)"
          />

          <div className="kpi-divider"></div>

          <InteractiveKPICard
            icon={Star}
            label="Отзывы 1-3 в работе"
            value={dashboardStats?.reviews.negative ?? totalReviews}
            subtitle={dashboardStats ? `${dashboardStats.reviews.complaintPercent}% обработано (${dashboardStats.reviews.withComplaints.toLocaleString('ru-RU')} жалоб)` : undefined}
            subtitleColor={dashboardStats && dashboardStats.reviews.complaintPercent >= 80 ? 'var(--color-success, #22c55e)' : undefined}
            actionIcon={RefreshCw}
            actionTooltip="Обновить отзывы (Incremental)"
            onClick={() => handleGlobalSync('reviews')}
            isSyncing={activeKpiTypes.has('reviews')}
            bgColor="var(--category-reviews-bg)"
            iconColor="var(--category-reviews-text)"
          />

          <div className="kpi-divider"></div>

          <InteractiveKPICard
            icon={MessageSquare}
            label="На удаление"
            value={dashboardStats?.chats.activeDeletion ?? totalChats}
            subtitle={dashboardStats ? `из ${dashboardStats.chats.total.toLocaleString('ru-RU')} наших диалогов` : undefined}
            actionIcon={RefreshCw}
            actionTooltip="Обновить диалоги"
            onClick={() => handleGlobalSync('chats')}
            isSyncing={activeKpiTypes.has('chats')}
            bgColor="var(--category-chats-bg)"
            iconColor="var(--category-chats-text)"
          />
        </div>
      </section>

      {/* Stores List */}
      <section>
        <h2 className="section-header">
          🏪 Список магазинов ({filteredStores.length})
        </h2>

        <div className="card" style={{ padding: 'var(--spacing-2xl)' }}>
          {/* Filters Bar */}
          <div style={{
            display: 'flex',
            gap: 'var(--spacing-md)',
            marginBottom: 'var(--spacing-2xl)',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}>
            {/* Search */}
            <div style={{ flex: '1 1 300px', position: 'relative' }}>
              <Search style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '18px',
                height: '18px',
                color: 'var(--color-muted)',
                pointerEvents: 'none',
              }} />
              <input
                type="text"
                placeholder="🔍 Поиск по названию магазина..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 40px',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                }}
              />
            </div>

            {/* Show inactive toggle */}
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: '14px',
              color: 'var(--color-muted)',
              userSelect: 'none',
            }}>
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              Показать неактивные
            </label>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="btn btn-outline"
              style={{ padding: '8px 12px', minWidth: '220px' }}
            >
              <option value="date_desc">Сортировка: По дате обновления ↓</option>
              <option value="name_asc">По названию A-Z</option>
              <option value="name_desc">По названию Z-A</option>
              <option value="products_desc">По активным товарам ↓</option>
              <option value="reviews_desc">По отзывам в работе ↓</option>
              <option value="chats_desc">По необходимым диалогам ↓</option>
            </select>
          </div>

          {/* Table */}
          {filteredStores.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--spacing-4xl)', color: 'var(--color-muted)' }}>
              {debouncedSearch ? 'Ничего не найдено' : 'У вас пока нет магазинов'}
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '22%' }}>Магазин</th>
                    <th style={{ width: '10%' }}>Товары</th>
                    <th style={{ width: '10%' }}>Отзывы</th>
                    <th style={{ width: '10%' }}>Диалоги</th>
                    <th style={{ width: '13%' }}>Этап</th>
                    <th style={{ width: '5%', textAlign: 'center' }}>Вкл</th>
                    <th style={{ width: '27%' }}>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStores.map((store) => (
                    <tr key={store.id}>
                      {/* Store Name (Clickable) */}
                      <td
                        style={{ cursor: 'pointer' }}
                        onClick={() => router.push(`/stores/${store.id}`)}
                      >
                        <div style={{
                          fontWeight: 600,
                          color: 'var(--color-foreground)',
                          marginBottom: 'var(--spacing-xs)',
                          transition: 'color 0.15s ease',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-primary)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-foreground)'; }}
                        >
                          {store.name}
                          {store.marketplace === 'ozon' && (
                            <span style={{
                              display: 'inline-block',
                              marginLeft: '8px',
                              padding: '1px 6px',
                              fontSize: '10px',
                              fontWeight: 700,
                              color: 'white',
                              background: 'linear-gradient(135deg, #005BFF, #003399)',
                              borderRadius: '4px',
                              verticalAlign: 'middle',
                              lineHeight: '16px',
                            }}>OZON</span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
                          Обновлён: {formatRelativeDate(store.updated_at)}
                        </div>
                      </td>

                      {/* Products: active / total */}
                      <td>
                        {storeProgress[store.id] ? (
                          <ProgressCell
                            icon={Package}
                            current={storeProgress[store.id].products.active}
                            total={storeProgress[store.id].products.total}
                            color="var(--category-products-text, #7c3aed)"
                          />
                        ) : (
                          <span style={{ fontSize: '13px', color: 'var(--color-muted)' }}>
                            {store.marketplace === 'ozon' ? '—' : '...'}
                          </span>
                        )}
                      </td>

                      {/* Reviews: processed / total_in_work */}
                      <td>
                        {storeProgress[store.id] ? (
                          <ProgressCell
                            icon={Star}
                            current={storeProgress[store.id].reviews.processed}
                            total={storeProgress[store.id].reviews.totalInWork}
                            color="var(--category-reviews-text, #d97706)"
                          />
                        ) : (
                          <span style={{ fontSize: '13px', color: 'var(--color-muted)' }}>
                            {store.marketplace === 'ozon' ? '—' : '...'}
                          </span>
                        )}
                      </td>

                      {/* Dialogues: opened / required */}
                      <td>
                        {storeProgress[store.id] ? (
                          <ProgressCell
                            icon={MessageSquare}
                            current={storeProgress[store.id].dialogues.opened}
                            total={storeProgress[store.id].dialogues.required}
                            color="var(--category-chats-text, #2563eb)"
                          />
                        ) : (
                          <span style={{ fontSize: '13px', color: 'var(--color-muted)' }}>
                            {store.marketplace === 'ozon' ? '—' : '...'}
                          </span>
                        )}
                      </td>

                      {/* Stage Selector - Sprint 006 Phase 3 */}
                      <td>
                        <StageSelector
                          value={store.stage}
                          onChange={(stage) => handleStageChange(store.id, stage)}
                          disabled={updatingStage[store.id]}
                        />
                      </td>

                      {/* Active Toggle */}
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={store.is_active}
                          disabled={updatingStatus[store.id]}
                          onChange={() => {
                            if (!store.is_active || window.confirm(`Деактивировать магазин "${store.name}"?\n\nВсе автоматизации будут отключены.`)) {
                              handleToggleActive(store.id, !store.is_active);
                            }
                          }}
                          style={{
                            width: 18,
                            height: 18,
                            cursor: updatingStatus[store.id] ? 'wait' : 'pointer',
                            accentColor: '#10b981',
                          }}
                          title={store.is_active ? 'Активен' : 'Неактивен'}
                        />
                      </td>

                      {/* Actions */}
                      <td>
                        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                          <ActionIcon
                            icon={RotateCcw}
                            tooltip="Полное обновление"
                            onClick={() => handleFullSync(store.id)}
                            loading={syncingFull[store.id]}
                          />
                          <ActionIcon
                            icon={Package}
                            tooltip="Обновить товары"
                            onClick={() => handleSyncProducts(store.id)}
                            loading={syncingProducts[store.id]}
                          />
                          <ActionIcon
                            icon={Star}
                            tooltip="Обновить отзывы"
                            onClick={() => handleSyncReviews(store.id)}
                            loading={syncingReviews[store.id]}
                          />
                          <ActionIcon
                            icon={MessageSquare}
                            tooltip="Обновить диалоги"
                            onClick={() => handleSyncChats(store.id)}
                            loading={syncingChats[store.id]}
                          />
                          <ActionIcon
                            icon={Edit}
                            tooltip="Редактировать"
                            onClick={() => setEditingStore(store)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Modals */}
      <MarketplaceSelector
        isOpen={showMarketplaceSelector}
        onClose={() => setShowMarketplaceSelector(false)}
        onSelectWB={() => setShowAddModal(true)}
        onSelectOzon={() => setShowAddOzonModal(true)}
      />

      <AddStoreModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
      />

      <AddOzonStoreModal
        isOpen={showAddOzonModal}
        onClose={() => setShowAddOzonModal(false)}
      />

      <EditStoreModal
        isOpen={!!editingStore}
        onClose={() => setEditingStore(null)}
        store={editingStore}
      />

      {/* Progress Modals (Expanded tasks) */}
      {tasks
        .filter(task => !task.isMinimized && task.status === 'running')
        .map(task => (
          <ProgressModal
            key={task.id}
            task={task}
            onMinimize={() => minimizeTask(task.id)}
            onCancel={() => removeTask(task.id)}
          />
        ))
      }

      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
