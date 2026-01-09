'use client';

import { RefreshCw, Loader2, Settings } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { RulesConfigSidebar } from '@/components/RulesConfigSidebar';
import { BulkActionsBar, type BulkAction } from '@/components/BulkActionsBar';
import { CopyRulesModal } from '@/components/CopyRulesModal';
import { ProgressDialog } from '@/components/ProgressDialog';

type WorkStatus = 'not_working' | 'active' | 'paused' | 'completed';
type ChatStrategy = 'upgrade_to_5' | 'delete' | 'both';

type ProductRule = {
  id: string;
  product_id: string;
  store_id: string;
  submit_complaints: boolean;
  complaint_rating_1: boolean;
  complaint_rating_2: boolean;
  complaint_rating_3: boolean;
  complaint_rating_4: boolean;
  work_in_chats: boolean;
  chat_rating_1: boolean;
  chat_rating_2: boolean;
  chat_rating_3: boolean;
  chat_rating_4: boolean;
  chat_strategy?: ChatStrategy;
  offer_compensation: boolean;
  max_compensation?: string | null;
  compensation_type?: string | null;
  compensation_by?: string | null;
  created_at: string;
  updated_at: string;
};

type Product = {
  id: string;
  nm_id: number;
  name: string;
  vendor_code: string;
  brand: string;
  store_id: string;
  price: number | null;
  review_count: number;
  image_url: string | null;
  is_active: boolean;
  work_status: WorkStatus;
  rules: ProductRule | null;
  updated_at: string;
  created_at: string;
};

const API_KEY = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue';

// API fetch functions
async function fetchProducts(storeId: string): Promise<Product[]> {
  const response = await fetch(`/api/stores/${storeId}/products`, {
    headers: { 'Authorization': `Bearer ${API_KEY}` }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch products: ${response.status}`);
  }

  return response.json();
}

async function syncProducts(storeId: string): Promise<{ message: string }> {
  const response = await fetch(`/api/stores/${storeId}/products/update`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${API_KEY}` }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.details || error.error || 'Sync failed');
  }

  return response.json();
}

async function updateProductStatus(
  storeId: string,
  productId: string,
  status: WorkStatus
): Promise<any> {
  const response = await fetch(`/api/stores/${storeId}/products/${productId}/status`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ work_status: status })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.details || error.error || 'Status update failed');
  }

  return response.json();
}

