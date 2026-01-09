/**
 * Query State Hook Stub
 *
 * Placeholder for URL query parameter state management.
 * For production, consider using nuqs or similar library.
 */

import { useState, useCallback } from 'react';

export function useQueryState<T extends string = string>(
  key: string,
  defaultValue?: T
): [T | null, (value: T | null) => void] {
  const [value, setValue] = useState<T | null>(defaultValue || null);

  const setQueryValue = useCallback((newValue: T | null) => {
    setValue(newValue);

    // Update URL query parameter
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (newValue === null) {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, newValue);
      }
      window.history.replaceState({}, '', url.toString());
    }
  }, [key]);

  return [value, setQueryValue];
}

export default useQueryState;
