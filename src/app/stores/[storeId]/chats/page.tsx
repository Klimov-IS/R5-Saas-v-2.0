'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Bot, MessageCircle, ChevronLeft, ChevronRight, Table, MessageSquare } from 'lucide-react';
import { useParams } from 'next/navigation';
import { MessengerView } from '@/components/chats/MessengerView';
import { FilterPanel } from '@/components/chats/FilterPanel';
import { useChatsStore } from '@/store/chatsStore';
import { Toaster } from 'react-hot-toast';

type Product = {
  id: string;
  nm_id: number;
  name: string;
  vendor_code: string;
};

type Chat = {
  id: string;
  storeId: string;
  clientName: string;
  productNmId: string;
  productName: string | null;
  productVendorCode: string | null;
  lastMessageDate: string;
  lastMessageText: string;
  lastMessageSender: 'client' | 'seller';
  tag: 'active' | 'successful' | 'unsuccessful' | 'no_reply' | 'untagged' | 'completed';
  draftReply: string | null;
  product?: Product;
};

type TagStats = {
  active: number;
  successful: number;
  unsuccessful: number;
  no_reply: number;
  untagged: number;
};

type ChatsResponse = {
  data: Chat[];
  totalCount: number;
};

async function fetchChatsData(
  storeId: string,
  page: number,
  tagFilter: string,
  searchQuery: string
): Promise<{ chats: Chat[]; totalCount: number; tagStats: TagStats }> {
  const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';
  const itemsPerPage = 25;
  const skip = (page - 1) * itemsPerPage;

  // Parallel fetch chats and products
  const [chatsRes, productsRes] = await Promise.all([
    fetch(`/api/stores/${storeId}/chats?skip=${skip}&take=${itemsPerPage}&tag=${tagFilter}&search=${searchQuery}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    }),
    fetch(`/api/stores/${storeId}/products`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    })
  ]);

  if (!chatsRes.ok || !productsRes.ok) {
    throw new Error('Не удалось загрузить данные. Проверьте подключение.');
  }

  const chatsData: ChatsResponse = await chatsRes.json();
  const productsData: Product[] = await productsRes.json();

  // Create products map by nm_id
  const productsMap: Record<string, Product> = {};
  (productsData.data || productsData).forEach((p: Product) => {
    productsMap[p.nm_id.toString()] = p;
  });

  // Enrich chats with product data
  const enrichedChats = (chatsData.data || chatsData).map((chat: Chat) => ({
    ...chat,
    product: productsMap[chat.productNmId]
  }));

  // Calculate tag statistics
  const stats: TagStats = {
    active: 0,
    successful: 0,
    unsuccessful: 0,
    no_reply: 0,
    untagged: 0
  };

  enrichedChats.forEach((chat: Chat) => {
    if (chat.tag === 'active') stats.active++;
    else if (chat.tag === 'successful') stats.successful++;
    else if (chat.tag === 'unsuccessful') stats.unsuccessful++;
    else if (chat.tag === 'no_reply') stats.no_reply++;
    else if (chat.tag === 'untagged') stats.untagged++;
  });

  return {
    chats: enrichedChats,
    totalCount: chatsData.totalCount || 0,
    tagStats: stats
  };
}

export default function ChatsPage() {
  const params = useParams();
  const storeId = params.storeId as string;

  // View Mode from Zustand store
  const { viewMode, setViewMode } = useChatsStore();

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  const [tagFilter, setTagFilter] = useState('all');
  const [searchInput, setSearchInput] = useState(''); // Immediate input value
  const [searchQuery, setSearchQuery] = useState(''); // Debounced value for API
  const [sortBy, setSortBy] = useState('date-new');

  // Debounce search input (500ms delay)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setSearchQuery(searchInput);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [tagFilter, searchQuery]);

  // ✅ React Query - каждая страница кешируется отдельно!
  const {
    data,
    isLoading: loading,
    error
  } = useQuery({
    queryKey: ['chats', storeId, currentPage, tagFilter, searchQuery],
    queryFn: () => fetchChatsData(storeId, currentPage, tagFilter, searchQuery),
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - data only changes on WB sync!
    cacheTime: 60 * 60 * 1000, // 1 hour - auto-cleanup old pages
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    keepPreviousData: true, // ✅ Smooth pagination transition
  });

  const chats = data?.chats || [];
  const totalCount = data?.totalCount || 0;
  const tagStats = data?.tagStats || {
    active: 0,
    successful: 0,
    unsuccessful: 0,
    no_reply: 0,
    untagged: 0
  };
  const totalPages = Math.ceil(totalCount / itemsPerPage);

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(totalPages, prev + 1));
  };

  // Get client initials
  const getClientInitials = (name: string): string => {
    if (!name) return '??';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Get gradient for client avatar
  const getClientGradient = (index: number): string => {
    const gradients = [
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
      'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    ];
    return gradients[index % gradients.length];
  };

  // Format relative time
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} мин назад`;
    } else if (diffHours < 24) {
      return `${diffHours} ${diffHours === 1 ? 'час' : diffHours < 5 ? 'часа' : 'часов'} назад`;
    } else {
      return `${diffDays} ${diffDays === 1 ? 'день' : diffDays < 5 ? 'дня' : 'дней'} назад`;
    }
  };

  // Format full date
  const formatFullDate = (dateString: string): string => {
    const date = new Date(dateString);
    const day = date.getDate();
    const month = date.toLocaleDateString('ru-RU', { month: 'short' });
    const year = date.getFullYear();
    const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return `${day} ${month} ${year}, ${time}`;
  };

  // Get tag badge style
  const getTagBadgeStyle = (tag: string) => {
    switch (tag) {
      case 'active':
        return {
          backgroundColor: '#d1fae5',
          color: '#065f46',
          dotColor: '#10b981'
        };
      case 'successful':
        return {
          backgroundColor: '#dbeafe',
          color: '#1e40af',
          dotColor: '#3b82f6'
        };
      case 'unsuccessful':
        return {
          backgroundColor: '#fee2e2',
          color: '#991b1b',
          dotColor: '#ef4444'
        };
      case 'no_reply':
        return {
          backgroundColor: '#fef3c7',
          color: '#92400e',
          dotColor: '#f59e0b'
        };
      case 'untagged':
      default:
        return {
          backgroundColor: '#f3f4f6',
          color: '#4b5563',
          dotColor: '#9ca3af'
        };
    }
  };

  // Get tag label
  const getTagLabel = (tag: string): string => {
    switch (tag) {
      case 'active': return 'Активный';
      case 'successful': return 'Успешный';
      case 'unsuccessful': return 'Неуспешный';
      case 'no_reply': return 'Нет ответа';
      case 'untagged': return 'Не размечено';
      case 'completed': return 'Завершён';
      default: return tag;
    }
  };

  // Get message classification (mock AI classification)
  const getMessageClassification = (text: string): { label: string; color: string } | null => {
    const lowerText = text.toLowerCase();

    if (lowerText.includes('доставк') || lowerText.includes('получ')) {
      return { label: 'Вопрос о доставке', color: '#dbeafe' };
    }
    if (lowerText.includes('спасибо') || lowerText.includes('благодар') || lowerText.includes('отлично')) {
      return { label: 'Благодарность', color: '#d1fae5' };
    }
    if (lowerText.includes('возврат') || lowerText.includes('жалоб') || lowerText.includes('не работает')) {
      return { label: 'Жалоба / Возврат', color: '#fee2e2' };
    }
    if (lowerText.includes('цвет') || lowerText.includes('размер') || lowerText.includes('характеристик')) {
      return { label: 'Вопрос о товаре', color: '#fef3c7' };
    }

    return null;
  };

  // Filter and sort chats
  const filteredChats = chats
    .filter(chat => {
      // Tag filter
      if (tagFilter !== 'all' && chat.tag !== tagFilter) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesClient = chat.clientName.toLowerCase().includes(query);
        const matchesProduct = chat.product?.name.toLowerCase().includes(query);
        const matchesMessage = chat.lastMessageText.toLowerCase().includes(query);
        if (!matchesClient && !matchesProduct && !matchesMessage) return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'date-new') {
        return new Date(b.lastMessageDate).getTime() - new Date(a.lastMessageDate).getTime();
      } else if (sortBy === 'date-old') {
        return new Date(a.lastMessageDate).getTime() - new Date(b.lastMessageDate).getTime();
      } else if (sortBy === 'client-az') {
        return a.clientName.localeCompare(b.clientName, 'ru');
      }
      return 0;
    });

  // Handle sync
  const handleSync = async () => {
    const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';
    try {
      const response = await fetch(`/api/stores/${storeId}/dialogues/update`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to sync chats:', error);
    }
  };

  // Handle classify all
  const handleClassifyAll = async () => {
    alert('Функция классификации AI будет реализована в следующей версии');
  };

  if (loading) {
    return (
      <div className="dashboard-section">
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: '3px solid var(--color-border)',
            borderTopColor: 'var(--color-primary)',
            borderRadius: '50%',
            margin: '0 auto 16px',
            animation: 'spin 1s linear infinite'
          }}></div>
          <p style={{ color: 'var(--color-muted)' }}>Загрузка чатов...</p>
          <style jsx>{`
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-section">
        <div style={{
          textAlign: 'center',
          padding: '40px',
          border: '2px dashed var(--color-error)',
          borderRadius: 'var(--radius-lg)',
          backgroundColor: '#fef2f2'
        }}>
          <p style={{ color: 'var(--color-error)', fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
            ⚠️ Ошибка загрузки
          </p>
          <p style={{ color: 'var(--color-muted)', marginBottom: '20px' }}>
            {(error as Error).message}
          </p>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => window.location.reload()}
          >
            <RefreshCw style={{ width: '16px', height: '16px' }} />
            Повторить попытку
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Toaster position="top-right" />
      <div className="dashboard-section">
        {/* Section Header with Actions */}
        <div className="section-header-with-actions">
          <h2 className="section-header-title">💬 Чаты магазина ({chats.length})</h2>
          <div className="section-header-actions">
            {/* View Mode Toggle */}
            <div className="inline-flex bg-white border border-slate-200 rounded-lg p-1 gap-1">
              <button
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'table'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
                onClick={() => setViewMode('table')}
              >
                <Table className="w-4 h-4 inline mr-1.5" />
                Таблица
              </button>
              <button
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'messenger'
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
                onClick={() => setViewMode('messenger')}
              >
                <MessageSquare className="w-4 h-4 inline mr-1.5" />
                Мессенджер
              </button>
            </div>
          </div>
        </div>

        {/* Messenger View */}
        {viewMode === 'messenger' && <MessengerView storeId={storeId} tagStats={tagStats} />}

        {/* Table View */}
        {viewMode === 'table' && (
          <>

      {/* Tag Statistics */}
      <div style={{ marginTop: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {/* Active */}
        <div style={{
          padding: '12px 16px',
          background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid #6ee7b7'
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#065f46',
            textTransform: 'uppercase',
            marginBottom: '4px'
          }}>
            Активные
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#047857' }}>
            {tagStats.active}
          </div>
        </div>

        {/* Successful */}
        <div style={{
          padding: '12px 16px',
          background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid #93c5fd'
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#1e40af',
            textTransform: 'uppercase',
            marginBottom: '4px'
          }}>
            Успешные
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#1e3a8a' }}>
            {tagStats.successful}
          </div>
        </div>

        {/* Unsuccessful */}
        <div style={{
          padding: '12px 16px',
          background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid #fca5a5'
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#991b1b',
            textTransform: 'uppercase',
            marginBottom: '4px'
          }}>
            Неуспешные
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#7f1d1d' }}>
            {tagStats.unsuccessful}
          </div>
        </div>

        {/* No Reply */}
        <div style={{
          padding: '12px 16px',
          background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid #fcd34d'
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#92400e',
            textTransform: 'uppercase',
            marginBottom: '4px'
          }}>
            Нет ответа
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#78350f' }}>
            {tagStats.no_reply}
          </div>
        </div>

        {/* Untagged */}
        <div style={{
          padding: '12px 16px',
          background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid #d1d5db'
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#4b5563',
            textTransform: 'uppercase',
            marginBottom: '4px'
          }}>
            Не размечено
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#374151' }}>
            {tagStats.untagged}
          </div>
        </div>
      </div>

      {/* Filters Row */}
      <div className="filters-row" style={{ marginTop: '20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '300px' }}>
            <input
              type="text"
              placeholder="Поиск по клиенту, товару или сообщению..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '14px'
              }}
            />
          </div>
          <select
            className="filter-select"
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
          >
            <option value="all">Все теги</option>
            <option value="active">🟢 Активные</option>
            <option value="successful">🔵 Успешные</option>
            <option value="unsuccessful">🔴 Неуспешные</option>
            <option value="no_reply">🟡 Нет ответа</option>
            <option value="untagged">⚪ Не размечено</option>
          </select>
          <select
            className="filter-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="date-new">По дате (новые)</option>
            <option value="date-old">По дате (старые)</option>
            <option value="client-az">По клиенту А-Я</option>
          </select>
        </div>
      </div>

      {/* Chats Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Клиент</th>
              <th>Товар</th>
              <th>Последнее сообщение</th>
              <th>Дата</th>
              <th style={{ width: '140px' }}>Тег (AI)</th>
              <th style={{ width: '80px' }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {filteredChats.map((chat, index) => {
              const tagStyle = getTagBadgeStyle(chat.tag);
              const classification = getMessageClassification(chat.lastMessageText);
              const isUnsuccessful = chat.tag === 'unsuccessful';

              return (
                <tr
                  key={chat.id}
                  style={{
                    cursor: 'pointer',
                    backgroundColor: isUnsuccessful ? '#fef2f2' : 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    if (!isUnsuccessful) {
                      e.currentTarget.style.backgroundColor = '#f9fafb';
                    } else {
                      e.currentTarget.style.backgroundColor = '#fee2e2';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isUnsuccessful) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    } else {
                      e.currentTarget.style.backgroundColor = '#fef2f2';
                    }
                  }}
                >
                  {/* Client Column */}
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: getClientGradient(index),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 700,
                        fontSize: '14px'
                      }}>
                        {getClientInitials(chat.clientName)}
                      </div>
                      <div>
                        <div style={{
                          fontWeight: 600,
                          color: 'var(--color-foreground)',
                          fontSize: '13px'
                        }}>
                          {chat.clientName || 'Без имени'}
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: 'var(--color-muted)',
                          marginTop: '2px'
                        }}>
                          ID: {chat.id.substring(0, 10)}...
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Product Column */}
                  <td>
                    <div style={{
                      fontWeight: 500,
                      color: 'var(--color-foreground)',
                      fontSize: '13px'
                    }}>
                      {chat.product?.name || 'Товар не найден'}
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: 'var(--color-muted)',
                      marginTop: '2px'
                    }}>
                      WB: {chat.productNmId}
                    </div>
                  </td>

                  {/* Last Message Column */}
                  <td>
                    <p style={{
                      fontSize: '13px',
                      margin: 0,
                      color: 'var(--color-foreground)',
                      lineHeight: 1.4
                    }}>
                      {chat.lastMessageText}
                    </p>
                    {classification && (
                      <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span className="badge" style={{
                          backgroundColor: classification.color,
                          color: classification.color === '#fee2e2' ? '#991b1b' :
                                 classification.color === '#d1fae5' ? '#065f46' :
                                 classification.color === '#dbeafe' ? '#1e40af' : '#92400e',
                          fontSize: '10px',
                          padding: '2px 6px'
                        }}>
                          {classification.label}
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Date Column */}
                  <td>
                    <span style={{ fontSize: '13px', color: 'var(--color-muted)' }}>
                      {formatRelativeTime(chat.lastMessageDate)}
                    </span>
                    <div style={{
                      fontSize: '11px',
                      color: 'var(--color-muted)',
                      marginTop: '2px'
                    }}>
                      {formatFullDate(chat.lastMessageDate)}
                    </div>
                  </td>

                  {/* Tag Column */}
                  <td>
                    <span className="badge" style={{
                      backgroundColor: tagStyle.backgroundColor,
                      color: tagStyle.color,
                      fontWeight: 600
                    }}>
                      <span style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: tagStyle.dotColor,
                        marginRight: '4px'
                      }}></span>
                      {getTagLabel(chat.tag)}
                    </span>
                  </td>

                  {/* Actions Column */}
                  <td>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn-icon-sm" title="Открыть чат">
                        <MessageCircle style={{ width: '16px', height: '16px' }} />
                      </button>
                      {(chat.tag === 'active' || chat.tag === 'no_reply' || chat.tag === 'unsuccessful') && (
                        <button className="btn-icon-sm" title="Ответить AI">
                          <Bot style={{ width: '16px', height: '16px' }} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredChats.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '40px',
            color: 'var(--color-muted)',
            border: '2px dashed var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            marginTop: '20px'
          }}>
            <p>Чаты не найдены</p>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {filteredChats.length > 0 && totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '12px',
          marginTop: '20px',
          padding: '16px',
          borderTop: '1px solid var(--color-border)'
        }}>
          <button
            className="btn btn-outline btn-sm btn-icon"
            onClick={handlePreviousPage}
            disabled={currentPage === 1}
            style={{ opacity: currentPage === 1 ? 0.5 : 1 }}
          >
            <ChevronLeft style={{ width: '16px', height: '16px' }} />
            Назад
          </button>

          <span style={{ fontSize: '14px', color: 'var(--color-foreground)', fontWeight: 500 }}>
            Страница {currentPage} из {totalPages}
          </span>

          <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
            (всего: {totalCount})
          </span>

          <button
            className="btn btn-outline btn-sm btn-icon"
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            style={{ opacity: currentPage === totalPages ? 0.5 : 1 }}
          >
            Вперёд
            <ChevronRight style={{ width: '16px', height: '16px' }} />
          </button>
        </div>
      )}
          </>
        )}
      </div>
    </>
  );
}
