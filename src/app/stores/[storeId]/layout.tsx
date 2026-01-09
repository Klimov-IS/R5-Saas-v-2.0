'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, Package, Star, MessageSquare, Bot } from 'lucide-react';
import { useEffect, useState } from 'react';

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
        const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_u1512gxsgp1nt1n31fmsj1d31o51jue';
        const response = await fetch(`/api/stores/${storeId}`, {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (response.ok) {
          const result = await response.json();
          setStore(result.data); // API возвращает { data: store }
        }
      } catch (error) {
        console.error('Error fetching store:', error);
      }
    }
    fetchStore();
  }, [storeId]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const tabs = [
    { href: `/stores/${storeId}/products`, label: 'Товары', icon: Package },
    { href: `/stores/${storeId}/reviews`, label: 'Отзывы', icon: Star },
    { href: `/stores/${storeId}/chats`, label: 'Чаты', icon: MessageSquare },
    { href: `/stores/${storeId}/logs`, label: 'Логи AI', icon: Bot },
  ];

  return (
    <div className="dashboard-container">
      {/* Store Header */}
      <div className="store-header">
        <div className="store-header-main">
          <Link href="/">
            <button className="btn btn-outline btn-sm btn-icon">
              <ArrowLeft style={{ width: '16px', height: '16px' }} />
              Все магазины
            </button>
          </Link>
          <div className="store-header-info">
            <h1 className="store-title">
              {store ? `Магазин "${store.name}"` : 'Загрузка...'}
            </h1>
            <p className="store-meta">
              {store ? `Добавлен: ${formatDate(store.created_at)}` : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="tabs-nav">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = pathname === tab.href;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`tab-item ${isActive ? 'active' : ''}`}
            >
              <Icon style={{ width: '16px', height: '16px' }} />
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Main Content */}
      <main>{children}</main>
    </div>
  );
}
