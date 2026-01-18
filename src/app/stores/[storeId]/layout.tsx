'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Package, Star, MessageSquare, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { StoreSelector } from '@/components/layout/StoreSelector';

type Store = {
  id: string;
  name: string;
  created_at: string;
};

export default function StoreDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { storeId: string };
}) {
  const { storeId } = params;
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [store, setStore] = useState<Store | null>(null);

  // Fetch store info
  useEffect(() => {
    async function fetchStore() {
      try {
        const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';
        const response = await fetch(`/api/stores/${storeId}`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (response.ok) {
          const result = await response.json();
          setStore(result.data);
        }
      } catch (error) {
        console.error('Error fetching store:', error);
      }
    }
    fetchStore();
  }, [storeId]);

  // PERFORMANCE BOOST: Prefetch all tab data on store entry
  // This makes tab switching instant (no spinners)
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';

    // Prefetch Products tab
    queryClient.prefetchQuery({
      queryKey: ['products', storeId],
      queryFn: async () => {
        const response = await fetch(`/api/stores/${storeId}/products`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (!response.ok) throw new Error('Failed to prefetch products');
        return response.json();
      },
      staleTime: 2 * 60 * 1000, // 2 minutes
    });

    // Prefetch Reviews tab
    queryClient.prefetchQuery({
      queryKey: ['reviews', storeId, 0, 50, 'all', false, ''],
      queryFn: async () => {
        const response = await fetch(`/api/stores/${storeId}/reviews?skip=0&take=50&rating=all&hasAnswer=false&search=`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (!response.ok) throw new Error('Failed to prefetch reviews');
        return response.json();
      },
      staleTime: 2 * 60 * 1000,
    });

    // Prefetch Chats tab (both stats and list)
    queryClient.prefetchQuery({
      queryKey: ['chats-stats', storeId],
      queryFn: async () => {
        const response = await fetch(`/api/stores/${storeId}/chats?skip=0&take=1&tag=all&search=`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (!response.ok) throw new Error('Failed to prefetch chat stats');
        return response.json();
      },
      staleTime: 30 * 1000,
    });

    queryClient.prefetchQuery({
      queryKey: ['chats', storeId, 0, 100, 'all', ''],
      queryFn: async () => {
        const response = await fetch(`/api/stores/${storeId}/chats?skip=0&take=100&tag=all&search=`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (!response.ok) throw new Error('Failed to prefetch chats');
        return response.json();
      },
      staleTime: 2 * 60 * 1000,
    });

    // Prefetch AI Logs tab
    queryClient.prefetchQuery({
      queryKey: ['ai-logs', storeId, 0, 50],
      queryFn: async () => {
        const response = await fetch(`/api/stores/${storeId}/logs?skip=0&take=50`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (!response.ok) throw new Error('Failed to prefetch AI logs');
        return response.json();
      },
      staleTime: 2 * 60 * 1000,
    });
  }, [storeId, queryClient]);

  const tabs = [
    { href: `/stores/${storeId}/products`, label: 'Товары', icon: Package },
    { href: `/stores/${storeId}/reviews`, label: 'Отзывы', icon: Star },
    { href: `/stores/${storeId}/chats`, label: 'Чаты', icon: MessageSquare },
    { href: `/stores/${storeId}/logs`, label: 'AI', icon: Sparkles },
  ];

  return (
    <div className="dashboard-container">
      {/* NEW UNIFIED HEADER */}
      <div className="header-unified">
        {/* LEFT: Back Arrow + Tabs */}
        <div className="header-left">
          <Link href="/" className="btn-back" title="Все магазины">
            <ArrowLeft style={{ width: '20px', height: '20px' }} />
          </Link>

          {/* Navigation Tabs */}
          <nav className="header-tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = pathname === tab.href;

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`tab-item ${isActive ? 'active' : ''}`}
                >
                  <Icon style={{ width: '18px', height: '18px' }} />
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* RIGHT: Store Selector Dropdown */}
        <div className="header-right">
          {store && (
            <StoreSelector
              currentStoreId={storeId}
              currentStoreName={store.name}
              currentPathname={pathname}
            />
          )}
        </div>
      </div>

      {/* Main Content */}
      <main>{children}</main>
    </div>
  );
}
