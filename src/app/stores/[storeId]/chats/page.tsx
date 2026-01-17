'use client';

import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useParams } from 'next/navigation';
import { MessengerView } from '@/components/chats/MessengerView';
import { ChatsToolbar } from '@/components/chats/ChatsToolbar';
import { ChatsTableView } from '@/components/chats/ChatsTableView';
import { useChatsStore } from '@/store/chatsStore';
import { Toaster } from 'react-hot-toast';

export default function ChatsPage() {
  const params = useParams();
  const storeId = params.storeId as string;

  // View Mode from Zustand store
  const { viewMode } = useChatsStore();

  // Fetch tag stats for the toolbar
  const {
    data,
    isLoading: loading,
    error
  } = useQuery({
    queryKey: ['chats-stats', storeId],
    queryFn: async () => {
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';
      const response = await fetch(`/api/stores/${storeId}/chats?skip=0&take=1&tag=all&search=`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error('Не удалось загрузить данные. Проверьте подключение.');
      }

      const chatsData = await response.json();
      return chatsData;
    },
    staleTime: 24 * 60 * 60 * 1000,
    cacheTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const chats = data?.data || [];
  const tagStats = data?.tagStats || {
    active: 0,
    successful: 0,
    unsuccessful: 0,
    no_reply: 0,
    untagged: 0
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
        {/* Section Header */}
        <div className="section-header-with-actions">
          <h2 className="section-header-title">💬 Чаты магазина ({chats.length})</h2>
        </div>

        {/* Horizontal Toolbar */}
        <ChatsToolbar storeId={storeId} tagStats={tagStats} />

        {/* Messenger View */}
        {viewMode === 'messenger' && <MessengerView storeId={storeId} tagStats={tagStats} />}

        {/* Table View */}
        {viewMode === 'table' && <ChatsTableView storeId={storeId} />}
      </div>
    </>
  );
}
