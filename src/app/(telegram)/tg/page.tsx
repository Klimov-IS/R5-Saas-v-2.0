'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegramAuth } from '@/lib/telegram-auth-context';
import TgQueueCard from '@/components/telegram/TgQueueCard';
import TgLoginForm from '@/components/telegram/TgLoginForm';

interface QueueItem {
  id: string;
  storeId: string;
  storeName: string;
  marketplace?: string;
  clientName: string;
  productName: string | null;
  lastMessageText: string | null;
  lastMessageDate: string | null;
  lastMessageSender: 'client' | 'seller' | null;
  hasDraft: boolean;
  draftPreview: string | null;
  status: string;
  tag: string | null;
  completionReason: string | null;
}

const STATUS_TABS = [
  { key: 'inbox', label: 'Входящие', color: '#3b82f6' },
  { key: 'awaiting_reply', label: 'Ожидание', color: '#f97316' },
  { key: 'in_progress', label: 'В работе', color: '#f59e0b' },
  { key: 'closed', label: 'Закрытые', color: '#9ca3af' },
] as const;

const EMPTY_MESSAGES: Record<string, { icon: string; title: string; subtitle: string }> = {
  inbox: { icon: '✅', title: 'Все чаты обработаны', subtitle: 'Новые ответы клиентов появятся здесь' },
  awaiting_reply: { icon: '⏳', title: 'Нет чатов в ожидании', subtitle: 'Здесь появятся чаты после отправки ответа' },
  in_progress: { icon: '📋', title: 'Нет чатов в работе', subtitle: 'Переместите чаты сюда из входящих' },
  closed: { icon: '📦', title: 'Нет закрытых чатов', subtitle: 'Закрытые чаты с причиной будут здесь' },
};

