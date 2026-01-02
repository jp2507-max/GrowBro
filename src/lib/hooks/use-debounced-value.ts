import { useEffect, useState } from 'react';

/**
 * Returns a debounced version of the input value.
 * The returned value only updates after the specified delay
 * has passed without the input value changing.
 *
 * @param value - The value to debounce
 * @param delayMs - Delay in milliseconds before updating
 * @returns The debounced value
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);

  return debounced;
}
