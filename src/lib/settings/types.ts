/**
 * Types for settings sync service
 * Supports offline-first settings management with queue-and-sync pattern
 */

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'error';

export type SettingsOperation = 'profile' | 'notifications' | 'legal';

export interface SettingsSyncItem {
  id: string;
  operation: SettingsOperation;
  data: Record<string, unknown>;
  userId: string;
  timestamp: number;
  attempts: number;
  status: SyncStatus;
  lastError?: string;
  nextAttemptAt?: number;
}

export interface SyncQueueStats {
  pending: number;
  syncing: number;
  synced: number;
  error: number;
  lastSyncAt: number | null;
  lastError: string | null;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

export interface SyncResult {
  success: boolean;
  itemId: string;
  error?: string;
}

export interface BatchSyncResult {
  processed: number;
  succeeded: number;
  failed: number;
  results: SyncResult[];
}

/**
 * Priority order for sync operations
 * Higher priority items are synced first
 */
export const SYNC_PRIORITY: Record<SettingsOperation, number> = {
  legal: 3,
  profile: 2,
  notifications: 1,
};
