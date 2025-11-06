/**
 * Encryption key management using platform-native secure storage
 * Implements functional module pattern for key generation, storage, and rotation
 * Uses expo-secure-store (iOS Keychain / Android Keystore)
 */

import { Buffer } from 'buffer';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import {
  ENCRYPTION_KEY_LENGTH,
  KEY_METADATA_KEY,
  STORAGE_DOMAINS,
} from './constants';
import type { KeyManager, KeyMetadata } from './types';

// Simple logger using console
const log = {
  debug: (msg: string, ...args: any[]) =>
    console.log(`[KeyManager] ${msg}`, ...args),
  info: (msg: string, ...args: any[]) =>
    console.info(`[KeyManager] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) =>
    console.warn(`[KeyManager] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) =>
    console.error(`[KeyManager] ${msg}`, ...args),
};

// ==================== SecureStore Configuration ====================

/**
 * SecureStore options for encryption keys
 * iOS: Uses Keychain with AfterFirstUnlock accessibility
 * Android: Uses EncryptedSharedPreferences with AES256_GCM
 */
const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  // iOS: Keychain accessibility - data available after device first unlock
  // Android: This option is ignored, always uses hardware-backed when available
};

/**
 * SecureStore options for metadata (always accessible)
 */
const METADATA_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.ALWAYS_THIS_DEVICE_ONLY,
};

// ==================== Key Generation ====================

/**
 * Generate a cryptographically secure 32-byte encryption key
 * Uses platform CSPRNG (Crypto.getRandomBytes)
 *
 * @returns Promise<string> - Base64-encoded 32-byte key
 */
async function generateKey(): Promise<string> {
  try {
    // Generate 32 random bytes using platform CSPRNG
    const randomBytes = await Crypto.getRandomBytesAsync(ENCRYPTION_KEY_LENGTH);

    // Convert to base64 for storage
    const key = Buffer.from(randomBytes).toString('base64');

    log.debug('Generated 32-byte encryption key');

    return key;
  } catch (error) {
    log.error('Failed to generate encryption key', error);
    throw new Error('Key generation failed');
  }
}

// ==================== Key Storage ====================

/**
 * Store encryption key in platform secure storage
 * iOS: Keychain, Android: EncryptedSharedPreferences/Keystore
 *
 * @param keyId - Unique identifier for the key (e.g., domain name)
 * @param key - Base64-encoded encryption key
 */
async function storeKey(keyId: string, key: string): Promise<void> {
  try {
    // Store key in secure storage
    await SecureStore.setItemAsync(keyId, key, SECURE_STORE_OPTIONS);

    // Check if hardware-backed storage is being used
    const isHardwareBacked = await checkHardwareBackedStorage();

    if (!isHardwareBacked && Platform.OS === 'ios') {
      log.warn(
        'iOS: Hardware-backed keychain not available, using software fallback'
      );
    }

    if (!isHardwareBacked && Platform.OS === 'android') {
      log.warn(
        'Android: Hardware-backed keystore not available, TEE unavailable'
      );
    }

    // Store key metadata
    const metadata: KeyMetadata = {
      createdAt: Date.now(),
      rotationCount: 0,
      isHardwareBacked,
    };

    await storeKeyMetadata(keyId, metadata);

    log.info(`Stored encryption key for domain: ${keyId}`, {
      isHardwareBacked,
    });
  } catch (error) {
    log.error(`Failed to store key for ${keyId}`, error);
    throw new Error('Key storage failed');
  }
}

/**
 * Retrieve encryption key from platform secure storage
 *
 * @param keyId - Unique identifier for the key
 * @returns Promise<string | null> - Base64-encoded key or null if not found
 */
async function retrieveKey(keyId: string): Promise<string | null> {
  try {
    const key = await SecureStore.getItemAsync(keyId, SECURE_STORE_OPTIONS);

    if (!key) {
      log.debug(`No key found for domain: ${keyId}`);
      return null;
    }

    return key;
  } catch (error) {
    log.error(`Failed to retrieve key for ${keyId}`, error);
    return null;
  }
}

/**
 * Delete encryption key from platform secure storage
 *
 * @param keyId - Unique identifier for the key
 */
async function deleteKey(keyId: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(keyId, SECURE_STORE_OPTIONS);

    // Also delete metadata
    const metadataKey = `${KEY_METADATA_KEY}:${keyId}`;
    await SecureStore.deleteItemAsync(metadataKey, METADATA_STORE_OPTIONS);

    log.info(`Deleted encryption key for domain: ${keyId}`);
  } catch (error) {
    log.error(`Failed to delete key for ${keyId}`, error);
    throw new Error('Key deletion failed');
  }
}

// ==================== Key Rotation ====================

/**
 * Rotate encryption key (generate new key and update metadata)
 * Note: Caller must handle recrypt of existing data
 *
 * @param keyId - Unique identifier for the key
 * @returns Promise<string> - New base64-encoded key
 */
async function rotateKey(keyId: string): Promise<string> {
  try {
    // Get existing metadata
    const existingMetadata = await getKeyMetadata(keyId);

    // Generate new key
    const newKey = await generateKey();

    // Store new key
    await storeKey(keyId, newKey);

    // Update metadata with rotation count
    const metadata: KeyMetadata = {
      createdAt: existingMetadata?.createdAt ?? Date.now(),
      rotationCount: (existingMetadata?.rotationCount ?? 0) + 1,
      isHardwareBacked: existingMetadata?.isHardwareBacked ?? false,
      lastRotationAt: Date.now(),
    };

    await storeKeyMetadata(keyId, metadata);

    log.info(`Rotated encryption key for domain: ${keyId}`, {
      rotationCount: metadata.rotationCount,
    });

    // Note: Never log key material

    return newKey;
  } catch (error) {
    log.error(`Failed to rotate key for ${keyId}`, error);
    throw new Error('Key rotation failed');
  }
}

