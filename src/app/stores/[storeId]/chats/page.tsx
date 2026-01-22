'use client';

import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { MessengerView } from '@/components/chats/MessengerView';
import { ChatsToolbar } from '@/components/chats/ChatsToolbar';
import { ChatsTableView } from '@/components/chats/ChatsTableView';
import KanbanBoardView from '@/components/chats/KanbanBoardView';
import { useChatsStore } from '@/store/chatsStore';
import { Toaster } from 'react-hot-toast';
import type { ChatStatus } from '@/db/helpers';

export default function ChatsPage() {
  const params = useParams();
  const storeId = params.storeId as string;

  // View Mode, Filters and Selection from Zustand store
  const {
    viewMode,
    statusFilter,
    lastSender,
    hasDraft,
    searchQuery,
    selectedChatIds,
    setCurrentStoreId,
  } = useChatsStore();

  // Set current store ID when component mounts or storeId changes
  useEffect(() => {
    setCurrentStoreId(storeId);
  }, [storeId, setCurrentStoreId]);

  // Ref to access KanbanBoardView methods
  const kanbanRef = useRef<{
    selectedCount: number;
    handleBulkGenerate: () => void;
    handleBulkSend: () => void;
    handleBulkChangeStatus: (status: ChatStatus) => void;
    clearSelection: () => void;
  } | null>(null);

  // Fetch ALL chats for status statistics (used for toolbar counters)
  // ✅ NO FILTERS in queryKey - load once, filter on client
  const {
    data: statsData,
    isLoading: loadingStats,
    error: statsError
  } = useQuery({
    queryKey: ['chats-stats', storeId], // ✅ Only storeId - counters show ALL chats always
    queryFn: async () => {
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';
      const params = new URLSearchParams({
        skip: '0',
        take: '500', // Load all chats for accurate stats
        status: 'all', // Get all statuses
        sender: 'all', // Get all senders
        search: '', // No search filter
      });
      const response = await fetch(`/api/stores/${storeId}/chats?${params}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error('Не удалось загрузить статистику чатов.');
      }

      const chatsData = await response.json();
      return chatsData;
    },
    // PERFORMANCE FIX: Longer cache for static stats
    staleTime: 2 * 60 * 1000,         // 2 minutes
    cacheTime: 10 * 60 * 1000,     // 10 minutes
    refetchOnWindowFocus: true,   // Refetch when user returns to tab
    refetchOnMount: true,         // Refetch when component mounts
  });

  // Fetch ALL chats for Kanban view - NO FILTERS in queryKey for instant client-side filtering
  // ✅ Load once, filter on client → 0ms filter switching
  const {
    data: allChatsData,
    isLoading: loadingAllChats,
    error: allChatsError
  } = useQuery({
    queryKey: ['all-chats', storeId], // ✅ No filters - load ALL chats once
    queryFn: async () => {
      const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';
      const params = new URLSearchParams({
        skip: '0',
        take: '500',
        status: 'all', // ✅ Get ALL chats
        sender: 'all', // ✅ Get ALL senders
        search: '', // ✅ No search filter
      });
      const response = await fetch(`/api/stores/${storeId}/chats?${params}`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new Error('Не удалось загрузить чаты для Канбана.');
      }

      const chatsData = await response.json();
      return chatsData;
    },
    enabled: viewMode === 'kanban', // Only fetch when Kanban view is active
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const statsChats = statsData?.data || [];
  const allChats = allChatsData?.data || [];

  // ✅ CLIENT-SIDE FILTERING for Kanban (instant 0ms switching)
  const filteredChats = allChats.filter((chat: any) => {
    // Status filter
    if (statusFilter !== 'all' && chat.status !== statusFilter) return false;

    // Last Sender filter
    if (lastSender === 'client' && chat.lastMessageSender !== 'client') return false;
    if (lastSender === 'seller' && chat.lastMessageSender !== 'seller') return false;

    // Draft filter
    if (hasDraft && !chat.draftReply) return false;

    // Search filter (client name, product name, last message)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesClient = chat.clientName?.toLowerCase().includes(query);
      const matchesProduct = chat.productName?.toLowerCase().includes(query);
      const matchesMessage = chat.lastMessageText?.toLowerCase().includes(query);
      if (!matchesClient && !matchesProduct && !matchesMessage) return false;
    }

    return true;
  });

  // Calculate status statistics from statsChats (always loaded)
  const statusStats = statsChats.reduce((acc: any, chat: any) => {
    const status = chat.status || 'inbox';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {
    inbox: 0,
    in_progress: 0,
    awaiting_reply: 0,
    resolved: 0,
    closed: 0,
  });

  if (loadingStats) {
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

  if (statsError) {
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
            ⚠️ Ошибка загрузки статистики
          </p>
          <p style={{ color: 'var(--color-muted)', marginBottom: '20px' }}>
            {(statsError as Error).message}
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
        {/* Horizontal Toolbar */}
        <ChatsToolbar
          storeId={storeId}
          statusStats={statusStats}
          selectedCount={selectedChatIds.size}
          onBulkGenerate={() => kanbanRef.current?.handleBulkGenerate()}
          onBulkSend={() => kanbanRef.current?.handleBulkSend()}
          onBulkChangeStatus={(status) => kanbanRef.current?.handleBulkChangeStatus(status)}
          onClearSelection={() => kanbanRef.current?.clearSelection()}
        />

        {/* Messenger View */}
        {viewMode === 'messenger' && <MessengerView storeId={storeId} />}

        {/* Table View */}
        {viewMode === 'table' && <ChatsTableView storeId={storeId} />}

        {/* Kanban View */}
        {viewMode === 'kanban' && (
          loadingAllChats ? (
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
              <p style={{ color: 'var(--color-muted)' }}>Загрузка чатов для Канбана...</p>
            </div>
          ) : allChatsError ? (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              border: '2px dashed var(--color-error)',
              borderRadius: 'var(--radius-lg)',
              backgroundColor: '#fef2f2'
            }}>
              <p style={{ color: 'var(--color-error)', fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
                ⚠️ Ошибка загрузки чатов
              </p>
              <p style={{ color: 'var(--color-muted)', marginBottom: '20px' }}>
                {(allChatsError as Error).message}
              </p>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => window.location.reload()}
              >
                <RefreshCw style={{ width: '16px', height: '16px' }} />
                Повторить попытку
              </button>
            </div>
          ) : (
            <KanbanBoardView
              ref={kanbanRef}
              chats={filteredChats.map((chat: any) => ({
                id: chat.id,
                storeId: chat.storeId,
                clientName: chat.clientName,
                productName: chat.productName,
                lastMessageText: chat.lastMessageText,
                lastMessageSender: chat.lastMessageSender,
                lastMessageDate: chat.lastMessageDate,
                draftReply: chat.draftReply,
                status: chat.status || 'inbox',
                messageCount: chat.messageCount || 0,
              }))}
              storeId={storeId}
            />
          )
        )}
      </div>
    </>
  );
}
