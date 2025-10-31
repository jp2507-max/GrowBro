/**
 * Encryption Key Rotation Module
 *
 * Implements 90-day encryption key rotation for auth storage.
 * Ensures secure key management with automated rotation reminders.
 *
 * Security Requirements:
 * - Keys rotate every 90 days
 * - Old keys retained for 30 days for data migration
 * - Rotation warnings at 7 days before expiry
 * - Secure key backup and recovery
 *
 * @module lib/auth/key-rotation
 */

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { MMKV } from 'react-native-mmkv';

import { supabase } from '@/lib/supabase';

// Storage keys
const KEY_VERSION_STORAGE_KEY = 'auth_key_version';
const KEY_ROTATION_CHECK_KEY = 'auth_key_rotation_last_check';
const ENCRYPTION_KEY_PREFIX = 'auth_encryption_key_v';

// Rotation configuration
const ROTATION_INTERVAL_DAYS = 90;
const ROTATION_WARNING_DAYS = 7;
const CHECK_INTERVAL_HOURS = 24;

export interface KeyRotationStatus {
  needsRotation: boolean;
  currentVersion: number;
  daysUntilExpiry: number;
  expiresAt: string;
  lastChecked: string;
}

export interface KeyRotationResult {
  success: boolean;
  newVersion: number;
  oldVersion: number;
  error?: string;
}

/**
 * Check if key rotation is needed
 * Queries the database for current key status
 */
export async function checkKeyRotationStatus(): Promise<KeyRotationStatus> {
  try {
    // Check if we've checked recently (avoid excessive API calls)
    const lastCheck = await getLastRotationCheck();
    const hoursSinceCheck = lastCheck
      ? (Date.now() - lastCheck.getTime()) / (1000 * 60 * 60)
      : CHECK_INTERVAL_HOURS + 1;

    if (hoursSinceCheck < CHECK_INTERVAL_HOURS) {
      // Return cached status if checked recently
      const currentVersion = await getCurrentKeyVersion();
      return {
        needsRotation: false,
        currentVersion,
        daysUntilExpiry: ROTATION_INTERVAL_DAYS,
        expiresAt: new Date(
          Date.now() + ROTATION_INTERVAL_DAYS * 24 * 60 * 60 * 1000
        ).toISOString(),
        lastChecked: lastCheck?.toISOString() || new Date().toISOString(),
      };
    }

    // Query database for rotation status
    const { data, error } = await supabase.rpc('check_key_rotation_needed');

    if (error) {
      console.error('[key-rotation] Error checking rotation status:', error);
      throw error;
    }

    // Update last check timestamp
    await setLastRotationCheck(new Date());

    const isDataValid = Array.isArray(data) && data.length > 0;
    const status: KeyRotationStatus = {
      needsRotation: isDataValid ? data[0]?.needs_rotation || false : false,
      currentVersion: isDataValid ? data[0]?.current_version || 1 : 1,
      daysUntilExpiry: isDataValid
        ? data[0]?.days_until_expiry || ROTATION_INTERVAL_DAYS
        : ROTATION_INTERVAL_DAYS,
      expiresAt: isDataValid
        ? data[0]?.expires_at || new Date().toISOString()
        : new Date().toISOString(),
      lastChecked: new Date().toISOString(),
    };

    return status;
  } catch (error) {
    console.error('[key-rotation] Failed to check rotation status:', error);
    // Return safe defaults on error
    return {
      needsRotation: false,
      currentVersion: 1,
      daysUntilExpiry: ROTATION_INTERVAL_DAYS,
      expiresAt: new Date().toISOString(),
      lastChecked: new Date().toISOString(),
    };
  }
}

/**
 * Perform encryption key rotation
 * Creates new key, migrates data, and updates version
 */
