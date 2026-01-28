/**
 * Secure Storage Adapter for Supabase Auth
 *
 * This module provides a Supabase-compatible storage interface that wraps
 * the centralized encrypted secure-storage system. All auth data is stored in the
 * encrypted `authStorage` domain from `@/lib/security/secure-storage`.
 *
 * Storage Architecture:
 * - Uses the centralized `authStorage` from secure-storage.ts
 * - Provides async getItem/setItem/removeItem for Supabase compatibility
 * - Provides sync accessors for direct token operations
 */
import * as SecureStore from 'expo-secure-store';
import { MMKV } from 'react-native-mmkv';

import { ENCRYPTION_SENTINEL_KEY } from '@/lib/security/constants';
import {
  authStorage,
  initializeSecureStorage,
  isSecureStorageInitialized,
} from '@/lib/security/secure-storage';

const LEGACY_MMKV_AUTH_ID = 'auth-storage';
const LEGACY_KEY_VERSION_STORAGE_KEY = 'auth_key_version';
const LEGACY_ENCRYPTION_KEY_PREFIX = 'auth_encryption_key_v';
const LEGACY_MIGRATION_FLAG_KEY = 'auth:migration:legacy-mmkv';
const LEGACY_MIGRATION_STATUS = {
  complete: 'complete',
  failed: 'failed',
  skipped: 'skipped',
} as const;

let legacyMigrationPromise: Promise<void> | null = null;

/**
 * Storage adapter for Supabase Auth that wraps the centralized secure storage
 * Implements the Storage interface required by @supabase/supabase-js
 */
async function ensureAuthStorageReady(): Promise<void> {
  await initAuthStorage();
}

function getAuthStorageKeys(): string[] {
  return authStorage
    .getAllKeys()
    .filter(
      (key) =>
        key !== ENCRYPTION_SENTINEL_KEY && key !== LEGACY_MIGRATION_FLAG_KEY
    );
}

async function getLegacyEncryptionKey(): Promise<string | null> {
  try {
    const version = await SecureStore.getItemAsync(
      LEGACY_KEY_VERSION_STORAGE_KEY
    );
    if (!version) return null;
    return await SecureStore.getItemAsync(
      `${LEGACY_ENCRYPTION_KEY_PREFIX}${version}`
    );
  } catch (error) {
    console.warn('[auth-storage] Legacy key lookup failed:', error);
    return null;
  }
}

async function migrateLegacyAuthStorage(): Promise<void> {
  try {
    const migrationStatus = authStorage.get(LEGACY_MIGRATION_FLAG_KEY);
    if (
      migrationStatus === LEGACY_MIGRATION_STATUS.complete ||
      migrationStatus === LEGACY_MIGRATION_STATUS.failed ||
      migrationStatus === LEGACY_MIGRATION_STATUS.skipped
    ) {
      return;
    }

    const legacyKey = await getLegacyEncryptionKey();
    if (!legacyKey) {
      authStorage.set(
        LEGACY_MIGRATION_FLAG_KEY,
        LEGACY_MIGRATION_STATUS.skipped
      );
      return;
    }

    const legacyStorage = new MMKV({
      id: LEGACY_MMKV_AUTH_ID,
      encryptionKey: legacyKey,
    });

    const legacyKeys = legacyStorage
      .getAllKeys()
      .filter(
        (key) =>
          key !== ENCRYPTION_SENTINEL_KEY && key !== LEGACY_MIGRATION_FLAG_KEY
      );

    if (legacyKeys.length === 0) {
      authStorage.set(
        LEGACY_MIGRATION_FLAG_KEY,
        LEGACY_MIGRATION_STATUS.skipped
      );
      return;
    }

    const existingKeys = new Set(getAuthStorageKeys());
    let migratedCount = 0;
    let hasAllKeysAlready = true;

    for (const key of legacyKeys) {
      if (existingKeys.has(key)) {
        continue;
      }

      hasAllKeysAlready = false;

      const stringValue = legacyStorage.getString(key);
      if (stringValue !== undefined) {
        authStorage.set(key, stringValue);
        migratedCount += 1;
        continue;
      }

      const numberValue = legacyStorage.getNumber(key);
      if (numberValue !== undefined) {
        authStorage.set(key, numberValue);
        migratedCount += 1;
        continue;
      }

      const booleanValue = legacyStorage.getBoolean(key);
      if (booleanValue !== undefined) {
        authStorage.set(key, booleanValue);
        migratedCount += 1;
      }
    }

    if (migratedCount > 0 || hasAllKeysAlready) {
      legacyStorage.clearAll();
    }

    authStorage.set(
      LEGACY_MIGRATION_FLAG_KEY,
      LEGACY_MIGRATION_STATUS.complete
    );
  } catch (error) {
    console.warn('[auth-storage] Legacy storage migration failed:', error);
    authStorage.set(LEGACY_MIGRATION_FLAG_KEY, LEGACY_MIGRATION_STATUS.failed);
  }
}

export const mmkvAuthStorage = {
  getItem: async (key: string): Promise<string | null> => {
    await ensureAuthStorageReady();
    const value = authStorage.get(key);
    return typeof value === 'string' ? value : null;
  },

  setItem: async (key: string, value: string): Promise<void> => {
    await ensureAuthStorageReady();
    authStorage.set(key, value);
  },

  removeItem: async (key: string): Promise<void> => {
    await ensureAuthStorageReady();
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
  await ensureAuthStorageReady();
  const keys = getAuthStorageKeys();
  for (const key of keys) {
    authStorage.delete(key);
  }
}

/**
 * Initialize auth storage before using sync methods
 * This should be called early in the app lifecycle (e.g., in _layout.tsx)
 */
export async function initAuthStorage(): Promise<void> {
  if (!isSecureStorageInitialized()) {
    await initializeSecureStorage();
  }

  if (!legacyMigrationPromise) {
    legacyMigrationPromise = migrateLegacyAuthStorage();
  }

  await legacyMigrationPromise;
}
