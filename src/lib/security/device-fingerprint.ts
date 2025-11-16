/**
 * Privacy-safe device fingerprint utility
 * Requirements: 4.1, 5.10
 *
 * Generates a privacy-safe device fingerprint using a stable random install ID
 * and salted hashing. This fingerprint is used for security telemetry and
 * device identification without exposing hardware IDs or PII.
 *
 * Design principles:
 * - Stable across app restarts (stored in encrypted storage)
 * - Unique per installation (regenerated on fresh install)
 * - Non-reversible (salted hash)
 * - Privacy-preserving (no hardware IDs or PII)
 * - Deterministic (same install ID always produces same hash)
 */

import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import { DEVICE_FINGERPRINT_SALT } from './constants';
import {
  initializeSecureStorage,
  securityCacheStorage,
} from './secure-storage';
import type { DeviceFingerprint, DeviceFingerprintGenerator } from './types';

// Module-scoped promise cache to prevent race conditions
let fingerprintPromise: Promise<DeviceFingerprint> | null = null;

// Temporary storage for fingerprint (will be replaced with encrypted storage)
let cachedFingerprint: DeviceFingerprint | null = null;

type PlatformWithTablet = typeof Platform & {
  isPad?: boolean;
  isTV?: boolean;
};

/**
 * Get device category for non-PII context
 * Returns generic device type without identifying information
 */
export function getDeviceCategory(): string {
  const os = Platform.OS;
  const platformExt = Platform as PlatformWithTablet;
  const isTablet = platformExt.isPad || platformExt.isTV;

  if (os === 'ios') {
    return isTablet ? 'ios-tablet' : 'ios-phone';
  }

  if (os === 'android') {
    return isTablet ? 'android-tablet' : 'android-phone';
  }

  return 'unknown';
}

/**
 * Generate a stable random install ID
 * This ID is unique per installation and persists across app restarts
 */
async function generateInstallId(): Promise<string> {
  const INSTALL_ID_KEY = 'security:device:install-id';

  // Check in-memory cache first
  if (cachedFingerprint?.installId) {
    return cachedFingerprint.installId;
  }

  // Ensure secure storage is initialized
  try {
    await initializeSecureStorage();
  } catch (error) {
    console.warn(
      '[DeviceFingerprint] Failed to initialize secure storage:',
      error
    );
    // Continue anyway - storage might still work
  }

  try {
    // Try to retrieve existing install ID from encrypted storage
    const storedInstallId = securityCacheStorage.get(INSTALL_ID_KEY);
    if (storedInstallId && typeof storedInstallId === 'string') {
      return storedInstallId;
    }
  } catch (error) {
    console.warn(
      '[DeviceFingerprint] Failed to read install ID from storage:',
      error
    );
    // Continue to generate a new one if storage read fails
  }

  // Generate a new UUID v4 for this installation
  const newInstallId = Crypto.randomUUID();

  try {
    // Store the new install ID in encrypted storage
    securityCacheStorage.set(INSTALL_ID_KEY, newInstallId);
  } catch (error) {
    console.error(
      '[DeviceFingerprint] Failed to persist install ID to storage:',
      error
    );
    // Continue anyway - the ID will work for this session
    // This is "fail closed" - we don't want to break the app if storage fails
  }

  return newInstallId;
}

/**
 * Generate a salted hash from the install ID
 * Uses SHA-256 with app-specific salt for non-reversible hashing
 */
async function hashInstallId(installId: string): Promise<string> {
  // Combine install ID with app-specific salt
  const saltedValue = `${installId}:${DEVICE_FINGERPRINT_SALT}`;

  // Generate SHA-256 hash
  return await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    saltedValue
  );
}

/**
 * Generate a complete device fingerprint
 * Implements the DeviceFingerprintGenerator interface
 */
export const deviceFingerprintGenerator: DeviceFingerprintGenerator = {
  async generate(): Promise<DeviceFingerprint> {
    // If there's already a promise in progress, await it
    if (fingerprintPromise) {
      return fingerprintPromise;
    }

    // Check if we have a cached fingerprint
    if (cachedFingerprint) {
      return cachedFingerprint;
    }

    // Create a promise that generates the fingerprint
    fingerprintPromise = (async (): Promise<DeviceFingerprint> => {
      try {
        // Generate install ID
        const installId = await generateInstallId();

        // Hash the install ID
        const hashedId = await hashInstallId(installId);

        // Get device category
        const deviceCategory = getDeviceCategory();

        // Create fingerprint
        const fingerprint: DeviceFingerprint = {
          installId,
          hashedId,
          deviceCategory,
          createdAt: Date.now(),
        };

        // Cache the fingerprint
        cachedFingerprint = fingerprint;

        return fingerprint;
      } catch (error) {
        // Clear the promise on failure so future calls can retry
        fingerprintPromise = null;
        throw error;
      }
    })();

    try {
      const result = await fingerprintPromise;
      // Clear the promise after successful resolution
      fingerprintPromise = null;
      return result;
    } catch (error) {
      // Clear the promise on failure
      fingerprintPromise = null;
      throw error;
    }
  },

  async getInstallId(): Promise<string> {
    const fingerprint = await this.generate();
    return fingerprint.installId;
  },

  async getHashedId(): Promise<string> {
    const fingerprint = await this.generate();
    return fingerprint.hashedId;
  },

  getDeviceCategory(): string {
    return getDeviceCategory();
  },
};

/**
 * Get or generate device fingerprint
 * This is the main public API for obtaining the device fingerprint
 */
export async function getDeviceFingerprint(): Promise<DeviceFingerprint> {
  return deviceFingerprintGenerator.generate();
}

/**
 * Get the hashed device ID for security telemetry
 * Returns only the non-reversible hash (not the install ID)
 */
export async function getHashedDeviceId(): Promise<string> {
  return deviceFingerprintGenerator.getHashedId();
}

/**
 * Synchronously get device category
 * Can be used without async/await for immediate operations
 */
export function getDeviceCategorySync(): string {
  return getDeviceCategory();
}

/**
 * Clear cached fingerprint (for testing purposes only)
 * @internal
 */
export function __clearFingerprintCache(): void {
  cachedFingerprint = null;
  fingerprintPromise = null;
}
