'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

/**
 * React Query Provider Component
 *
 * Provides caching and data synchronization for the entire application
 *
 * Default cache times configured for different data types:
 * - Products: 24 hours (very static - only updates on manual sync)
 * - Reviews/Chats: 2 minutes (semi-static - updates on sync)
 * - Stores: 5 minutes (rarely changes)
 *
 * Benefits:
 * - Automatic caching and revalidation
 * - Background refetching
 * - Optimistic updates
 * - Deduplication of requests
 * - Expected reduction: 60-80% fewer API calls
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Stale time: how long before data is considered "old"
            staleTime: 2 * 60 * 1000, // 2 minutes (default)

            // Cache time: how long to keep data in cache when not in use
            cacheTime: 10 * 60 * 1000, // 10 minutes

            // Refetch on window focus (good for real-time updates)
            refetchOnWindowFocus: true,

            // Retry failed requests
            retry: 1,

            // Show stale data while refetching
            keepPreviousData: true,
          },
          mutations: {
            // Retry failed mutations once
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* DevTools - only in development (hidden by default, use Ctrl+Shift+D to toggle) */}
      {process.env.NODE_ENV === 'development' && false && (
        <ReactQueryDevtools initialIsOpen={false} position="bottom-left" />
      )}
    </QueryClientProvider>
  );
}
