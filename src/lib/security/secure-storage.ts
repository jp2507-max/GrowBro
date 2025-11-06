/**
 * Encrypted storage wrapper around MMKV with platform-native encryption
 * Provides five separate MMKV instances for different security domains
 */

import { MMKV } from 'react-native-mmkv';

import {
  ENCRYPTION_SENTINEL_KEY,
  ENCRYPTION_SENTINEL_VALUE,
  STORAGE_DOMAINS,
} from './constants';
import { getOrCreateKey } from './key-manager';
import type { SecureStorage } from './types';

// Simple logger using console
const log = {
  debug: (msg: string, ...args: any[]) =>
    console.log(`[SecureStorage] ${msg}`, ...args),
  info: (msg: string, ...args: any[]) =>
    console.info(`[SecureStorage] ${msg}`, ...args),
  warn: (msg: string, ...args: any[]) =>
    console.warn(`[SecureStorage] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) =>
    console.error(`[SecureStorage] ${msg}`, ...args),
};

// ==================== MMKV Instance Management ====================

/**
 * Map of domain to MMKV instance
 */
const instances: Map<string, MMKV> = new Map();

/**
 * Flag to track initialization status
 */
let isInitialized = false;

/**
 * Flag to pause writes during recrypt
 */
let isPaused = false;

// ==================== Instance Creation ====================

/**
 * Create or get MMKV instance for a specific domain
 *
 * @param domain - Storage domain (e.g., 'auth', 'user-data')
 * @param encryptionKey - Base64-encoded encryption key
 * @returns MMKV instance
 */
function createInstance(domain: string, encryptionKey: string): MMKV {
  const existingInstance = instances.get(domain);

  if (existingInstance) {
    return existingInstance;
  }

  log.debug(`Creating MMKV instance for domain: ${domain}`);

  const instance = new MMKV({
    id: domain,
    encryptionKey,
  });

  instances.set(domain, instance);

  // Write sentinel to verify encryption
  instance.set(ENCRYPTION_SENTINEL_KEY, ENCRYPTION_SENTINEL_VALUE);

  return instance;
}

/**
 * Get existing MMKV instance for a domain
 *
 * @param domain - Storage domain
 * @returns MMKV instance or undefined if not initialized
 */
function getInstance(domain: string): MMKV | undefined {
  return instances.get(domain);
}

// ==================== Initialization ====================

/**
 * Initialize all MMKV instances with encryption keys
 * Must be called before any storage operations
 *
 * @throws Error if initialization fails
 */
export async function initializeSecureStorage(): Promise<void> {
  if (isInitialized) {
    log.debug('Secure storage already initialized');
    return;
  }

  try {
    log.info('Initializing secure storage with encryption');

    const domains = Object.values(STORAGE_DOMAINS);

    for (const domain of domains) {
      const encryptionKey = await getOrCreateKey(domain);
      createInstance(domain, encryptionKey);
    }

    isInitialized = true;

    log.info('Secure storage initialized successfully', {
      domains: Array.from(instances.keys()),
    });
  } catch (error) {
    log.error('Failed to initialize secure storage', error);
    throw new Error('Secure storage initialization failed');
  }
}

/**
 * Check if secure storage is initialized
 */
export function isSecureStorageInitialized(): boolean {
  return isInitialized;
}

/**
 * Assert that secure storage is initialized
 * @throws Error if not initialized
 */
function assertInitialized(): void {
  if (!isInitialized) {
    throw new Error(
      'Secure storage not initialized. Call initializeSecureStorage() first.'
    );
  }
}

/**
 * Assert that writes are not paused
 * @throws Error if paused
 */
function assertNotPaused(): void {
  if (isPaused) {
    throw new Error('Storage writes are paused during recrypt operation');
  }
}

// ==================== Domain-Specific Storage Accessors ====================

/**
 * Create storage accessor for a specific domain
 *
 * @param domain - Storage domain
 * @returns SecureStorage interface for the domain
 */
// eslint-disable-next-line max-lines-per-function -- Interface implementation requires all methods
function createStorageAccessor(domain: string): SecureStorage {
  return {
    set(key: string, value: string | number | boolean): void {
      assertInitialized();
      assertNotPaused();

      const instance = getInstance(domain);

      if (!instance) {
        throw new Error(`No MMKV instance found for domain: ${domain}`);
      }

      instance.set(key, value);
    },

    get(key: string): string | number | boolean | undefined {
      assertInitialized();

      const instance = getInstance(domain);

      if (!instance) {
        throw new Error(`No MMKV instance found for domain: ${domain}`);
      }

      return (
        instance.getString(key) ??
        instance.getNumber(key) ??
        instance.getBoolean(key)
      );
    },

    delete(key: string): void {
      assertInitialized();
      assertNotPaused();

      const instance = getInstance(domain);

      if (!instance) {
        throw new Error(`No MMKV instance found for domain: ${domain}`);
      }

      instance.delete(key);
    },

    clearAll(): void {
      assertInitialized();
      assertNotPaused();

      const instance = getInstance(domain);

      if (!instance) {
        throw new Error(`No MMKV instance found for domain: ${domain}`);
      }

      instance.clearAll();

      // Restore sentinel after clear
      instance.set(ENCRYPTION_SENTINEL_KEY, ENCRYPTION_SENTINEL_VALUE);
    },

    getAllKeys(): string[] {
      assertInitialized();

      const instance = getInstance(domain);

      if (!instance) {
        throw new Error(`No MMKV instance found for domain: ${domain}`);
      }

      return instance.getAllKeys();
    },

    async recrypt(newKey: string): Promise<void> {
      assertInitialized();

      const instance = getInstance(domain);

      if (!instance) {
        throw new Error(`No MMKV instance found for domain: ${domain}`);
      }

      log.info(`Starting recrypt for domain: ${domain}`);

      // Pause writes
      isPaused = true;

      try {
        // Perform recrypt (MMKV handles this natively)
        instance.recrypt(newKey);

        // Verify sentinel key
        const sentinelValue = instance.getString(ENCRYPTION_SENTINEL_KEY);

        if (sentinelValue !== ENCRYPTION_SENTINEL_VALUE) {
          throw new Error('Recrypt verification failed: sentinel mismatch');
        }

        log.info(`Recrypt completed successfully for domain: ${domain}`);
      } finally {
        // Resume writes
        isPaused = false;
      }
    },
  };
}

// ==================== Exported Storage Instances ====================

/**
 * Storage for authentication tokens and session data
 */
export const authStorage: SecureStorage = createStorageAccessor(
  STORAGE_DOMAINS.AUTH
);

/**
 * Storage for user preferences and settings
 */
export const userDataStorage: SecureStorage = createStorageAccessor(
  STORAGE_DOMAINS.USER_DATA
);

/**
 * Storage for sync state and timestamps
 */
export const syncMetadataStorage: SecureStorage = createStorageAccessor(
  STORAGE_DOMAINS.SYNC_METADATA
);

/**
 * Storage for security-related cache (integrity status, pin config)
 */
export const securityCacheStorage: SecureStorage = createStorageAccessor(
  STORAGE_DOMAINS.SECURITY_CACHE
);

/**
 * Storage for feature flag overrides
 */
export const featureFlagsStorage: SecureStorage = createStorageAccessor(
  STORAGE_DOMAINS.FEATURE_FLAGS
);

// ==================== Recrypt All Domains ====================

/**
 * Recrypt all storage domains with new keys
 * Used when device compromise is suspected
 *
 * @param newKeys - Map of domain to new encryption key
 */
export async function recryptAllDomains(
  newKeys: Record<string, string>
): Promise<void> {
  assertInitialized();

  log.warn('Rekeying all storage domains');

  const domains = Object.values(STORAGE_DOMAINS);

  for (const domain of domains) {
    const newKey = newKeys[domain];

    if (!newKey) {
      throw new Error(`No new key provided for domain: ${domain}`);
    }

    const storage = getStorageForDomain(domain);
    await storage.recrypt(newKey);
  }

  log.info('All domains rekeyed successfully');
}

/**
 * Get storage accessor for a specific domain
 *
 * @param domain - Storage domain
 * @returns SecureStorage interface
 */
function getStorageForDomain(domain: string): SecureStorage {
  switch (domain) {
    case STORAGE_DOMAINS.AUTH:
      return authStorage;
    case STORAGE_DOMAINS.USER_DATA:
      return userDataStorage;
    case STORAGE_DOMAINS.SYNC_METADATA:
      return syncMetadataStorage;
    case STORAGE_DOMAINS.SECURITY_CACHE:
      return securityCacheStorage;
    case STORAGE_DOMAINS.FEATURE_FLAGS:
      return featureFlagsStorage;
    default:
      throw new Error(`Unknown storage domain: ${domain}`);
  }
}

// ==================== Direct Instance Access (for auditing) ====================

/**
 * Get all MMKV instances (for auditing purposes)
 * Do not use for normal storage operations
 *
 * @returns Map of domain to MMKV instance
 */
export function getAllInstances(): Map<string, MMKV> {
  return instances;
}

/**
 * Get list of initialized domains
 *
 * @returns Array of domain names
 */
export function getInitializedDomains(): string[] {
  return Array.from(instances.keys());
}

// ==================== Rekey on Compromise ====================

/**
 * Rekey all domains due to suspected compromise
 * This generates new keys and recrypts all data
 *
 * Should be called at next cold start after compromise detection
 */
export async function rekeyOnCompromise(): Promise<void> {
  try {
    log.warn('Initiating rekey procedure due to suspected compromise');

    // Import rekeyAllDomains from key-manager
    const { rekeyAllDomains: generateNewKeys } = await import('./key-manager');

    // Generate new keys for all domains
    const newKeys = await generateNewKeys(recryptAllDomains);

    // Recrypt all domains with new keys
    await recryptAllDomains(newKeys);

    log.info('Rekey procedure completed successfully');
  } catch (error) {
    log.error('Rekey procedure failed', error);
    throw new Error('Failed to rekey storage on compromise');
  }
}
