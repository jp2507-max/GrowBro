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

/**
 * Gets or creates a stable device identifier
 * @returns A stable UUID for this device installation
 */
export async function getDeviceId(): Promise<string> {
  // Check if we already have a device ID
  const existing = storage.getString(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }

  // Generate a new UUID v4
  const deviceId = Crypto.randomUUID();

  // Persist it
  storage.set(DEVICE_ID_KEY, deviceId);

  return deviceId;
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

  // Return a temporary ID that will be replaced on next async call
  return 'temp-' + Date.now();
}
