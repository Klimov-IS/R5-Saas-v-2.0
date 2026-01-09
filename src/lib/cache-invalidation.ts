import { QueryClient } from '@tanstack/react-query';

/**
 * Cache invalidation helper for WB Reputation Manager
 *
 * Invalidates React Query cache after data sync from Wildberries API.
 * All data is event-driven (only changes when manually synced from WB).
 */

export type SyncType = 'products' | 'reviews' | 'chats' | 'store';

/**
 * Invalidate cache after sync operation
 *
 * @param queryClient - React Query client instance
 * @param storeId - Store ID that was synced
 * @param syncType - Type of data that was synced
 */
export async function invalidateAfterSync(
  queryClient: QueryClient,
  storeId: string,
  syncType: SyncType
) {
  console.log(`[Cache Invalidation] Invalidating ${syncType} cache for store ${storeId}`);

  switch (syncType) {
    case 'products':
      // Products changed -> invalidate products & rules
      await queryClient.invalidateQueries(['products', storeId]);
      await queryClient.invalidateQueries(['product-rules', storeId]);
      console.log('✅ Invalidated: products, product-rules');
      break;

    case 'reviews':
      // Reviews changed -> invalidate all review pages
      await queryClient.invalidateQueries(['reviews', storeId]);
      console.log('✅ Invalidated: reviews (all pages)');
      break;

    case 'chats':
      // Chats changed -> invalidate all chat pages
      await queryClient.invalidateQueries(['chats', storeId]);
      console.log('✅ Invalidated: chats (all pages)');
      break;

    case 'store':
      // Store settings changed -> invalidate everything for this store
      await queryClient.invalidateQueries(['stores']);
      await queryClient.invalidateQueries(['overview', storeId]);
      await queryClient.invalidateQueries(['products', storeId]);
      await queryClient.invalidateQueries(['product-rules', storeId]);
      await queryClient.invalidateQueries(['reviews', storeId]);
      await queryClient.invalidateQueries(['chats', storeId]);
      console.log('✅ Invalidated: everything for store');
      break;
  }

  // Always update overview & stores list (statistics changed)
  await queryClient.invalidateQueries(['stores']);
  await queryClient.invalidateQueries(['overview', storeId]);
  console.log('✅ Invalidated: stores list, overview');
}

/**
 * Invalidate cache after adding a new store
 */
export async function invalidateAfterStoreAdd(queryClient: QueryClient) {
  await queryClient.invalidateQueries(['stores']);
  console.log('✅ [Cache Invalidation] Invalidated stores list after adding new store');
}

/**
 * Invalidate cache after updating product rules
 */
export async function invalidateAfterRulesUpdate(
  queryClient: QueryClient,
  storeId: string
) {
  await queryClient.invalidateQueries(['product-rules', storeId]);
  console.log(`✅ [Cache Invalidation] Invalidated product rules for store ${storeId}`);
}