export async function rotateEncryptionKey(): Promise<KeyRotationResult> {
  try {
    const oldVersion = await getCurrentKeyVersion();
    const newVersion = oldVersion + 1;

    console.log(
      `[key-rotation] Starting rotation from v${oldVersion} to v${newVersion}`
    );

    // Generate new encryption key
    const newKey = await generateEncryptionKey();
    const newKeyHash = await hashKey(newKey);

    // Store new key in SecureStore
    const newKeyStorageKey = `${ENCRYPTION_KEY_PREFIX}${newVersion}`;
    await SecureStore.setItemAsync(newKeyStorageKey, newKey, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED,
    });

    // Get old key for data migration
    const oldKeyStorageKey = `${ENCRYPTION_KEY_PREFIX}${oldVersion}`;
    const oldKey = await SecureStore.getItemAsync(oldKeyStorageKey);

    if (!oldKey) {
      throw new Error('Old encryption key not found for migration');
    }

    // Migrate data from old key to new key
    await migrateStorageData(oldKey, newKey, oldVersion, newVersion);

    // Update key version in database
    const { error: rotationError } = await supabase.rpc(
      'rotate_encryption_key',
      {
        p_old_version: oldVersion,
        p_new_version: newVersion,
        p_new_key_hash: newKeyHash,
        p_metadata: {
          device_platform: 'mobile',
          rotation_timestamp: new Date().toISOString(),
        },
      }
    );

    if (rotationError) {
      console.error('[key-rotation] Database rotation failed:', rotationError);
      throw rotationError;
    }

    // Update local version tracker
    await setCurrentKeyVersion(newVersion);

    // Keep old key for 30 days for emergency recovery
    // It will be cleaned up by a background job
    console.log(
      `[key-rotation] Successfully rotated to v${newVersion}. Old key retained for recovery.`
    );

    return {
      success: true,
      newVersion,
      oldVersion,
    };
  } catch (error) {
    console.error('[key-rotation] Rotation failed:', error);
    return {
      success: false,
      newVersion: 0,
      oldVersion: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Migrate storage data from old key to new key
 */
// eslint-disable-next-line max-params
async function migrateStorageData(
  oldKey: string,
  newKey: string,
  _oldVersion: number,
  _newVersion: number
): Promise<void> {
  try {
    console.log('[key-rotation] Starting data migration...');

    // Create MMKV instances with old and new keys
    const oldStorage = new MMKV({
      id: 'auth-storage',
      encryptionKey: oldKey,
    });

    const newStorage = new MMKV({
      id: 'auth-storage-temp',
      encryptionKey: newKey,
    });

    // Get all keys from old storage
    const allKeys = oldStorage.getAllKeys();
    console.log(`[key-rotation] Migrating ${allKeys.length} keys...`);

    // Migrate each key-value pair
    for (const key of allKeys) {
      const value = oldStorage.getString(key);
      if (value !== undefined) {
        newStorage.set(key, value);
      }
    }

    // Verify migration
    const migratedKeys = newStorage.getAllKeys();
    if (migratedKeys.length !== allKeys.length) {
      throw new Error(
        `Migration verification failed: ${migratedKeys.length} vs ${allKeys.length} keys`
      );
    }

    // Replace old storage with new storage
    // This is done by clearing old and copying from temp
    oldStorage.clearAll();

    const finalStorage = new MMKV({
      id: 'auth-storage',
      encryptionKey: newKey,
    });

    for (const key of migratedKeys) {
      const value = newStorage.getString(key);
      if (value !== undefined) {
        finalStorage.set(key, value);
      }
    }

    // Clean up temp storage
    newStorage.clearAll();

    console.log('[key-rotation] Data migration completed successfully');
  } catch (error) {
    console.error('[key-rotation] Data migration failed:', error);
    throw new Error('Failed to migrate storage data during key rotation');
  }
}

/**
 * Generate a new encryption key using CSPRNG
 */
async function generateEncryptionKey(): Promise<string> {
  const randomBytes = await Crypto.getRandomBytesAsync(32); // 256-bit key
  const key = Array.from(randomBytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return key;
}

/**
 * Hash encryption key for database storage (verification only)
 */
async function hashKey(key: string): Promise<string> {
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    key
  );
  return hash;
}

/**
 * Get current key version from local storage
 */
async function getCurrentKeyVersion(): Promise<number> {
  try {
    const version = await SecureStore.getItemAsync(KEY_VERSION_STORAGE_KEY);
    return version ? parseInt(version, 10) : 1;
  } catch {
    return 1;
  }
}

/**
 * Set current key version in local storage
 */
async function setCurrentKeyVersion(version: number): Promise<void> {
  await SecureStore.setItemAsync(KEY_VERSION_STORAGE_KEY, version.toString(), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
}

/**
 * Get last rotation check timestamp
 */
async function getLastRotationCheck(): Promise<Date | null> {
  try {
    const timestamp = await SecureStore.getItemAsync(KEY_ROTATION_CHECK_KEY);
    return timestamp ? new Date(timestamp) : null;
  } catch {
    return null;
  }
}

/**
 * Set last rotation check timestamp
 */
async function setLastRotationCheck(date: Date): Promise<void> {
  await SecureStore.setItemAsync(KEY_ROTATION_CHECK_KEY, date.toISOString(), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });
}

/**
 * Get encryption key for current version
 */
export async function getEncryptionKey(): Promise<string | null> {
  try {
    const version = await getCurrentKeyVersion();
    const keyStorageKey = `${ENCRYPTION_KEY_PREFIX}${version}`;
    return await SecureStore.getItemAsync(keyStorageKey);
  } catch (error) {
    console.error('[key-rotation] Failed to get encryption key:', error);
    return null;
  }
}

/**
 * Initialize encryption key on first app launch
 */
export async function initializeEncryptionKey(): Promise<string> {
  const existingKey = await getEncryptionKey();
  if (existingKey) {
    return existingKey;
  }

  console.log('[key-rotation] Initializing first encryption key...');

  const newKey = await generateEncryptionKey();
  const keyHash = await hashKey(newKey);
  const version = 1;

  // Store key in SecureStore
  const keyStorageKey = `${ENCRYPTION_KEY_PREFIX}${version}`;
  await SecureStore.setItemAsync(keyStorageKey, newKey, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
  });

  // Update version tracker
  await setCurrentKeyVersion(version);

  // Update database with key hash
  try {
    await supabase.rpc('rotate_encryption_key', {
      p_old_version: 0,
      p_new_version: version,
      p_new_key_hash: keyHash,
      p_metadata: {
        initial_setup: true,
        device_platform: 'mobile',
      },
    });
  } catch (error) {
    console.error('[key-rotation] Failed to register initial key:', error);
    // Continue anyway - key is stored locally
  }

  return newKey;
}

/**
 * Check if rotation warning should be shown
 */
export function shouldShowRotationWarning(status: KeyRotationStatus): boolean {
  return (
    status.daysUntilExpiry <= ROTATION_WARNING_DAYS &&
    status.daysUntilExpiry > 0
  );
}

/**
 * Clean up old encryption keys (30+ days old)
 */
export async function cleanupOldKeys(): Promise<void> {
  try {
    const currentVersion = await getCurrentKeyVersion();

    // Remove keys older than 2 versions
    for (let v = 1; v < currentVersion - 1; v++) {
      const oldKeyStorageKey = `${ENCRYPTION_KEY_PREFIX}${v}`;
      try {
        await SecureStore.deleteItemAsync(oldKeyStorageKey);
        console.log(`[key-rotation] Cleaned up old key v${v}`);
      } catch {
        // Key might not exist, ignore
      }
    }
  } catch (error) {
    console.error('[key-rotation] Failed to cleanup old keys:', error);
  }
}
