'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';

type Store = {
  id: string;
  name: string;
  created_at: string;
};

interface StoreSelectorProps {
  currentStoreId: string;
  currentStoreName: string;
}

export function StoreSelector({ currentStoreId, currentStoreName }: StoreSelectorProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch all stores
  useEffect(() => {
    async function fetchStores() {
      try {
        const apiKey = process.env.NEXT_PUBLIC_API_KEY || 'wbrm_0ab7137430d4fb62948db3a7d9b4b997';
        const response = await fetch('/api/stores', {
          headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (response.ok) {
          const data = await response.json();
          setStores(data.data || data);
        }
      } catch (error) {
        console.error('Error fetching stores:', error);
      }
    }
    fetchStores();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get store initials for icon
  const getStoreInitials = (name: string): string => {
    const words = name.split(' ').filter(w => w.length > 0);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Get gradient color for store icon (deterministic based on index)
  const getGradient = (index: number): string => {
    const gradients = [
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    ];
    return gradients[index % gradients.length];
  };

  // Filter stores by search query
  const filteredStores = stores.filter(store =>
    store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    store.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle store selection
  const handleSelectStore = (storeId: string) => {
    setIsOpen(false);
    router.push(`/stores/${storeId}/products`);
  };

  return (
    <div className="store-selector" ref={dropdownRef}>
      <button
        className={`store-selector-trigger ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="store-selector-label">
          <span
            className="store-icon"
            style={{ background: getGradient(stores.findIndex(s => s.id === currentStoreId)) }}
          >
            {getStoreInitials(currentStoreName)}
          </span>
          <span className="store-name">{currentStoreName}</span>
        </span>
        <ChevronDown className={`chevron ${isOpen ? 'rotate' : ''}`} style={{ width: '16px', height: '16px' }} />
      </button>

      {isOpen && (
        <div className="store-selector-dropdown">
          <div className="dropdown-header">
            <input
              type="text"
              className="dropdown-search"
              placeholder="Поиск по ИНН, наименованию..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <ul className="dropdown-list">
            {filteredStores.map((store, index) => (
              <li
                key={store.id}
                className={`dropdown-item ${store.id === currentStoreId ? 'active' : ''}`}
                onClick={() => handleSelectStore(store.id)}
              >
                <div className="dropdown-item-content">
                  <div
                    className="store-icon"
                    style={{ background: getGradient(index) }}
                  >
                    {getStoreInitials(store.name)}
                  </div>
                  <div className="dropdown-item-text">
                    <div className="dropdown-item-name">{store.name}</div>
                    <div className="dropdown-item-meta">ID: {store.id.substring(0, 12)}...</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {filteredStores.length === 0 && (
            <div className="dropdown-empty">
              <p>Магазины не найдены</p>
            </div>
          )}

          <div className="dropdown-footer">
            <button
              className="btn-add-store"
              onClick={() => {
                setIsOpen(false);
                router.push('/');
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Добавить компанию
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