// ==================== Key Metadata Management ====================

/**
 * Store key metadata (creation time, rotation count, hardware-backed status)
 * Stored separately from the key itself for audit purposes
 */
async function storeKeyMetadata(
  keyId: string,
  metadata: KeyMetadata
): Promise<void> {
  try {
    const metadataKey = `${KEY_METADATA_KEY}:${keyId}`;
    const metadataJson = JSON.stringify(metadata);

    // Store metadata in secure storage
    await SecureStore.setItemAsync(
      metadataKey,
      metadataJson,
      METADATA_STORE_OPTIONS
    );
  } catch (error) {
    log.error(`Failed to store metadata for ${keyId}`, error);
    // Non-critical error, don't throw
  }
}

/**
 * Retrieve key metadata
 *
 * @param keyId - Unique identifier for the key
 * @returns Promise<KeyMetadata | null>
 */
async function getKeyMetadata(keyId: string): Promise<KeyMetadata | null> {
  try {
    const metadataKey = `${KEY_METADATA_KEY}:${keyId}`;

    const metadataJson = await SecureStore.getItemAsync(
      metadataKey,
      METADATA_STORE_OPTIONS
    );

    if (!metadataJson) {
      return null;
    }

    return JSON.parse(metadataJson) as KeyMetadata;
  } catch (error) {
    log.error(`Failed to retrieve metadata for ${keyId}`, error);
    return null;
  }
}

// ==================== Hardware-Backed Detection ====================

/**
 * Check if hardware-backed storage is available
 * Note: expo-secure-store automatically uses hardware-backed storage when available
 * This is a best-effort check based on platform capabilities
 *
 * @returns Promise<boolean> - True if likely using hardware-backed storage
 */
async function checkHardwareBackedStorage(): Promise<boolean> {
  try {
    // expo-secure-store automatically uses:
    // - iOS: Keychain (hardware-backed on devices with Secure Enclave)
    // - Android: EncryptedSharedPreferences backed by Android Keystore (hardware-backed when TEE available)

    // For iOS: Secure Enclave is available on iPhone 5s and later
    // For Android: Hardware-backed keystore is available on most modern devices

    // We assume hardware-backed storage unless device is very old
    // This is a conservative estimate since expo-secure-store handles this automatically
    if (Platform.OS === 'ios') {
      // iOS Keychain with Secure Enclave on modern devices
      return true; // Secure Enclave available on iPhone 5s+ (2013)
    }

    if (Platform.OS === 'android') {
      // Android Keystore with hardware backing on Android 6.0+
      if (Platform.Version && typeof Platform.Version === 'number') {
        return Platform.Version >= 23; // Android 6.0 Marshmallow
      }
      return true; // Assume modern device
    }

    return false; // Web or unknown platform
  } catch (error) {
    log.error('Failed to check hardware-backed storage', error);
    return false;
  }
} // ==================== Exported Key Manager Interface ====================

/**
 * Key manager for encryption key lifecycle management
 * Implements functional module pattern (no classes)
 */
export const keyManager: KeyManager = {
  generateKey,
  storeKey,
  retrieveKey,
  rotateKey,
  deleteKey,
  getKeyMetadata,
};

// ==================== Key Initialization Helpers ====================

/**
 * Get or create encryption key for a storage domain
 * If key doesn't exist, generates and stores a new one
 *
 * @param domain - Storage domain (e.g., 'auth', 'user-data')
 * @returns Promise<string> - Base64-encoded encryption key
 */
export async function getOrCreateKey(domain: string): Promise<string> {
  const keyId = `mmkv.${domain}`;

  // Try to retrieve existing key
  let key = await keyManager.retrieveKey(keyId);

  if (!key) {
    log.info(`No existing key found for ${domain}, generating new key`);

    // Generate and store new key
    key = await keyManager.generateKey();
    await keyManager.storeKey(keyId, key);
  }

  return key;
}

/**
 * Initialize encryption keys for all storage domains
 * Should be called during app security initialization
 *
 * @returns Promise<Record<string, string>> - Map of domain to encryption key
 */
export async function initializeEncryptionKeys(): Promise<
  Record<string, string>
> {
  const domains = Object.values(STORAGE_DOMAINS);
  const keys: Record<string, string> = {};

  for (const domain of domains) {
    keys[domain] = await getOrCreateKey(domain);
  }

  log.info('Initialized encryption keys for all domains', {
    domains: Object.keys(keys),
  });

  return keys;
}

/**
 * Rekey all storage domains (on suspected compromise)
 * Generates new keys but does NOT recrypt data
 * Caller must handle recrypt for each MMKV instance
 *
 * @returns Promise<Record<string, string>> - Map of domain to new encryption key
 */
export async function rekeyAllDomains(): Promise<Record<string, string>> {
  const domains = Object.values(STORAGE_DOMAINS);
  const newKeys: Record<string, string> = {};

  log.warn('Rekeying all storage domains due to suspected compromise');

  for (const domain of domains) {
    const keyId = `mmkv.${domain}`;
    newKeys[domain] = await keyManager.rotateKey(keyId);
  }

  return newKeys;
}

/**
 * Get key age in days for audit purposes
 *
 * @param domain - Storage domain
 * @returns Promise<number | null> - Key age in days, or null if metadata unavailable
 */
export async function getKeyAge(domain: string): Promise<number | null> {
  const keyId = `mmkv.${domain}`;
  const metadata = await keyManager.getKeyMetadata(keyId);

  if (!metadata) {
    return null;
  }

  const ageMs = Date.now() - metadata.createdAt;
  return Math.floor(ageMs / (24 * 60 * 60 * 1000));
}
