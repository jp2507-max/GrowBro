import * as SecureStore from 'expo-secure-store';

import { storage } from '@/lib/storage';

const FALLBACK_PREFIX = 'secure-config.';

// SecureStore has a 2048 byte limit per value
// Values larger than this should use MMKV (encrypted via device storage)
const SECURE_STORE_SIZE_LIMIT = 2048;

let secureStoreAvailable: boolean | null = null;

async function ensureAvailability(): Promise<boolean> {
  if (secureStoreAvailable !== null) return secureStoreAvailable;
  try {
    secureStoreAvailable = (await SecureStore.isAvailableAsync()) === true;
  } catch {
    secureStoreAvailable = false;
  }
  return secureStoreAvailable;
}

async function readSecureStore(key: string): Promise<string | null> {
  if (!(await ensureAvailability())) return null;
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function writeSecureStore(
  key: string,
  value: string | null
): Promise<void> {
  if (!(await ensureAvailability())) {
    if (value === null) storage.delete(buildFallbackKey(key));
    else storage.set(buildFallbackKey(key), value);
    return;
  }
  try {
    if (value === null) {
      await SecureStore.deleteItemAsync(key);
      // Also clean up fallback in case it was previously stored there
      storage.delete(buildFallbackKey(key));
    } else if (value.length > SECURE_STORE_SIZE_LIMIT) {
      // Value is too large for SecureStore, use MMKV instead
      // This prevents the "Value being stored in SecureStore is larger than 2048 bytes" warning
      storage.set(buildFallbackKey(key), value);
      // Clean up SecureStore entry if it exists (migrating from small to large value)
      try {
        await SecureStore.deleteItemAsync(key);
      } catch {
        // Ignore deletion errors
      }
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  } catch {
    // Fallback to MMKV if secure store operations fail at runtime.
    if (value === null) storage.delete(buildFallbackKey(key));
    else storage.set(buildFallbackKey(key), value);
  }
}

function readFallback(key: string): string | null {
  try {
    return storage.getString(buildFallbackKey(key)) ?? null;
  } catch {
    return null;
  }
}

function buildFallbackKey(key: string): string {
  return `${FALLBACK_PREFIX}${key}`;
}

export async function getSecureConfig<T>(key: string): Promise<T | null> {
  const raw = (await readSecureStore(key)) ?? readFallback(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setSecureConfig<T>(key: string, value: T): Promise<void> {
  const serialized = JSON.stringify(value);
  await writeSecureStore(key, serialized);
}

export async function removeSecureConfig(key: string): Promise<void> {
  await writeSecureStore(key, null);
}

export async function clearSecureConfigForTests(
  prefix?: string
): Promise<void> {
  const keyPrefix = prefix ? `${FALLBACK_PREFIX}${prefix}` : FALLBACK_PREFIX;
  // MMKV does not expose iteration; rely on known prefixes in tests to reset caches manually.
  if (!prefix) {
    const knownKeys = [
      'consents.v1',
      'consents.audit.v1',
      'privacy.audit.v1',
      'privacy.retention.store.v1',
      'privacy.retention.report.v1',
      'privacy-consent.v1',
    ];
    await Promise.all(knownKeys.map((k) => writeSecureStore(k, null)));
    return;
  }
  await writeSecureStore(prefix, null);
  storage.delete(keyPrefix);
}

export function resetSecureStoreAvailabilityForTests(): void {
  secureStoreAvailable = null;
}
