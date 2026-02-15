/**
 * Shared cache for extension stores API
 * Pre-warmed every 5 minutes by CRON job
 */

import { query } from '@/db/client';

// Cache storage
interface CacheEntry {
  data: StoreResponse[];
  cachedAt: number;
}

interface StoreResponse {
  id: string;
  name: string;
  isActive: boolean;
  draftComplaintsCount: number;
}

interface StoreRow {
  id: string;
  name: string;
  owner_id: string;
  status: string;
  draft_complaints_count: string;
}

// In-memory cache: userId -> stores data
const storesCache = new Map<string, CacheEntry>();

// Cache TTL: 1 hour (fallback if CRON doesn't run)
const CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Get cached stores for a user
 */
export function getCachedStores(userId: string): StoreResponse[] | null {
  const entry = storesCache.get(userId);
  if (!entry) return null;

  // Check if cache is expired (safety net)
  const now = Date.now();
  if (now - entry.cachedAt > CACHE_TTL_MS) {
    storesCache.delete(userId);
    return null;
  }

  return entry.data;
}

/**
 * Set cached stores for a user
 */
export function setCachedStores(userId: string, data: StoreResponse[]): void {
  storesCache.set(userId, { data, cachedAt: Date.now() });
}

/**
 * Get cache age in seconds for a user
 */
export function getCacheAge(userId: string): number | null {
  const entry = storesCache.get(userId);
  if (!entry) return null;
  return Math.floor((Date.now() - entry.cachedAt) / 1000);
}

/**
 * Refresh cache for a single user
 */
export async function refreshCacheForUser(userId: string): Promise<StoreResponse[]> {
  const result = await query<StoreRow>(
    `
    SELECT
      s.id,
      s.name,
      s.owner_id,
      s.status,
      COALESCE(cnt.draft_count, 0)::text as draft_complaints_count
    FROM stores s
    LEFT JOIN (
      SELECT rc.store_id, COUNT(*) as draft_count
      FROM review_complaints rc
      JOIN products p ON rc.product_id = p.id
      WHERE rc.status = 'draft'
        AND p.work_status = 'active'
      GROUP BY rc.store_id
    ) cnt ON cnt.store_id = s.id
    WHERE s.owner_id = $1
    ORDER BY s.name ASC
    `,
    [userId]
  );

  const stores: StoreResponse[] = result.rows.map(row => ({
    id: row.id,
    name: row.name,
    isActive: row.status === 'active',
    draftComplaintsCount: parseInt(row.draft_complaints_count) || 0,
  }));

  setCachedStores(userId, stores);
  return stores;
}

/**
 * Refresh cache for ALL users with stores
 * Called by CRON every 5 minutes
 */
export async function refreshAllUsersCache(): Promise<{ usersRefreshed: number; totalStores: number }> {
  console.log('[Stores Cache] Starting full cache refresh...');

  // Get all unique owner_ids who have stores
  const usersResult = await query<{ owner_id: string }>(
    `SELECT DISTINCT owner_id FROM stores WHERE status = 'active'`
  );

  let totalStores = 0;

  for (const row of usersResult.rows) {
    try {
      const stores = await refreshCacheForUser(row.owner_id);
      totalStores += stores.length;
    } catch (error) {
      console.error(`[Stores Cache] Error refreshing cache for user ${row.owner_id}:`, error);
    }
  }

  console.log(`[Stores Cache] ✅ Refreshed cache for ${usersResult.rows.length} users, ${totalStores} stores total`);

  return {
    usersRefreshed: usersResult.rows.length,
    totalStores,
  };
}

/**
 * Get cache stats
 */
export function getCacheStats(): { usersInCache: number; oldestCacheAge: number | null } {
  let oldestAge: number | null = null;

  storesCache.forEach((entry) => {
    const age = Math.floor((Date.now() - entry.cachedAt) / 1000);
    if (oldestAge === null || age > oldestAge) {
      oldestAge = age;
    }
  });

  return {
    usersInCache: storesCache.size,
    oldestCacheAge: oldestAge,
  };
}
