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
  // Review & product rules
  reviewRating?: number | null;
  reviewDate?: string | null;
  complaintStatus?: string | null;
  productStatus?: string | null;
  offerCompensation?: boolean | null;
  maxCompensation?: string | null;
  compensationType?: string | null;
  compensationBy?: string | null;
  chatStrategy?: string | null;
}

const STATUS_TABS = [
  { key: 'awaiting_reply', label: 'Ожидание' },
  { key: 'inbox', label: 'Входящие' },
  { key: 'in_progress', label: 'В работе' },
  { key: 'closed', label: 'Закрытые' },
] as const;

const EMPTY_MESSAGES: Record<string, { icon: string; title: string; subtitle: string }> = {
  awaiting_reply: { icon: '⏳', title: 'Нет чатов в ожидании', subtitle: 'Чаты с активной рассылкой появятся здесь' },
  inbox: { icon: '✅', title: 'Все чаты обработаны', subtitle: 'Новые ответы покупателей появятся здесь' },
  in_progress: { icon: '📋', title: 'Нет чатов в работе', subtitle: 'Чаты с ответом продавца появятся здесь' },
  closed: { icon: '📦', title: 'Нет закрытых чатов', subtitle: 'Закрытые чаты с причиной будут здесь' },
};

export default function TgQueuePage() {
  const router = useRouter();
  const devUser = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('dev_user');
  }, []);
  const { isLoading: authLoading, isAuthenticated, isLinked, error: authError, apiFetch, stores } = useTelegramAuth();
  // Cache helpers: queue items valid for 10 minutes
  const CACHE_TTL_MS = 10 * 60 * 1000;
  const isCacheValid = (statusKey: string) => {
    try {
      const ts = parseInt(sessionStorage.getItem(`tg_queue_ts_${statusKey}`) || '0', 10);
      return Date.now() - ts < CACHE_TTL_MS && !!sessionStorage.getItem(`tg_queue_items_${statusKey}`);
    } catch { return false; }
  };

  // Restore last known queue items from sessionStorage to prevent blank state on navigation back
  const [queue, setQueue] = useState<QueueItem[]>(() => {
    try {
      const status = sessionStorage.getItem('tg_active_status') || 'inbox';
      if (!isCacheValid(status)) return [];
      const saved = sessionStorage.getItem(`tg_queue_items_${status}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  // Restore last known counts from sessionStorage to prevent flash-to-zero on navigation
  const [totalCount, setTotalCount] = useState<number>(() => {
    try { return parseInt(sessionStorage.getItem('tg_total_count') || '0', 10); } catch { return 0; }
  });
  // If we have valid cached items, skip loading state to show them immediately
  const [isLoading, setIsLoading] = useState(() => {
    try {
      const status = sessionStorage.getItem('tg_active_status') || 'inbox';
      return !isCacheValid(status);
    } catch { return true; }
  });
  const [error, setError] = useState<string | null>(null);

  // Status tabs
  const [activeStatus, setActiveStatus] = useState<string>(() => {
    try { return sessionStorage.getItem('tg_active_status') || 'awaiting_reply'; } catch { return 'awaiting_reply'; }
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
        sessionStorage.setItem(`tg_queue_ts_${activeStatus}`, Date.now().toString());
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
    if (isCacheValid(activeStatus)) {
      try {
        const saved = sessionStorage.getItem(`tg_queue_items_${activeStatus}`);
        if (saved) {
          setQueue(JSON.parse(saved));
          setIsLoading(false);
          return;
        }
      } catch {}
    }
    setQueue([]);
    setIsLoading(true);
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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#F7F8FA' }}>
        <div style={{ textAlign: 'center', color: '#6B7280' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
          <div style={{ fontSize: '14px' }}>Авторизация...</div>
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
    <div style={{ padding: '12px 12px 80px', backgroundColor: '#F7F8FA', minHeight: '100vh' }} className="tg-safe-area">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', padding: '0 4px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{ fontSize: '20px', fontWeight: 600, color: '#111827' }}>
            {selectionMode ? 'Выбрано' : 'Очередь'}
          </span>
          <span style={{ fontSize: '14px', fontWeight: 400, color: selectionMode ? '#2563EB' : '#6B7280' }}>
            {selectionMode ? `${selectedIds.size} / ${sortedQueue.length}` : totalCount}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {selectionMode ? (
            <>
              <button
                onClick={toggleSelectAll}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  fontSize: '12px',
                  cursor: 'pointer',
                  padding: '6px 10px',
                  borderRadius: '12px',
                  color: '#2563EB',
                  fontWeight: 600,
                  transition: 'all 0.15s ease-out',
                }}
              >
                {selectedIds.size === sortedQueue.length ? 'Снять все' : 'Выбрать все'}
              </button>
              <button
                onClick={exitSelectionMode}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  fontSize: '12px',
                  cursor: 'pointer',
                  padding: '6px 10px',
                  borderRadius: '12px',
                  color: '#6B7280',
                  fontWeight: 600,
                  transition: 'all 0.15s ease-out',
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
                  backgroundColor: selectedStoreIds.length > 0 ? '#EEF2FF' : 'transparent',
                  border: selectedStoreIds.length > 0 ? '1px solid rgba(37,99,235,0.2)' : 'none',
                  borderRadius: '12px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  padding: '6px 10px',
                  color: selectedStoreIds.length > 0 ? '#2563EB' : '#6B7280',
                  fontWeight: selectedStoreIds.length > 0 ? 600 : 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  transition: 'all 0.15s ease-out',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="9" y1="18" x2="15" y2="18"/></svg>
                {selectedStoreIds.length > 0 ? selectedStoreIds.length : ''}
              </button>
              <button
                onClick={() => setSelectionMode(true)}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  fontSize: '12px',
                  cursor: 'pointer',
                  padding: '6px 10px',
                  borderRadius: '12px',
                  color: '#6B7280',
                  fontWeight: 500,
                  transition: 'all 0.15s ease-out',
                }}
              >
                Выбрать
              </button>
              <button
                onClick={fetchQueue}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '12px',
                  color: '#6B7280',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 0.15s ease-out',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Store filter panel */}
      {showStoreFilter && stores && stores.length > 0 && (
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E6E8EC',
          padding: '14px',
          marginBottom: '12px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#6B7280' }}>Магазины</span>
            <button
              onClick={clearStoreFilter}
              style={{
                fontSize: '12px',
                color: selectedStoreIds.length > 0 ? '#2563EB' : '#6B7280',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontWeight: 500,
                transition: 'color 0.15s',
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
                padding: '8px 12px',
                borderRadius: '12px',
                border: '1px solid #E6E8EC',
                fontSize: '13px',
                backgroundColor: '#F7F8FA',
                color: '#111827',
                marginBottom: '8px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s',
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
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 8px', borderRadius: '12px', cursor: 'pointer',
                  fontSize: '13px', fontWeight: 500, color: '#111827',
                  transition: 'background-color 0.15s',
                }}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleStoreFilter(store.id)}
                    style={{ width: '16px', height: '16px', accentColor: '#2563EB', borderRadius: '4px' }}
                  />
                  {store.name}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Status tabs */}
      <div className="tabs-scroll" style={{
        display: 'flex',
        gap: '6px',
        marginBottom: '12px',
        overflowX: 'auto',
        padding: '0 2px 4px',
        WebkitOverflowScrolling: 'touch' as any,
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
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '100px',
                border: 'none',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                backgroundColor: isActive ? '#2563EB' : '#EEF2FF',
                color: isActive ? '#FFFFFF' : '#111827',
                transition: 'all 0.15s ease-out',
                boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
              }}
            >
              {tab.label}
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                padding: '0 6px',
                borderRadius: '8px',
                backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.06)',
                minWidth: '20px',
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
              backgroundColor: '#FFFFFF',
              borderRadius: '16px',
              border: '1px solid #E6E8EC',
              height: '110px',
              marginBottom: '8px',
              animation: 'r5-pulse 1.5s ease-in-out infinite',
            }} />
          ))}
        </div>
      )}

      {/* Error state */}
      {!isLoading && error && (
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E6E8EC',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          padding: '40px 20px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.8 }}>😕</div>
          <div style={{ fontSize: '16px', color: '#111827', marginBottom: '16px', fontWeight: 500 }}>{error}</div>
          <button
            onClick={fetchQueue}
            style={{
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '12px',
              padding: '10px 24px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease-out',
            }}
          >
            Повторить
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && sortedQueue.length === 0 && !authLoading && (
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid #E6E8EC',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          padding: '48px 24px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.8 }}>
            {EMPTY_MESSAGES[activeStatus]?.icon || '📋'}
          </div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>
            {EMPTY_MESSAGES[activeStatus]?.title || 'Нет чатов'}
          </div>
          <div style={{ fontSize: '14px', color: '#6B7280' }}>
            {EMPTY_MESSAGES[activeStatus]?.subtitle || ''}
          </div>
          <button
            onClick={fetchQueue}
            style={{
              marginTop: '24px',
              backgroundColor: '#EEF2FF',
              color: '#2563EB',
              border: 'none',
              borderRadius: '12px',
              padding: '10px 24px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease-out',
            }}
          >
            Обновить
          </button>
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
          backgroundColor: '#FFFFFF',
          borderTop: '1px solid #E6E8EC',
          padding: '10px 14px',
          paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
          display: 'flex',
          gap: '8px',
          zIndex: 50,
          boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
        }}>
          <button
            onClick={bulkGenerate}
            style={{
              flex: 1,
              padding: '12px 8px',
              borderRadius: '12px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              background: 'linear-gradient(135deg, #2563EB, #3B82F6)',
              color: '#FFFFFF',
              transition: 'all 0.15s ease-out',
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
              borderRadius: '12px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              backgroundColor: selectedWithDrafts > 0 ? '#10B981' : '#D1D5DB',
              color: '#fff',
              transition: 'all 0.15s ease-out',
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
              borderRadius: '12px',
              border: '2px solid #E6E8EC',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              backgroundColor: '#FFFFFF',
              color: '#6B7280',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.15s ease-out',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
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
          backgroundColor: '#FFFFFF',
          borderTop: '1px solid #E6E8EC',
          padding: '16px 14px',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
          zIndex: 50,
          textAlign: 'center',
          boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
        }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>
            {bulkAction === 'generate' ? 'Генерация AI...' : 'Отправка...'}
            {' '}{bulkProgress.done} / {bulkProgress.total}
            {bulkProgress.errors > 0 && (
              <span style={{ color: '#EF4444', marginLeft: '8px' }}>
                ({bulkProgress.errors} ошибок)
              </span>
            )}
          </div>
          <div style={{
            height: '4px',
            backgroundColor: '#E6E8EC',
            borderRadius: '2px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${bulkProgress.total > 0 ? (bulkProgress.done / bulkProgress.total) * 100 : 0}%`,
              backgroundColor: bulkAction === 'generate' ? '#2563EB' : '#10B981',
              borderRadius: '2px',
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>
      )}
    </div>
  );
}
