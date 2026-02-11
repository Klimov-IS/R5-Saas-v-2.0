'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegramAuth } from '@/lib/telegram-auth-context';
import TgQueueCard from '@/components/telegram/TgQueueCard';

interface QueueItem {
  id: string;
  storeId: string;
  storeName: string;
  clientName: string;
  productName: string | null;
  lastMessageText: string | null;
  lastMessageDate: string | null;
  hasDraft: boolean;
  draftPreview: string | null;
  status: string;
  tag: string | null;
}

export default function TgQueuePage() {
  const router = useRouter();
  const devUser = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('dev_user');
  }, []);
  const { isLoading: authLoading, isAuthenticated, isLinked, error: authError, apiFetch } = useTelegramAuth();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Bulk action state
  const [bulkAction, setBulkAction] = useState<string | null>(null); // 'generate' | 'send' | null
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

  const fetchQueue = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiFetch('/api/telegram/queue?limit=50');
      if (!response.ok) throw new Error('Failed to load queue');
      const data = await response.json();
      setQueue(data.data || []);
      setTotalCount(data.totalCount || 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    if (isAuthenticated && isLinked) {
      fetchQueue();
    }
  }, [isAuthenticated, isLinked, fetchQueue]);

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
    // Refresh queue to get updated draft states
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
        // Get draft text first
        const chatRes = await apiFetch(`/api/telegram/chats/${withDrafts[i]}`);
        if (!chatRes.ok) { errors++; setBulkProgress({ done: i + 1, total: withDrafts.length, errors }); continue; }
        const chatData = await chatRes.json();
        const draftText = chatData.chat?.draftReply;
        if (!draftText) { errors++; setBulkProgress({ done: i + 1, total: withDrafts.length, errors }); continue; }

        // Send it
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

  // Not linked
  if (!isLinked) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', padding: '20px' }}>
        <div style={{ textAlign: 'center', color: 'var(--tg-text)' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔗</div>
          <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Аккаунт не привязан</div>
          <div style={{ fontSize: '14px', color: 'var(--tg-hint)', lineHeight: 1.5 }}>
            Отправьте боту команду:<br />
            <code style={{ backgroundColor: 'var(--tg-secondary-bg)', padding: '2px 6px', borderRadius: '4px' }}>
              /link ваш_api_ключ
            </code>
          </div>
        </div>
      </div>
    );
  }

  // Loading queue
  if (isLoading) {
    return (
      <div style={{ padding: '16px' }}>
        <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: 'var(--tg-text)' }}>
          Очередь чатов
        </div>
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
    );
  }

  // Error
  if (error) {
    return (
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
    );
  }

  // Empty queue
  if (sortedQueue.length === 0) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh', padding: '20px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--tg-text)', marginBottom: '8px' }}>
            Все чаты обработаны
          </div>
          <div style={{ fontSize: '14px', color: 'var(--tg-hint)' }}>
            Новые ответы клиентов появятся здесь
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
    );
  }

  // Queue list
  return (
    <div style={{ padding: '12px 12px 80px' }} className="tg-safe-area">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', padding: '0 2px' }}>
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
        <div style={{ display: 'flex', gap: '8px' }}>
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

      {/* Cards */}
      {sortedQueue.map(item => (
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
          {/* Generate AI */}
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
            🤖 AI ({selectedIds.size})
          </button>

          {/* Send */}
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
            ✅ Отправить ({selectedWithDrafts})
          </button>

          {/* Refresh */}
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
            {bulkAction === 'generate' ? '🤖 Генерация AI...' : '✅ Отправка...'}
            {' '}{bulkProgress.done} / {bulkProgress.total}
            {bulkProgress.errors > 0 && (
              <span style={{ color: '#ef4444', marginLeft: '8px' }}>
                ({bulkProgress.errors} ошибок)
              </span>
            )}
          </div>
          {/* Progress bar */}
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
