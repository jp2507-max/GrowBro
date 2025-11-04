/**
 * Device ID utility for notification preferences sync
 * Requirements: 4.7, 4.11
 *
 * Generates and persists a stable device identifier for multi-device sync.
 * This is NOT a fingerprinting mechanism - it's only used for conflict resolution
 * in notification preferences across multiple devices for the same user.
 */

import * as Crypto from 'expo-crypto';

import { storage } from '@/lib/storage';

const DEVICE_ID_KEY = 'device_id';

// Module-scoped promise cache to prevent race conditions
let deviceIdPromise: Promise<string> | null = null;

/**
 * Gets or creates a stable device identifier
 * @returns A stable UUID for this device installation
 */
export async function getDeviceId(): Promise<string> {
  // If there's already a promise in progress, await it
  if (deviceIdPromise) {
    return deviceIdPromise;
  }

  // Check if we already have a device ID (after potential race)
  const existing = storage.getString(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }

  // Create a promise that generates and persists the UUID
  deviceIdPromise = (async (): Promise<string> => {
    try {
      // Double-check storage in case another context set it while we were creating the promise
      const doubleCheck = storage.getString(DEVICE_ID_KEY);
      if (doubleCheck) {
        return doubleCheck;
      }

      // Generate a new UUID v4
      const deviceId = Crypto.randomUUID();

      // Persist it
      storage.set(DEVICE_ID_KEY, deviceId);

      return deviceId;
    } catch (error) {
      // Clear the promise on failure so future calls can retry
      deviceIdPromise = null;
      throw error;
    }
  })();

  try {
    const result = await deviceIdPromise;
    // Clear the promise after successful resolution
    deviceIdPromise = null;
    return result;
  } catch (error) {
    // Clear the promise on failure
    deviceIdPromise = null;
    throw error;
  }
}

/**
 * Synchronously get device ID if it exists, otherwise returns a temporary ID
 * Used for immediate operations where async is not possible
 * @returns Device ID or a temporary placeholder
 */
export function getDeviceIdSync(): string {
  const existing = storage.getString(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }

  // Trigger async generation in background to avoid data consistency issues
  getDeviceId().catch(() => {
    // Silently fail - temp ID will be used if generation fails
  });

  // Return a temporary ID with better uniqueness to prevent collisions
  return 'temp-' + Crypto.randomUUID();
}
