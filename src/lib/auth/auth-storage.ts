/**
 * MMKV Storage Adapter for Supabase Auth
 *
 * This module provides a Supabase-compatible storage interface that wraps
 * the centralized secure-storage system. All auth data is stored in the
 * encrypted `authStorage` domain from `@/lib/security/secure-storage`.
 *
 * Storage Architecture:
 * - Uses the centralized `authStorage` from secure-storage.ts
 * - Provides async getItem/setItem/removeItem for Supabase compatibility
 * - Provides sync accessors for direct token operations
 */
import {
  authStorage,
  initializeSecureStorage,
  isSecureStorageInitialized,
} from '@/lib/security/secure-storage';

/**
 * Storage adapter for Supabase Auth that wraps the centralized secure storage
 * Implements the Storage interface required by @supabase/supabase-js
 */
export const mmkvAuthStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (!isSecureStorageInitialized()) {
      await initializeSecureStorage();
    }
    const value = authStorage.get(key);
    return typeof value === 'string' ? value : null;
  },

  setItem: async (key: string, value: string): Promise<void> => {
    if (!isSecureStorageInitialized()) {
      await initializeSecureStorage();
    }
    authStorage.set(key, value);
  },

  removeItem: async (key: string): Promise<void> => {
    if (!isSecureStorageInitialized()) {
      await initializeSecureStorage();
    }
    authStorage.delete(key);
  },
};

/**
 * Synchronous version of storage for cases where async is not needed
 * Note: Initialization must be done before using these methods
 */
export const mmkvAuthStorageSync = {
  getItem: (key: string): string | null => {
    if (!isSecureStorageInitialized()) {
      console.warn(
        'Auth storage not initialized. Call initAuthStorage() first.'
      );
      return null;
    }
    const value = authStorage.get(key);
    return typeof value === 'string' ? value : null;
  },

  setItem: (key: string, value: string): void => {
    if (!isSecureStorageInitialized()) {
      console.warn(
        'Auth storage not initialized. Call initAuthStorage() first.'
      );
      return;
    }
    authStorage.set(key, value);
  },

  removeItem: (key: string): void => {
    if (!isSecureStorageInitialized()) {
      console.warn(
        'Auth storage not initialized. Call initAuthStorage() first.'
      );
      return;
    }
    authStorage.delete(key);
  },
};

/**
 * Clear all auth storage data
 */
export async function clearAuthStorage(): Promise<void> {
  if (!isSecureStorageInitialized()) {
    await initializeSecureStorage();
  }
  try {
    const keys = authStorage.getAllKeys();
    for (const key of keys) {
      authStorage.delete(key);
    }
  } catch (error) {
    console.error('[auth] Failed to clear auth storage:', error);
  }
}

/**
 * Initialize auth storage before using sync methods
 * This should be called early in the app lifecycle (e.g., in _layout.tsx)
 */
export async function initAuthStorage(): Promise<void> {
  await initializeSecureStorage();
}
