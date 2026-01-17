'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Package, Star, MessageSquare, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
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
  const [store, setStore] = useState<Store | null>(null);

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
            />
          )}
        </div>
      </div>

      {/* Main Content */}
      <main>{children}</main>
    </div>
  );
}
