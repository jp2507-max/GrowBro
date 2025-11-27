import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { MMKV } from 'react-native-mmkv';

/**
 * MMKV storage adapter for Supabase Auth
 * Provides encrypted storage for authentication tokens and session data
 *
 * Note: MMKV provides:
 * - Android: encrypted-at-rest via AES-256
 * - iOS: OS-level encryption via file system
 */

// Generate or retrieve encryption key
// Stored securely in Keychain (iOS) / Keystore (Android) for persistence across app sessions
let encryptionKey: string | undefined;

async function getOrCreateEncryptionKey(): Promise<string> {
  if (encryptionKey) {
    return encryptionKey;
  }

  const ENCRYPTION_KEY_STORAGE_KEY = 'auth-encryption-key';

  try {
    // Try to load existing key from secure storage
    const storedKey = await SecureStore.getItemAsync(
      ENCRYPTION_KEY_STORAGE_KEY
    );
    if (storedKey) {
      encryptionKey = storedKey;
      return encryptionKey;
    }
  } catch (error) {
    console.warn('Failed to load encryption key from secure storage:', error);
    // Continue to generate a new key if loading fails
  }

  // Generate new key if not found or loading failed
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  encryptionKey = Array.from(randomBytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  // Store the new key securely
  try {
    await SecureStore.setItemAsync(ENCRYPTION_KEY_STORAGE_KEY, encryptionKey, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    });
  } catch (error) {
    console.error('Failed to store encryption key securely:', error);
    // Continue anyway - the key will work for this session
  }

  return encryptionKey;
}

// Create encrypted MMKV instance for auth storage
let authStorage: MMKV | null = null;

async function getAuthStorage(): Promise<MMKV> {
  if (authStorage) {
    return authStorage;
  }

  const key = await getOrCreateEncryptionKey();
  authStorage = new MMKV({
    id: 'auth-storage',
    encryptionKey: key,
  });

  return authStorage;
}

export async function clearAuthStorage(): Promise<void> {
  const storage = await getAuthStorage();
  try {
    const keys = storage.getAllKeys();
    for (const key of keys) {
      storage.delete(key);
    }
  } catch (error) {
    console.error('[auth] Failed to clear auth storage:', error);
  }
}

/**
 * Storage adapter for Supabase Auth that uses MMKV
 * Implements the Storage interface required by @supabase/supabase-js
 */
export const mmkvAuthStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const storage = await getAuthStorage();
    return storage.getString(key) ?? null;
  },

  setItem: async (key: string, value: string): Promise<void> => {
    const storage = await getAuthStorage();
    storage.set(key, value);
  },

  removeItem: async (key: string): Promise<void> => {
    const storage = await getAuthStorage();
    storage.delete(key);
  },
};

/**
 * Synchronous version of MMKV storage for cases where async is not needed
 * Note: Initialization must be done before using these methods
 */
export const mmkvAuthStorageSync = {
  getItem: (key: string): string | null => {
    if (!authStorage) {
      console.warn(
        'Auth storage not initialized. Call getAuthStorage() first.'
      );
      return null;
    }
    return authStorage.getString(key) ?? null;
  },

  setItem: (key: string, value: string): void => {
    if (!authStorage) {
      console.warn(
        'Auth storage not initialized. Call getAuthStorage() first.'
      );
      return;
    }
    authStorage.set(key, value);
  },

  removeItem: (key: string): void => {
    if (!authStorage) {
      console.warn(
        'Auth storage not initialized. Call getAuthStorage() first.'
      );
      return;
    }
    authStorage.delete(key);
  },
};

/**
 * Initialize auth storage before using sync methods
 * This should be called early in the app lifecycle (e.g., in _layout.tsx)
 */
export async function initAuthStorage(): Promise<void> {
  await getAuthStorage();
}
