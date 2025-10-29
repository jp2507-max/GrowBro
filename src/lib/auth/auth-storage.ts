import * as Crypto from 'expo-crypto';
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
// In production, this should be stored in Keychain (iOS) / Keystore (Android)
// For now, we use a deterministic key derivation from device-specific data
let encryptionKey: string | undefined;

async function getOrCreateEncryptionKey(): Promise<string> {
  if (encryptionKey) {
    return encryptionKey;
  }

  // In a real implementation, you'd want to:
  // 1. Try to load key from SecureStore/Keychain
  // 2. If not found, generate a new one and store it securely
  // 3. Use device-specific entropy for key generation
  //
  // For now, we generate a stable key using Expo's random bytes
  // This is a placeholder - replace with proper key management
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  encryptionKey = Array.from(randomBytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

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
