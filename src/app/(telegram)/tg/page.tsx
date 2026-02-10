'use client';

import { useEffect, useState, useCallback } from 'react';
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
  const { isLoading: authLoading, isAuthenticated, isLinked, error: authError, apiFetch } = useTelegramAuth();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  if (queue.length === 0) {
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
          Очередь
          <span style={{ fontSize: '14px', fontWeight: 400, color: 'var(--tg-hint)', marginLeft: '8px' }}>
            {totalCount}
          </span>
        </div>
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
      </div>

      {/* Cards */}
      {queue.map(item => (
        <TgQueueCard
          key={item.id}
          {...item}
          onClick={() => router.push(`/tg/chat/${item.id}?storeId=${item.storeId}`)}
        />
      ))}
    </div>
  );
}
