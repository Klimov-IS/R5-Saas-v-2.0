/**
 * usePersistedFilters Hook
 *
 * Persists filter state to sessionStorage for the current browser session.
 * Filters are global (not per-store) - same filters apply across all stores.
 *
 * Features:
 * - Automatic sync to sessionStorage on change
 * - Restore on page refresh
 * - TypeScript support with generics
 * - Hydration-safe (no SSR/client mismatch)
 */

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'reviews-filters';

export type FilterState = {
  search: string;
  ratings: number[];
  complaintStatuses: string[];
  productStatuses: string[];
  reviewStatusesWB: string[];
  chatStatuses: string[];
  productIds: string[]; // Array of selected product nm_ids
  hideRatingExcluded: boolean; // Hide reviews excluded from WB rating
};

// Default filter values
export const DEFAULT_FILTERS: FilterState = {
  search: '',
  ratings: [1, 2, 3], // DEFAULT: 1-3 stars
  complaintStatuses: [],  // [] = all statuses
  productStatuses: ['active'], // DEFAULT: active only
  reviewStatusesWB: [], // [] = all statuses
  chatStatuses: [], // [] = all statuses
  productIds: [], // [] = all products
  hideRatingExcluded: false, // show all by default
};

/**
 * Check if filters differ from defaults
 */
export function getActiveFilterCount(filters: FilterState): number {
  let count = 0;

  // Search is active if not empty
  if (filters.search.trim()) count++;

  // Ratings differ from default [1,2,3]
  const defaultRatings = [1, 2, 3];
  const ratingsMatch = filters.ratings.length === defaultRatings.length &&
    filters.ratings.every(r => defaultRatings.includes(r));
  if (!ratingsMatch) count++;

  // Complaint status is active if any selected
  if (filters.complaintStatuses.length > 0) count++;

  // Product status differs from default ['active']
  const defaultProductStatus = ['active'];
  const productStatusMatch = filters.productStatuses.length === defaultProductStatus.length &&
    filters.productStatuses.every(s => defaultProductStatus.includes(s));
  if (!productStatusMatch) count++;

  // Review WB status is active if any selected
  if (filters.reviewStatusesWB.length > 0) count++;

  // Chat status is active if any selected
  if (filters.chatStatuses.length > 0) count++;

  // Product IDs is active if any selected
  if (filters.productIds && filters.productIds.length > 0) count++;

  // Rating excluded filter is active if enabled
  if (filters.hideRatingExcluded) count++;

  return count;
}

/**
 * Check if filters are modified from defaults
 */
export function isFiltersModified(filters: FilterState): boolean {
  return getActiveFilterCount(filters) > 0;
}

/**
 * Hook to persist filters to sessionStorage
 *
 * Hydration-safe: always starts with defaults, then loads from storage after mount
 */
export function usePersistedFilters(): {
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  resetFilters: () => void;
  activeFilterCount: number;
  isModified: boolean;
  isHydrated: boolean;
} {
  // Always start with defaults to match server render
  const [filters, setFiltersState] = useState<FilterState>(DEFAULT_FILTERS);

  // Track hydration state to avoid showing stale badge
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from sessionStorage after mount (client-only)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to handle any missing fields
        setFiltersState({ ...DEFAULT_FILTERS, ...parsed });
      }
    } catch (e) {
      console.warn('[usePersistedFilters] Failed to parse stored filters:', e);
    }

    // Mark as hydrated after loading
    setIsHydrated(true);
  }, []);

  // Sync to sessionStorage on change (after hydration)
  useEffect(() => {
    if (!isHydrated) return;

    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch (e) {
      console.warn('[usePersistedFilters] Failed to save filters:', e);
    }
  }, [filters, isHydrated]);

  // Wrapped setter
  const setFilters = useCallback((newFilters: FilterState) => {
    setFiltersState(newFilters);
  }, []);

  // Reset to defaults
  const resetFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // Ignore
    }
  }, []);

  // Only count active filters after hydration to avoid SSR mismatch
  const activeFilterCount = isHydrated ? getActiveFilterCount(filters) : 0;

  return {
    filters,
    setFilters,
    resetFilters,
    activeFilterCount,
    isModified: isHydrated && isFiltersModified(filters),
    isHydrated,
  };
}
