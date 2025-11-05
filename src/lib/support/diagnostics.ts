/**
 * Device Diagnostics Collection Utility
 * Requirements: 7.4, 7.7, 7.8, 7.9
 */

import { Env } from '@env';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

import type { BugDiagnostics } from '@/types/settings';

/**
 * Get device model name
 */
function getDeviceModel(): string {
  return Constants.deviceName || Platform.OS;
}

/**
 * Collect device diagnostics for bug reports and support requests
 * Requirements: 7.4, 7.7, 7.8
 */
export async function collectDiagnostics(): Promise<BugDiagnostics> {
  const freeStorage = await getFreeStorage();

  return {
    appVersion: Env.VERSION || 'unknown',
    buildNumber: Env.VERSION || 'unknown',
    deviceModel: getDeviceModel(),
    osVersion: `${Platform.OS} ${Platform.Version}`,
    locale: 'en', // Will be populated from i18n if needed
    freeStorage,
    lastSyncTime: undefined, // Will be populated from sync service if available
    networkStatus: 'online', // Will be determined by network hook
  };
}

/**
 * Get available storage in MB
 */
async function getFreeStorage(): Promise<number> {
  try {
    const freeDiskStorage = await FileSystem.getFreeDiskStorageAsync();
    return Math.round(freeDiskStorage / (1024 * 1024)); // Convert to MB
  } catch (error) {
    console.error('Failed to get free storage:', error);
    return 0;
  }
}

/**
 * Format diagnostics for email body
 * Requirements: 7.3, 7.7
 */
export function formatDiagnosticsForEmail(
  diagnostics: BugDiagnostics,
  userId?: string
): string {
  const lines = [
    '\n\n--- Device Information ---',
    `App Version: ${diagnostics.appVersion}`,
    `Build Number: ${diagnostics.buildNumber}`,
    `Device: ${diagnostics.deviceModel}`,
    `OS: ${diagnostics.osVersion}`,
    `Locale: ${diagnostics.locale}`,
    `Free Storage: ${diagnostics.freeStorage} MB`,
    `Network: ${diagnostics.networkStatus}`,
  ];

  if (diagnostics.lastSyncTime) {
    lines.push(`Last Sync: ${diagnostics.lastSyncTime}`);
  }

  if (userId) {
    // Hash the user ID for privacy
    const hashedUserId = hashUserId(userId);
    lines.push(`User ID (hashed): ${hashedUserId}`);
  }

  return lines.join('\n');
}

/**
 * Hash user ID using non-reversible algorithm
 * Requirements: 7.7, 7.13
 */
function hashUserId(userId: string): string {
  // Simple hash for privacy - in production, use a proper hashing library
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Redact sensitive data from diagnostics
 * Requirements: 7.9, 7.13
 */
export function redactSecrets(text: string): string {
  // Redact common secret patterns
  const patterns = [
    // API keys and tokens
    /[a-zA-Z0-9_-]{32,}/g,
    // Email addresses (partial redaction)
    /([a-zA-Z0-9._-]+)@([a-zA-Z0-9._-]+\.[a-zA-Z]{2,})/g,
    // URLs with tokens or keys in query params
    /([?&])(token|key|secret|password|auth)=([^&\s]+)/gi,
  ];

  let redacted = text;
  for (const pattern of patterns) {
    redacted = redacted.replace(pattern, '[REDACTED]');
  }

  return redacted;
}

/**
 * Format diagnostics for bug report submission
 * Requirements: 7.4, 7.8
 */
export function prepareDiagnosticsForSubmission(
  diagnostics: BugDiagnostics,
  includeFullDiagnostics: boolean
): Partial<BugDiagnostics> {
  if (!includeFullDiagnostics) {
    // Return minimal diagnostics
    return {
      appVersion: diagnostics.appVersion,
      buildNumber: diagnostics.buildNumber,
      osVersion: diagnostics.osVersion,
    };
  }

  // Return full diagnostics
  return diagnostics;
}
