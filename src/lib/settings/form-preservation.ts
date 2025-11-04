/**
 * Form State Preservation Service
 * Preserves form state across re-authentication flows
 *
 * Requirement: 12.5
 */

import { storage } from '@/lib/storage';

const PRESERVATION_KEY_PREFIX = 'form.preserved.';
const PRESERVATION_TTL_MS = 15 * 60 * 1000; // 15 minutes

export interface PreservedFormState<T = Record<string, unknown>> {
  screenName: string;
  formData: T;
  timestamp: number;
  validationState?: Record<string, string | undefined>;
  dirtyFields?: string[];
}

/**
 * Preserve form state to storage before re-auth
 */
export function preserveFormState<T = Record<string, unknown>>(
  screenName: string,
  formData: T,
  options?: {
    validationState?: Record<string, string | undefined>;
    dirtyFields?: string[];
  }
): void {
  const state: PreservedFormState<T> = {
    screenName,
    formData,
    timestamp: Date.now(),
    validationState: options?.validationState,
    dirtyFields: options?.dirtyFields,
  };

  const key = `${PRESERVATION_KEY_PREFIX}${screenName}`;
  storage.set(key, JSON.stringify(state));
}

/**
 * Restore form state after re-auth
 * Returns null if no preserved state or if TTL expired
 */
export function restoreFormState<T = Record<string, unknown>>(
  screenName: string
): PreservedFormState<T> | null {
  const key = `${PRESERVATION_KEY_PREFIX}${screenName}`;
  const stored = storage.getString(key);

  if (!stored) return null;

  try {
    const state = JSON.parse(stored) as PreservedFormState<T>;

    // Check TTL
    const age = Date.now() - state.timestamp;
    if (age > PRESERVATION_TTL_MS) {
      // Expired, clear and return null
      clearPreservedState(screenName);
      return null;
    }

    return state;
  } catch {
    // Parse error, clear and return null
    clearPreservedState(screenName);
    return null;
  }
}

/**
 * Clear preserved form state
 */
export function clearPreservedState(screenName: string): void {
  const key = `${PRESERVATION_KEY_PREFIX}${screenName}`;
  storage.delete(key);
}

/**
 * Clear all preserved form states (for cleanup)
 */
export function clearAllPreservedStates(): void {
  const keys = storage.getAllKeys();
  keys
    .filter((key) => key.startsWith(PRESERVATION_KEY_PREFIX))
    .forEach((key) => storage.delete(key));
}

/**
 * Check if form state exists for screen
 */
export function hasPreservedState(screenName: string): boolean {
  const key = `${PRESERVATION_KEY_PREFIX}${screenName}`;
  return storage.contains(key);
}
