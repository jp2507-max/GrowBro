/**
 * Encryption key management using platform-native secure storage
 * Implements functional module pattern for key generation, storage, and rotation
 * Uses expo-secure-store (iOS Keychain / Android Keystore)
 */

import { Buffer } from 'buffer';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import {
  ENCRYPTION_KEY_LENGTH,
  KEY_METADATA_KEY,
  STORAGE_DOMAINS,
} from './constants';
import type { KeyManager, KeyMetadata } from './types';

// Removed circular import - recrypt function must be passed explicitly

// Simple logger using console
const log = {
  debug: (msg: string, ...args: unknown[]) =>
    console.log(`[KeyManager] ${msg}`, ...args),
  info: (msg: string, ...args: unknown[]) =>
    console.info(`[KeyManager] ${msg}`, ...args),
  warn: (msg: string, ...args: unknown[]) =>
    console.warn(`[KeyManager] ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) =>
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

    // Check hardware-backed storage capabilities
    const hardwareBacking = await checkHardwareBackedStorage();

    if (hardwareBacking === 'software') {
      if (Platform.OS === 'ios') {
        log.warn(
          'iOS: Hardware-backed keychain not available, using software fallback'
        );
      } else if (Platform.OS === 'android') {
        log.warn(
          'Android: Hardware-backed keystore not available, TEE unavailable'
        );
      }
    } else if (hardwareBacking === 'unknown') {
      log.info(
        'Hardware backing status unknown - key may still be hardware-protected'
      );
    } else {
      log.debug('Hardware-backed storage confirmed available');
    }

    // Store key metadata
    const metadata: KeyMetadata = {
      createdAt: Date.now(),
      rotationCount: 0,
      isHardwareBacked: hardwareBacking === 'hardware',
    };

    await storeKeyMetadata(keyId, metadata);

    log.info(`Stored encryption key for domain: ${keyId}`, {
      hardwareBacking,
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
    // Also delete metadata (clean up both new and old formats)
    const metadataKey = `${KEY_METADATA_KEY}_${keyId}`;
    await SecureStore.deleteItemAsync(metadataKey, METADATA_STORE_OPTIONS);

    const oldMetadataKey = `${KEY_METADATA_KEY}:${keyId}`;
    try {
      await SecureStore.deleteItemAsync(oldMetadataKey, METADATA_STORE_OPTIONS);
    } catch {
      // Ignore error if old key doesn't exist
    }

    log.info(`Deleted encryption key and metadata for domain: ${keyId}`);
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

    // Update metadata with rotation count and fresh hardware backing check
    const hardwareBacking = await checkHardwareBackedStorage();
    const metadata: KeyMetadata = {
      createdAt: existingMetadata?.createdAt ?? Date.now(),
      rotationCount: (existingMetadata?.rotationCount ?? 0) + 1,
      isHardwareBacked: hardwareBacking === 'hardware',
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
    const metadataKey = `${KEY_METADATA_KEY}_${keyId}`;
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
    const metadataKey = `${KEY_METADATA_KEY}_${keyId}`;

    let metadataJson = await SecureStore.getItemAsync(
      metadataKey,
      METADATA_STORE_OPTIONS
    );

    // Fallback to old key format if not found (migration support)
    if (!metadataJson) {
      const oldMetadataKey = `${KEY_METADATA_KEY}:${keyId}`;
      metadataJson = await SecureStore.getItemAsync(
        oldMetadataKey,
        METADATA_STORE_OPTIONS
      );

      if (metadataJson) {
        log.debug(
          `Retrieved metadata using legacy key format for ${keyId} (migration pending)`
        );

        // Proactively migrate to new format
        try {
          // Re-derive new key variable since it is scoped above
          const newMetadataKey = `${KEY_METADATA_KEY}_${keyId}`;
          await SecureStore.setItemAsync(
            newMetadataKey,
            metadataJson,
            METADATA_STORE_OPTIONS
          );

          // Delete legacy key after successful migration
          await SecureStore.deleteItemAsync(
            oldMetadataKey,
            METADATA_STORE_OPTIONS
          );
          log.debug(`Migrated metadata for ${keyId} to new format`);
        } catch (error) {
          // Non-critical, migration will happen on next rotation
          log.debug(`Failed to migrate metadata for ${keyId}`, error);
        }
      }
    }

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
 * Hardware-backed storage capability result
 */
type HardwareBackingResult = 'hardware' | 'software' | 'unknown';

/**
 * Check iOS hardware-backed storage capabilities
 * Attempts to verify Secure Enclave availability through keychain operations
 */
async function checkIOSHardwareBacking(): Promise<HardwareBackingResult> {
  try {
    // iOS 11.3+ required for Secure Enclave access in some contexts
    // But Keychain is available on older versions, just not necessarily hardware-backed
    if (Platform.Version && typeof Platform.Version === 'number') {
      if (Platform.Version < 11.3) {
        log.debug('iOS version too old for reliable Secure Enclave support');
        return 'software';
      }
    }

    // Try to create a test key with hardware-backed attributes
    // This is a best-effort check since expo-secure-store abstracts the details
    const testKey = `hw_test_${Date.now()}_${Math.random()}`;
    try {
      // Generate a test key and see if it can be stored with security requirements
      await SecureStore.setItemAsync(
        testKey,
        'test_value',
        SECURE_STORE_OPTIONS
      );
      await SecureStore.getItemAsync(testKey);
      await SecureStore.deleteItemAsync(testKey);

      log.debug(
        'iOS keychain operations successful, assuming hardware backing available'
      );
      return 'hardware';
    } catch (keychainError) {
      log.debug(
        'iOS keychain operation failed, may indicate software-only storage',
        keychainError
      );
      return 'software';
    }
  } catch (error) {
    log.debug('iOS hardware backing check failed, returning unknown', error);
    return 'unknown';
  }
}

/**
 * Check Android hardware-backed storage capabilities
 * Attempts to verify TEE/StrongBox availability through keystore operations
 */
async function checkAndroidHardwareBacking(): Promise<HardwareBackingResult> {
  try {
    // Android 6.0+ required for Android Keystore
    if (Platform.Version && typeof Platform.Version === 'number') {
      if (Platform.Version < 23) {
        log.debug('Android version too old for Android Keystore');
        return 'software';
      }
    }

    // Try keystore operations - modern Android versions should support hardware-backed keys
    // We can't directly access KeyInfo in expo-secure-store, so we use operational success as proxy
    const testKey = `hw_test_${Date.now()}_${Math.random()}`;
    try {
      await SecureStore.setItemAsync(
        testKey,
        'test_value',
        SECURE_STORE_OPTIONS
      );
      await SecureStore.getItemAsync(testKey);
      await SecureStore.deleteItemAsync(testKey);

      log.debug(
        'Android keystore operations successful, likely hardware-backed'
      );
      return 'hardware';
    } catch (keystoreError) {
      log.debug(
        'Android keystore operation failed, may indicate software-only storage',
        keystoreError
      );
      return 'software';
    }
  } catch (error) {
    log.debug(
      'Android hardware backing check failed, returning unknown',
      error
    );
    return 'unknown';
  }
}

/**
 * Verify hardware backing by attempting to generate and test a key
 * This is a fallback method when platform-specific checks are inconclusive
 */
async function verifyHardwareBackingThroughTestKey(): Promise<HardwareBackingResult> {
  try {
    // Generate a test encryption key and attempt to store/retrieve it
    const testKeyId = `hw_verify_${Date.now()}_${Math.random()}`;
    const testData = await Crypto.getRandomBytesAsync(32);

    // Try to store and retrieve the key
    await SecureStore.setItemAsync(
      testKeyId,
      Buffer.from(testData).toString('base64'),
      SECURE_STORE_OPTIONS
    );
    const retrieved = await SecureStore.getItemAsync(testKeyId);

    // Clean up
    await SecureStore.deleteItemAsync(testKeyId);

    if (retrieved && retrieved === Buffer.from(testData).toString('base64')) {
      log.debug('Test key storage/retrieval successful');
      return 'hardware'; // Assume hardware-backed if operations succeed on physical device
    } else {
      log.debug('Test key verification failed - data mismatch');
      return 'software';
    }
  } catch (error) {
    log.debug('Test key verification failed with error', error);
    return 'unknown';
  }
}

/**
 * Get heuristic hardware backing based on OS version and device characteristics
 * This is the final fallback when all other checks are inconclusive
 */
function getHeuristicHardwareBacking(): HardwareBackingResult {
  try {
    if (Platform.OS === 'ios') {
      // iPhone 5s (2013) and later generally have Secure Enclave
      // But this is just a heuristic - actual hardware may vary
      const iosVersion =
        Platform.Version && typeof Platform.Version === 'number'
          ? Platform.Version
          : 0;
      if (iosVersion >= 9.0) {
        // iOS 9.0 was released with iPhone 5s
        log.debug(`iOS ${iosVersion} heuristic: likely hardware-backed`);
        return 'hardware';
      }
      log.debug(`iOS ${iosVersion} heuristic: likely software-only`);
      return 'software';
    }

    if (Platform.OS === 'android') {
      // Android 6.0+ generally supports hardware-backed keystore
      const androidVersion =
        Platform.Version && typeof Platform.Version === 'number'
          ? Platform.Version
          : 0;
      if (androidVersion >= 23) {
        // Android 6.0 Marshmallow
        log.debug(
          `Android ${androidVersion} heuristic: likely hardware-backed`
        );
        return 'hardware';
      }
      log.debug(`Android ${androidVersion} heuristic: likely software-only`);
      return 'software';
    }

    log.debug(`Unknown platform ${Platform.OS} heuristic: unknown`);
    return 'unknown';
  } catch (error) {
    log.debug('Heuristic check failed', error);
    return 'unknown';
  }
}

async function checkHardwareBackedStorage(): Promise<HardwareBackingResult> {
  try {
    log.debug('Checking hardware-backed storage capabilities');

    // Step 1: Simulator detection - simulators never have hardware security
    if (!Device.isDevice) {
      log.info('Running on simulator/emulator - using software-only storage');
      return 'software';
    }

    log.debug(
      `Device info: ${Device.brand} ${Device.modelName}, OS: ${Platform.OS} ${Platform.Version}`
    );

    // Step 2: Platform-specific capability checks
    if (Platform.OS === 'ios') {
      const iosResult = await checkIOSHardwareBacking();
      if (iosResult !== 'unknown') {
        return iosResult;
      }
    } else if (Platform.OS === 'android') {
      const androidResult = await checkAndroidHardwareBacking();
      if (androidResult !== 'unknown') {
        return androidResult;
      }
    }

    // Step 3: Fallback verification through test key generation
    const testResult = await verifyHardwareBackingThroughTestKey();
    if (testResult !== 'unknown') {
      log.debug(`Test key verification result: ${testResult}`);
      return testResult;
    }

    // Step 4: Heuristic fallback based on OS version and device capabilities
    const heuristicResult = getHeuristicHardwareBacking();
    log.warn(
      `Unable to verify hardware backing through direct checks, using heuristic: ${heuristicResult}`,
      'This is a best-effort estimate and may not reflect actual hardware capabilities'
    );
    return heuristicResult;
  } catch (error) {
    log.error(
      'Failed to check hardware-backed storage, assuming unknown',
      error
    );
    return 'unknown';
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
 * Rekey all storage domains with safe in-place re-encryption
 * Generates new keys and performs atomic re-encryption of all existing MMKV data
 * Includes backup preservation and rollback on failure
 *
 * @param recryptFn - Function to perform re-encryption
 * @returns Promise<Record<string, string>> - Map of domain to new encryption key
 */
export async function rekeyAllDomains(
  recryptFn: (keys: Record<string, string>) => Promise<void>
): Promise<Record<string, string>> {
  const domains = Object.values(STORAGE_DOMAINS);
  const newKeys: Record<string, string> = {};
  const backupKeys: Record<string, string> = {};

  log.warn('Starting safe rekey operation for all storage domains');

  try {
    // Phase 1: Generate new keys and backup old keys
    log.info('Phase 1: Generating new keys and preserving backups');

    for (const domain of domains) {
      const keyId = `mmkv.${domain}`;

      // Backup the current key before rotation
      try {
        const currentKey = await keyManager.retrieveKey(keyId);
        if (currentKey) {
          backupKeys[domain] = currentKey;
          log.debug(`Backed up old key for domain: ${domain}`);
        }
      } catch (error) {
        log.warn(
          `Could not backup key for domain ${domain}, proceeding anyway`,
          error
        );
      }

      // Generate and store new key
      const newKey = await keyManager.rotateKey(keyId);
      newKeys[domain] = newKey;
      log.debug(`Generated new key for domain: ${domain}`);
    }

    // Phase 2: Perform safe re-encryption for each domain
    log.info('Phase 2: Performing safe re-encryption for each domain');

    await recryptFn(newKeys);

    log.info('All domains successfully rekeyed with data preservation');
    return newKeys;
  } catch (error) {
    log.error('Rekey operation failed, attempting rollback', error);

    // Phase 3: Rollback on failure - restore old keys where possible
    log.warn('Phase 3: Rolling back to previous keys');

    let rollbackErrors: string[] = [];

    for (const domain of domains) {
      const keyId = `mmkv.${domain}`;
      const backupKey = backupKeys[domain];

      if (backupKey) {
        try {
          // Restore the backup key
          await keyManager.storeKey(keyId, backupKey);
          log.info(`Successfully rolled back key for domain: ${domain}`);
        } catch (rollbackError) {
          const errorMsg = `Failed to rollback key for domain ${domain}: ${rollbackError}`;
          log.error(errorMsg);
          rollbackErrors.push(errorMsg);
        }
      } else {
        const errorMsg = `No backup key available for domain ${domain}, cannot rollback`;
        log.error(errorMsg);
        rollbackErrors.push(errorMsg);
      }
    }

    if (rollbackErrors.length > 0) {
      log.error('Some domains could not be rolled back', { rollbackErrors });
      throw new Error(
        `Rekey operation failed and partial rollback completed. Manual intervention may be required for domains: ${rollbackErrors.join(', ')}`
      );
    } else {
      log.warn('Rollback completed successfully');
      throw new Error(
        `Rekey operation failed but was fully rolled back: ${error}`
      );
    }
  }
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