export default function TgQueuePage() {
  const router = useRouter();
  const devUser = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('dev_user');
  }, []);
  const { isLoading: authLoading, isAuthenticated, isLinked, error: authError, apiFetch, stores } = useTelegramAuth();
  // Restore last known queue items from sessionStorage to prevent blank state on navigation back
  const [queue, setQueue] = useState<QueueItem[]>(() => {
    try {
      const status = sessionStorage.getItem('tg_active_status') || 'inbox';
      const saved = sessionStorage.getItem(`tg_queue_items_${status}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  // Restore last known counts from sessionStorage to prevent flash-to-zero on navigation
  const [totalCount, setTotalCount] = useState<number>(() => {
    try { return parseInt(sessionStorage.getItem('tg_total_count') || '0', 10); } catch { return 0; }
  });
  // If we have cached items, skip loading state to show them immediately
  const [isLoading, setIsLoading] = useState(() => {
    try {
      const status = sessionStorage.getItem('tg_active_status') || 'inbox';
      return !sessionStorage.getItem(`tg_queue_items_${status}`);
    } catch { return true; }
  });
  const [error, setError] = useState<string | null>(null);

  // Status tabs
  const [activeStatus, setActiveStatus] = useState<string>(() => {
    try { return sessionStorage.getItem('tg_active_status') || 'inbox'; } catch { return 'inbox'; }
  });
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>(() => {
    try {
      const saved = sessionStorage.getItem('tg_status_counts');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  // Store filter
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem('tg_store_filter');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [showStoreFilter, setShowStoreFilter] = useState(false);
  const [storeSearch, setStoreSearch] = useState('');

  // Selection mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Bulk action state
  const [bulkAction, setBulkAction] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0, errors: 0 });

  // Read skipped chat IDs from sessionStorage
  const skippedIds = useMemo(() => {
    try {
      if (typeof window === 'undefined') return [];
      return JSON.parse(sessionStorage.getItem('tg_skipped_chats') || '[]') as string[];
    } catch { return []; }
  }, []);

  // Sort queue: non-skipped first, then skipped
  const sortedQueue = useMemo(() => {
    if (skippedIds.length === 0) return queue;
    const skippedSet = new Set(skippedIds);
    const normal = queue.filter(item => !skippedSet.has(item.id));
    const skipped = queue.filter(item => skippedSet.has(item.id));
    return [...normal, ...skipped];
  }, [queue, skippedIds]);

  // Save queue order to sessionStorage so chat detail page can navigate to next
  useEffect(() => {
    if (sortedQueue.length > 0) {
      try {
        sessionStorage.setItem('tg_queue_order', JSON.stringify(
          sortedQueue.map(item => ({ id: item.id, storeId: item.storeId }))
        ));
      } catch {}
    }
  }, [sortedQueue]);

  // Persist activeStatus
  useEffect(() => {
    try { sessionStorage.setItem('tg_active_status', activeStatus); } catch {}
  }, [activeStatus]);

  // Persist store filter
  useEffect(() => {
    try {
      if (selectedStoreIds.length > 0) {
        sessionStorage.setItem('tg_store_filter', JSON.stringify(selectedStoreIds));
      } else {
        sessionStorage.removeItem('tg_store_filter');
      }
    } catch {}
  }, [selectedStoreIds]);

  const fetchQueue = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams();
      params.set('limit', '50');
      params.set('status', activeStatus);
      if (selectedStoreIds.length > 0) {
        params.set('storeIds', selectedStoreIds.join(','));
      }
      const response = await apiFetch(`/api/telegram/queue?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to load queue');
      const data = await response.json();
      setQueue(data.data || []);
      setTotalCount(data.totalCount || 0);
      setStatusCounts(data.statusCounts || {});
      // Cache in sessionStorage to restore on next mount (prevents blank state on navigation back)
      try {
        sessionStorage.setItem('tg_total_count', String(data.totalCount || 0));
        sessionStorage.setItem('tg_status_counts', JSON.stringify(data.statusCounts || {}));
        sessionStorage.setItem(`tg_queue_items_${activeStatus}`, JSON.stringify(data.data || []));
      } catch {}
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [apiFetch, activeStatus, selectedStoreIds]);

  useEffect(() => {
    if (isAuthenticated && isLinked) {
      fetchQueue();
    }
  }, [isAuthenticated, isLinked, fetchQueue]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (!isAuthenticated || !isLinked) return;
    const interval = setInterval(() => {
      fetchQueue();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isAuthenticated, isLinked, fetchQueue]);

  // When tab changes: restore cached items for new status or show loading
  const prevStatusRef = useRef(activeStatus);
  useEffect(() => {
    if (prevStatusRef.current === activeStatus) return; // skip on mount
    prevStatusRef.current = activeStatus;
    try {
      const saved = sessionStorage.getItem(`tg_queue_items_${activeStatus}`);
      if (saved) {
        setQueue(JSON.parse(saved));
        setIsLoading(false);
      } else {
        setQueue([]);
        setIsLoading(true);
      }
    } catch {
      setQueue([]);
      setIsLoading(true);
    }
  }, [activeStatus]);

  // Reset selection mode when tab or store filter changes
  useEffect(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setBulkAction(null);
  }, [activeStatus, selectedStoreIds]);

  // Haptic feedback helper
  const haptic = useCallback((type: 'success' | 'error' | 'warning') => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.HapticFeedback) {
        tg.HapticFeedback.notificationOccurred(type);
      }
    } catch {}
  }, []);

  // Toggle selection
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Select all / deselect all
  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === sortedQueue.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sortedQueue.map(item => item.id)));
    }
  }, [selectedIds.size, sortedQueue]);

  // Exit selection mode
  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setBulkAction(null);
  }, []);

  // Bulk generate AI drafts
  const bulkGenerate = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setBulkAction('generate');
    setBulkProgress({ done: 0, total: ids.length, errors: 0 });
    let errors = 0;

    for (let i = 0; i < ids.length; i++) {
      try {
        const res = await apiFetch(`/api/telegram/chats/${ids[i]}/generate-ai`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        if (!res.ok) errors++;
      } catch {
        errors++;
      }
      setBulkProgress({ done: i + 1, total: ids.length, errors });
    }

    haptic(errors === 0 ? 'success' : 'warning');
    await fetchQueue();
    setBulkAction(null);
    exitSelectionMode();
  }, [selectedIds, apiFetch, haptic, fetchQueue, exitSelectionMode]);

  // Bulk send (only chats with drafts)
  const bulkSend = useCallback(async () => {
    const withDrafts = Array.from(selectedIds).filter(id => {
      const item = queue.find(q => q.id === id);
      return item?.hasDraft;
    });
    if (withDrafts.length === 0) {
      haptic('warning');
      return;
    }

    setBulkAction('send');
    setBulkProgress({ done: 0, total: withDrafts.length, errors: 0 });
    let errors = 0;

    for (let i = 0; i < withDrafts.length; i++) {
      try {
        const chatRes = await apiFetch(`/api/telegram/chats/${withDrafts[i]}`);
        if (!chatRes.ok) { errors++; setBulkProgress({ done: i + 1, total: withDrafts.length, errors }); continue; }
        const chatData = await chatRes.json();
        const draftText = chatData.chat?.draftReply;
        if (!draftText) { errors++; setBulkProgress({ done: i + 1, total: withDrafts.length, errors }); continue; }

        const sendRes = await apiFetch(`/api/telegram/chats/${withDrafts[i]}/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: draftText }),
        });
        if (!sendRes.ok) errors++;
      } catch {
        errors++;
      }
      setBulkProgress({ done: i + 1, total: withDrafts.length, errors });
    }

    haptic(errors === 0 ? 'success' : 'warning');
    await fetchQueue();
    setBulkAction(null);
    exitSelectionMode();
  }, [selectedIds, queue, apiFetch, haptic, fetchQueue, exitSelectionMode]);

  // Count selected with drafts (for send button label)
  const selectedWithDrafts = useMemo(() => {
    return Array.from(selectedIds).filter(id => queue.find(q => q.id === id)?.hasDraft).length;
  }, [selectedIds, queue]);

  // Store filter handlers
  const toggleStoreFilter = useCallback((storeId: string) => {
    setSelectedStoreIds(prev => {
      if (prev.includes(storeId)) return prev.filter(id => id !== storeId);
      return [...prev, storeId];
    });
  }, []);

  const clearStoreFilter = useCallback(() => {
    setSelectedStoreIds([]);
  }, []);

  // Auth loading state
  if (authLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center', color: 'var(--tg-hint)' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
          <div>Авторизация...</div>
        </div>
      </div>
    );
  }

  // Not linked — show login form
  if (!isLinked) {
    return <TgLoginForm />;
  }

  // Queue list (with loading/error/empty inline)
  return (
    <div style={{ padding: '12px 12px 80px' }} className="tg-safe-area">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', padding: '0 2px' }}>
        <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--tg-text)' }}>
          {selectionMode ? (
            <>
              Выбрано
              <span style={{ fontSize: '14px', fontWeight: 400, color: '#3b82f6', marginLeft: '8px' }}>
                {selectedIds.size} / {sortedQueue.length}
              </span>
            </>
          ) : (
            <>
              Очередь
              <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--tg-hint)', marginLeft: '8px' }}>
                {totalCount}
              </span>
            </>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {selectionMode ? (
            <>
              <button
                onClick={toggleSelectAll}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  fontSize: '13px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  color: '#3b82f6',
                  fontWeight: 600,
                }}
              >
                {selectedIds.size === sortedQueue.length ? 'Снять все' : 'Выбрать все'}
              </button>
              <button
                onClick={exitSelectionMode}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  fontSize: '13px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  color: 'var(--tg-hint)',
                  fontWeight: 600,
                }}
              >
                Отмена
              </button>
            </>
          ) : (
            <>
              {/* Store filter button */}
              <button
                onClick={() => setShowStoreFilter(!showStoreFilter)}
                style={{
                  backgroundColor: selectedStoreIds.length > 0 ? 'rgba(59,130,246,0.12)' : 'transparent',
                  border: selectedStoreIds.length > 0 ? '1px solid #3b82f6' : 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  color: selectedStoreIds.length > 0 ? '#3b82f6' : 'var(--tg-hint)',
                  fontWeight: 500,
                }}
              >
                {selectedStoreIds.length > 0 ? `☰ ${selectedStoreIds.length}` : '☰'}
              </button>
              <button
                onClick={() => setSelectionMode(true)}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  fontSize: '13px',
                  cursor: 'pointer',
                  padding: '4px 8px',
                  color: 'var(--tg-hint)',
                  fontWeight: 500,
                }}
              >
                Выбрать
              </button>
              <button
                onClick={fetchQueue}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                🔄
              </button>
            </>
          )}
        </div>
      </div>

      {/* Store filter panel */}
      {showStoreFilter && stores && stores.length > 0 && (
        <div style={{
          backgroundColor: 'var(--tg-secondary-bg)',
          borderRadius: '12px',
          padding: '10px 12px',
          marginBottom: '10px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--tg-text)' }}>Магазины</span>
            <button
              onClick={clearStoreFilter}
              style={{
                fontSize: '12px',
                color: selectedStoreIds.length > 0 ? '#3b82f6' : 'var(--tg-hint)',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Все магазины
            </button>
          </div>
          {stores.length > 5 && (
            <input
              type="text"
              placeholder="Поиск магазина..."
              value={storeSearch}
              onChange={(e) => setStoreSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                borderRadius: '8px',
                border: '1px solid rgba(0,0,0,0.1)',
                fontSize: '13px',
                backgroundColor: 'var(--tg-bg)',
                color: 'var(--tg-text)',
                marginBottom: '6px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          )}
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {stores
              .filter((store: { id: string; name: string }) =>
                !storeSearch || store.name.toLowerCase().includes(storeSearch.toLowerCase())
              )
              .map((store: { id: string; name: string }) => {
              const isChecked = selectedStoreIds.includes(store.id);
              return (
                <label key={store.id} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '6px 4px', cursor: 'pointer', fontSize: '13px', color: 'var(--tg-text)',
                }}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleStoreFilter(store.id)}
                    style={{ width: '16px', height: '16px', accentColor: '#3b82f6' }}
                  />
                  {store.name}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Status tabs */}
      <div style={{
        display: 'flex',
        gap: '6px',
        marginBottom: '12px',
        overflowX: 'auto',
        padding: '0 2px 4px',
        WebkitOverflowScrolling: 'touch' as any,
        msOverflowStyle: 'none',
        scrollbarWidth: 'none',
      }}>
        {STATUS_TABS.map(tab => {
          const count = statusCounts[tab.key] || 0;
          const isActive = activeStatus === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveStatus(tab.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 12px',
                borderRadius: '16px',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                backgroundColor: isActive ? tab.color : 'var(--tg-secondary-bg)',
                color: isActive ? '#fff' : 'var(--tg-hint)',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '0 5px',
                borderRadius: '8px',
                backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.08)',
                minWidth: '18px',
                textAlign: 'center',
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Loading state: show skeletons only when no cached items to display */}
      {isLoading && sortedQueue.length === 0 && (
        <div>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              backgroundColor: 'var(--tg-secondary-bg)',
              borderRadius: '12px',
              height: '100px',
              marginBottom: '8px',
              opacity: 0.5,
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
          ))}
          <style>{`@keyframes pulse { 0%,100% { opacity: 0.5; } 50% { opacity: 0.3; } }`}</style>
        </div>
      )}

      {/* Error state */}
      {!isLoading && error && (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>😕</div>
          <div style={{ fontSize: '16px', color: 'var(--tg-text)', marginBottom: '12px' }}>{error}</div>
          <button
            onClick={fetchQueue}
            style={{
              backgroundColor: 'var(--tg-button)',
              color: 'var(--tg-button-text)',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Повторить
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && sortedQueue.length === 0 && !authLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh', padding: '20px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>
              {EMPTY_MESSAGES[activeStatus]?.icon || '📋'}
            </div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--tg-text)', marginBottom: '8px' }}>
              {EMPTY_MESSAGES[activeStatus]?.title || 'Нет чатов'}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--tg-hint)' }}>
              {EMPTY_MESSAGES[activeStatus]?.subtitle || ''}
            </div>
            <button
              onClick={fetchQueue}
              style={{
                marginTop: '20px',
                backgroundColor: 'var(--tg-secondary-bg)',
                color: 'var(--tg-text)',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Обновить
            </button>
          </div>
        </div>
      )}

      {/* Cards: show whenever we have items, even during background refresh */}
      {!error && sortedQueue.map(item => (
        <TgQueueCard
          key={item.id}
          {...item}
          isSkipped={skippedIds.includes(item.id)}
          selectionMode={selectionMode}
          isSelected={selectedIds.has(item.id)}
          onToggleSelect={() => toggleSelect(item.id)}
          onClick={() => router.push(`/tg/chat/${item.id}?storeId=${item.storeId}${devUser ? `&dev_user=${devUser}` : ''}`)}
        />
      ))}

      {/* Bulk action bar */}
      {selectionMode && selectedIds.size > 0 && !bulkAction && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'var(--tg-bg)',
          borderTop: '1px solid rgba(0,0,0,0.1)',
          padding: '10px 14px',
          paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
          display: 'flex',
          gap: '8px',
          zIndex: 50,
        }}>
          <button
            onClick={bulkGenerate}
            style={{
              flex: 1,
              padding: '12px 8px',
              borderRadius: '10px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              backgroundColor: 'var(--tg-button)',
              color: 'var(--tg-button-text)',
            }}
          >
            AI ({selectedIds.size})
          </button>
          <button
            onClick={bulkSend}
            disabled={selectedWithDrafts === 0}
            style={{
              flex: 1,
              padding: '12px 8px',
              borderRadius: '10px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              backgroundColor: selectedWithDrafts > 0 ? '#22c55e' : '#ccc',
              color: '#fff',
            }}
          >
            Отправить ({selectedWithDrafts})
          </button>
          <button
            onClick={async () => {
              await fetchQueue();
              exitSelectionMode();
            }}
            style={{
              padding: '12px 14px',
              borderRadius: '10px',
              border: '1px solid rgba(0,0,0,0.12)',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              backgroundColor: 'transparent',
              color: 'var(--tg-text)',
            }}
          >
            🔄
          </button>
        </div>
      )}

      {/* Bulk action progress */}
      {bulkAction && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'var(--tg-bg)',
          borderTop: '1px solid rgba(0,0,0,0.1)',
          padding: '16px 14px',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
          zIndex: 50,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--tg-text)', marginBottom: '8px' }}>
            {bulkAction === 'generate' ? 'Генерация AI...' : 'Отправка...'}
            {' '}{bulkProgress.done} / {bulkProgress.total}
            {bulkProgress.errors > 0 && (
              <span style={{ color: '#ef4444', marginLeft: '8px' }}>
                ({bulkProgress.errors} ошибок)
              </span>
            )}
          </div>
          <div style={{
            height: '4px',
            backgroundColor: 'rgba(0,0,0,0.1)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${bulkProgress.total > 0 ? (bulkProgress.done / bulkProgress.total) * 100 : 0}%`,
              backgroundColor: bulkAction === 'generate' ? '#3b82f6' : '#22c55e',
              borderRadius: '2px',
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      )}
    </div>
  );
}