async function bulkAction(
  storeId: string,
  action: BulkAction,
  productIds: string[],
  sourceProductId?: string
): Promise<any> {
  const body: any = {
    action: action.type,
    product_ids: productIds
  };

  if (action.type === 'update_status') {
    body.work_status = action.status;
  } else if (action.type === 'copy_rules') {
    body.source_product_id = sourceProductId;
  }

  const response = await fetch(`/api/stores/${storeId}/products/bulk-actions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.details || error.error || 'Bulk action failed');
  }

  return response.json();
}

// Status labels
const STATUS_LABELS: Record<WorkStatus, string> = {
  'not_working': '⚪ НЕ В РАБОТЕ',
  'active': '🟢 АКТИВНАЯ РАБОТА',
  'paused': '🟡 ПРИОСТАНОВЛЕНО',
  'completed': '🔵 ЗАВЕРШЕНО'
};

const STATUS_COLORS: Record<WorkStatus, { bg: string; color: string; border: string }> = {
  'not_working': { bg: '#f1f5f9', color: '#475569', border: '#cbd5e1' },
  'active': { bg: '#d1fae5', color: '#065f46', border: '#10b981' },
  'paused': { bg: '#fef3c7', color: '#92400e', border: '#f59e0b' },
  'completed': { bg: '#dbeafe', color: '#1e40af', border: '#3b82f6' }
};

const CHAT_STRATEGY_LABELS: Record<ChatStrategy, string> = {
  'upgrade_to_5': 'просить дополнить до 5⭐',
  'delete': 'просить удалить',
  'both': 'просить дополнить до 5⭐ или удалить'
};

function RulesSummary({ rules }: { rules: ProductRule | null }) {
  if (!rules) {
    return (
      <div style={{
        paddingTop: '12px',
        marginTop: '12px',
        borderTop: '1px dashed hsl(var(--border))',
        fontSize: '12px',
        color: 'hsl(var(--muted-foreground))'
      }}>
        <div style={{
          fontWeight: 600,
          color: 'hsl(var(--foreground) / 0.7)',
          marginBottom: '6px',
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          Правила работы:
        </div>
        <div style={{
          color: 'hsl(var(--muted-foreground))',
          fontStyle: 'italic'
        }}>
          Правила не настроены. Нажмите "Настроить" для конфигурации.
        </div>
      </div>
    );
  }

  // Get active complaint ratings
  const complaintRatings = [];
  if (rules.complaint_rating_1) complaintRatings.push('1⭐');
  if (rules.complaint_rating_2) complaintRatings.push('2⭐');
  if (rules.complaint_rating_3) complaintRatings.push('3⭐');
  if (rules.complaint_rating_4) complaintRatings.push('4⭐');

  // Get active chat ratings
  const chatRatings = [];
  if (rules.chat_rating_1) chatRatings.push('1⭐');
  if (rules.chat_rating_2) chatRatings.push('2⭐');
  if (rules.chat_rating_3) chatRatings.push('3⭐');
  if (rules.chat_rating_4) chatRatings.push('4⭐');

  return (
    <div style={{
      paddingTop: '12px',
      marginTop: '12px',
      borderTop: '1px dashed hsl(var(--border))',
      fontSize: '12px',
      lineHeight: '1.6'
    }}>
      <div style={{
        fontWeight: 600,
        color: 'hsl(var(--foreground) / 0.7)',
        marginBottom: '6px',
        fontSize: '11px',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
      }}>
        Правила работы:
      </div>

      {/* Complaints */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '4px' }}>
        <span style={{ fontWeight: 500, color: 'hsl(var(--muted-foreground))', minWidth: '95px' }}>
          📋 Жалобы:
        </span>
        <span style={{ color: 'hsl(var(--foreground))' }}>
          {rules.submit_complaints && complaintRatings.length > 0
            ? complaintRatings.join(', ')
            : <span style={{ color: 'hsl(var(--muted-foreground))', fontStyle: 'italic' }}>выключена</span>
          }
        </span>
      </div>

      {/* Chats */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '4px' }}>
        <span style={{ fontWeight: 500, color: 'hsl(var(--muted-foreground))', minWidth: '95px' }}>
          💬 Чаты:
        </span>
        <span style={{ color: 'hsl(var(--foreground))' }}>
          {rules.work_in_chats && chatRatings.length > 0
            ? `${chatRatings.join(', ')} (${CHAT_STRATEGY_LABELS[rules.chat_strategy || 'both']})`
            : <span style={{ color: 'hsl(var(--muted-foreground))', fontStyle: 'italic' }}>выключена</span>
          }
        </span>
      </div>

      {/* Compensation */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
        <span style={{ fontWeight: 500, color: 'hsl(var(--muted-foreground))', minWidth: '95px' }}>
          💰 Компенсация:
        </span>
        <span style={{ color: 'hsl(var(--foreground))' }}>
          {rules.offer_compensation
            ? `${rules.max_compensation || '500'}₽, ${rules.compensation_type === 'cashback' ? 'кешбек' : 'возврат'}, ${rules.compensation_by === 'r5' ? 'Р5' : 'продавец'}`
            : <span style={{ color: 'hsl(var(--muted-foreground))', fontStyle: 'italic' }}>выключена</span>
          }
        </span>
      </div>
    </div>
  );
}

function ProductCard({ product, onStatusChange, onOpenSettings, isSelected, onToggleSelect }: {
  product: Product;
  onStatusChange: (productId: string, status: WorkStatus) => void;
  onOpenSettings: (product: Product) => void;
  isSelected: boolean;
  onToggleSelect: (productId: string) => void;
}) {
  const colors = STATUS_COLORS[product.work_status];

  return (
    <div style={{
      background: isSelected ? '#eff6ff' : 'hsl(var(--card))',
      border: isSelected ? '2px solid #3b82f6' : '1px solid hsl(var(--border))',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '16px',
      transition: 'all 0.2s'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.boxShadow = 'none';
    }}
    >
      {/* Header with product info, status, and settings */}
      <div style={{
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px'
      }}>
        {/* Left side: checkbox + product info */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelect(product.id)}
              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: '16px',
              fontWeight: 600,
              color: 'hsl(var(--foreground))',
              marginBottom: '8px'
            }}>
              {product.name}
            </div>
            <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>Артикул WB:</span>
                <code style={{
                  fontFamily: 'monospace',
                  background: '#f1f5f9',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '11px'
                }}>
                  {product.nm_id}
                </code>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>Артикул продавца:</span>
                <span>{product.vendor_code}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right side: status dropdown + settings button */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select
            className="status-select"
            value={product.work_status}
            onChange={(e) => onStatusChange(product.id, e.target.value as WorkStatus)}
            style={{
              padding: '6px 12px',
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              background: colors.bg,
              color: colors.color,
              cursor: 'pointer',
              transition: 'all 0.15s',
              minWidth: '180px'
            }}
          >
            <option value="not_working">{STATUS_LABELS.not_working}</option>
            <option value="active">{STATUS_LABELS.active}</option>
            <option value="paused">{STATUS_LABELS.paused}</option>
            <option value="completed">{STATUS_LABELS.completed}</option>
          </select>

          <button
            className="btn btn-outline btn-sm"
            onClick={() => onOpenSettings(product)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 12px',
              fontSize: '12px'
            }}
          >
            <Settings style={{ width: '16px', height: '16px' }} />
            Настроить
          </button>
        </div>
      </div>

      {/* Rules Summary */}
      <RulesSummary rules={product.rules} />
    </div>
  );
}

export default function ProductsPage() {
  const params = useParams();
  const storeId = params.storeId as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-new');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [isCopyRulesModalOpen, setIsCopyRulesModalOpen] = useState(false);
  const [progressDialog, setProgressDialog] = useState({
    isOpen: false,
    title: '',
    current: 0,
    total: 0,
    result: undefined as { success: boolean; message: string } | undefined
  });

  // Fetch products
  const { data: products = [], isLoading, error } = useQuery({
    queryKey: ['products', storeId],
    queryFn: () => fetchProducts(storeId),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 7 * 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Sync mutation
  const syncMutation = useMutation({
    mutationFn: () => syncProducts(storeId),
    onSuccess: (data) => {
      toast({
        title: 'Успешно!',
        description: data.message || 'Товары успешно синхронизированы',
      });
      queryClient.invalidateQueries({ queryKey: ['products', storeId] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Ошибка синхронизации',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Status update mutation
  const statusMutation = useMutation({
    mutationFn: ({ productId, status }: { productId: string; status: WorkStatus }) =>
      updateProductStatus(storeId, productId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', storeId] });
      toast({
        title: 'Статус обновлён',
        description: 'Статус товара успешно изменён',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Ошибка',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Bulk action mutation
  const bulkActionMutation = useMutation({
    mutationFn: ({ action, sourceProductId }: { action: BulkAction; sourceProductId?: string }) =>
      bulkAction(storeId, action, Array.from(selectedProductIds), sourceProductId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['products', storeId] });

      // Show result in progress dialog
      setProgressDialog(prev => ({
        ...prev,
        current: data.processed,
        result: {
          success: data.failed === 0,
          message: data.failed === 0
            ? `✅ Успешно обработано ${data.processed} из ${data.total} товаров`
            : `⚠️ Обработано ${data.processed} из ${data.total} товаров. Ошибок: ${data.failed}`
        }
      }));

      // Auto-close and clear selection after 2 seconds
      setTimeout(() => {
        setProgressDialog({ isOpen: false, title: '', current: 0, total: 0, result: undefined });
        setSelectedProductIds(new Set());
      }, 2000);
    },
    onError: (error: Error) => {
      setProgressDialog(prev => ({
        ...prev,
        result: {
          success: false,
          message: `❌ Ошибка: ${error.message}`
        }
      }));

      setTimeout(() => {
        setProgressDialog({ isOpen: false, title: '', current: 0, total: 0, result: undefined });
      }, 3000);
    },
  });

  const handleStatusChange = (productId: string, status: WorkStatus) => {
    statusMutation.mutate({ productId, status });
  };

  const handleOpenSettings = (product: Product) => {
    setSelectedProduct(product);
    setIsSidebarOpen(true);
  };

  const handleCloseSidebar = () => {
    setIsSidebarOpen(false);
    setSelectedProduct(null);
  };

  const handleRulesSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['products', storeId] });
  };

  // Apply filters and sorting (must be before handlers that use it)
  const filteredAndSortedProducts = useMemo(() => {
    let filtered = [...products];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(query) ||
        product.vendor_code.toLowerCase().includes(query) ||
        product.nm_id.toString().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.work_status === statusFilter);
    }

    // Sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date-new':
          return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
        case 'date-old':
          return new Date(a.updated_at || a.created_at).getTime() - new Date(b.updated_at || b.created_at).getTime();
        case 'name-asc':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    return filtered;
  }, [products, searchQuery, statusFilter, sortBy]);

  // Bulk selection handlers
  const handleToggleSelect = (productId: string) => {
    setSelectedProductIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProductIds(new Set(filteredAndSortedProducts.map(p => p.id)));
    } else {
      setSelectedProductIds(new Set());
    }
  };

  const handleClearSelection = () => {
    setSelectedProductIds(new Set());
  };

  const handleBulkAction = (action: BulkAction) => {
    if (action.type === 'copy_rules') {
      setIsCopyRulesModalOpen(true);
    } else if (action.type === 'apply_custom_rules') {
      toast({
        title: 'В разработке',
        description: 'Функция кастомных правил будет доступна в следующей версии',
      });
    } else {
      // Show progress dialog
      let title = '';
      if (action.type === 'apply_default_rules') {
        title = 'Применение стандартных правил...';
      } else if (action.type === 'update_status') {
        title = 'Изменение статуса...';
      }

      setProgressDialog({
        isOpen: true,
        title,
        current: 0,
        total: selectedProductIds.size,
        result: undefined
      });

      // Execute bulk action
      bulkActionMutation.mutate({ action });
    }
  };

  const handleCopyRules = (sourceProductId: string) => {
    setIsCopyRulesModalOpen(false);

    setProgressDialog({
      isOpen: true,
      title: 'Копирование правил...',
      current: 0,
      total: selectedProductIds.size,
      result: undefined
    });

    bulkActionMutation.mutate({
      action: { type: 'copy_rules' },
      sourceProductId
    });
  };

  // Calculate select all checkbox state
  const selectAllState = useMemo(() => {
    if (selectedProductIds.size === 0) return 'none';
    if (selectedProductIds.size === filteredAndSortedProducts.length) return 'all';
    return 'some';
  }, [selectedProductIds.size, filteredAndSortedProducts.length]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 'var(--spacing-4xl)' }}>
        <Loader2 className="animate-spin" style={{ width: '32px', height: '32px' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 'var(--spacing-4xl)' }}>
        <p style={{ color: 'hsl(var(--destructive))' }}>
          Ошибка загрузки товаров: {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </div>
    );
  }

  return (
    <div className="dashboard-section">
      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedCount={selectedProductIds.size}
        onClearSelection={handleClearSelection}
        onAction={handleBulkAction}
      />

      {/* Main Section */}
      <div style={{
        background: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        borderRadius: '12px',
        overflow: 'hidden'
      }}>
        {/* Section Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px 32px',
          borderBottom: '1px solid hsl(var(--border))',
          background: 'hsl(var(--card))'
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'hsl(var(--foreground))' }}>
            Список товаров ({filteredAndSortedProducts.length})
          </h2>
        </div>

        {/* Filters Bar */}
        <div style={{
          padding: '20px 32px',
          borderBottom: '1px solid hsl(var(--border))',
          background: '#fafbfc'
        }}>
          <div style={{
            display: 'flex',
            gap: '12px',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <input
              type="text"
              placeholder="🔍 Поиск по названию, артикулу WB или артикулу продавца..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                minWidth: '300px',
                padding: '8px 12px',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '14px'
              }}
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '13px',
                background: 'white',
                cursor: 'pointer'
              }}
            >
              <option value="all">Все статусы</option>
              <option value="active">🟢 Активная работа</option>
              <option value="not_working">⚪ Не в работе</option>
              <option value="paused">🟡 Приостановлено</option>
              <option value="completed">🔵 Завершено</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '13px',
                background: 'white',
                cursor: 'pointer'
              }}
            >
              <option value="date-new">Сначала новые</option>
              <option value="date-old">Сначала старые</option>
              <option value="name-asc">По названию (А-Я)</option>
            </select>
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              title="Синхронизировать с WB"
              style={{
                padding: '8px 12px',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                background: 'white',
                cursor: syncMutation.isPending ? 'not-allowed' : 'pointer',
                opacity: syncMutation.isPending ? 0.6 : 1,
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => {
                if (!syncMutation.isPending) {
                  e.currentTarget.style.background = '#f1f5f9';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'white';
              }}
            >
              {syncMutation.isPending ? (
                <Loader2 style={{ width: '18px', height: '18px' }} className="animate-spin" />
              ) : (
                <RefreshCw style={{ width: '18px', height: '18px' }} />
              )}
            </button>
          </div>
        </div>

        {/* Products List */}
        <div style={{ padding: '24px 32px' }}>
          {/* Select All Checkbox */}
          {filteredAndSortedProducts.length > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '20px',
              padding: '12px 16px',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid hsl(var(--border))'
            }}>
              <input
                type="checkbox"
                checked={selectAllState === 'all'}
                ref={(input) => {
                  if (input) {
                    input.indeterminate = selectAllState === 'some';
                  }
                }}
                onChange={(e) => handleSelectAll(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <label style={{
                fontSize: '14px',
                fontWeight: 500,
                color: 'hsl(var(--foreground))',
                cursor: 'pointer'
              }}
              onClick={() => handleSelectAll(selectAllState !== 'all')}
              >
                {selectAllState === 'all'
                  ? `Выбрано все (${filteredAndSortedProducts.length})`
                  : selectAllState === 'some'
                  ? `Выбрано ${selectedProductIds.size} из ${filteredAndSortedProducts.length}`
                  : 'Выбрать все товары'}
              </label>
            </div>
          )}

          {filteredAndSortedProducts.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: 'var(--spacing-4xl)',
              color: 'hsl(var(--muted-foreground))'
            }}>
              {products.length === 0
                ? 'Товары не найдены. Нажмите "Синхронизировать" для загрузки.'
                : 'Не найдено товаров по заданным фильтрам'}
            </div>
          ) : (
            filteredAndSortedProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onStatusChange={handleStatusChange}
                onOpenSettings={handleOpenSettings}
                isSelected={selectedProductIds.has(product.id)}
                onToggleSelect={handleToggleSelect}
              />
            ))
          )}
        </div>
      </div>

      {/* Rules Configuration Sidebar */}
      {selectedProduct && (
        <RulesConfigSidebar
          isOpen={isSidebarOpen}
          onClose={handleCloseSidebar}
          storeId={storeId}
          productId={selectedProduct.id}
          productName={selectedProduct.name}
          currentRules={selectedProduct.rules}
          onRulesSaved={handleRulesSaved}
        />
      )}

      {/* Copy Rules Modal */}
      <CopyRulesModal
        isOpen={isCopyRulesModalOpen}
        onClose={() => setIsCopyRulesModalOpen(false)}
        products={products}
        onCopy={handleCopyRules}
      />

      {/* Progress Dialog */}
      <ProgressDialog
        isOpen={progressDialog.isOpen}
        title={progressDialog.title}
        current={progressDialog.current}
        total={progressDialog.total}
        result={progressDialog.result}
      />
    </div>
  );
}
