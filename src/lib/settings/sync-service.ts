/**
 * Settings Sync Service
 * Unified queue-and-sync for profile, notifications, and legal acceptances
 *
 * Requirements: 2.6, 2.8, 9.6, 9.7
 */

import { storage } from '@/lib/storage';
import { supabase } from '@/lib/supabase';
import { isOnline } from '@/lib/sync/network-manager';

import {
  type BatchSyncResult,
  DEFAULT_RETRY_CONFIG,
  type RetryConfig,
  type SettingsOperation,
  type SettingsSyncItem,
  SYNC_PRIORITY,
  type SyncQueueStats,
  type SyncResult,
} from './types';

const QUEUE_KEY = 'settings.sync.queue';
const STATS_KEY = 'settings.sync.stats';
const MAX_BATCH_SIZE = 10;

let syncQueue: SettingsSyncItem[] = [];
let isProcessing = false;

/**
 * Calculate next retry attempt time using exponential backoff
 *
 * Exponential Backoff Algorithm:
 * - Formula: delay = min(2^attemptCount * baseDelayMs, maxDelayMs)
 * - Example sequence with baseDelayMs=1000, maxDelayMs=30000:
 *   - Attempt 0: 1s (2^0 * 1000ms = 1000ms)
 *   - Attempt 1: 2s (2^1 * 1000ms = 2000ms)
 *   - Attempt 2: 4s (2^2 * 1000ms = 4000ms)
 *   - Attempt 3: 8s (2^3 * 1000ms = 8000ms)
 *   - Attempt 4: 16s (2^4 * 1000ms = 16000ms)
 *   - Attempt 5+: 30s (capped at maxDelayMs)
 *
 * This prevents thundering herd problem by spacing out retries exponentially,
 * giving the backend time to recover from transient issues.
 *
 * @param attemptCount - Number of previous attempts (0-based)
 * @param config - Retry configuration with baseDelayMs and maxDelayMs
 * @returns Timestamp (ms since epoch) when next retry should be attempted
 */
export function calculateNextAttempt(
  attemptCount: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  // Calculate exponential delay with cap to prevent excessive wait times
  const delay = Math.min(
    Math.pow(2, attemptCount) * config.baseDelayMs,
    config.maxDelayMs
  );
  return Date.now() + delay;
}

/**
 * Load sync queue from storage
 */
async function loadQueue(): Promise<SettingsSyncItem[]> {
  const stored = storage.getString(QUEUE_KEY);
  if (!stored) return [];

  try {
    return JSON.parse(stored) as SettingsSyncItem[];
  } catch {
    return [];
  }
}

/**
 * Save sync queue to storage
 */
async function saveQueue(queue: SettingsSyncItem[]): Promise<void> {
  storage.set(QUEUE_KEY, JSON.stringify(queue));
}

/**
 * Initialize sync queue from storage
 */
export async function initSyncQueue(): Promise<void> {
  syncQueue = await loadQueue();
}

/**
 * Enqueue a settings change for sync
 */
export async function enqueueSync(
  operation: SettingsOperation,
  data: Record<string, unknown>,
  userId: string
): Promise<string> {
  const item: SettingsSyncItem = {
    id: `${operation}-${userId}-${Date.now()}`,
    operation,
    data,
    userId,
    timestamp: Date.now(),
    attempts: 0,
    status: 'pending',
  };

  syncQueue.push(item);
  await saveQueue(syncQueue);

  // Try to process immediately if online
  if (await isOnline()) {
    void processQueue();
  }

  return item.id;
}

/**
 * Get items eligible for retry based on exponential backoff
 *
 * Retry Eligibility Rules:
 * 1. **Pending items**: Always eligible (first attempt or manually retried)
 * 2. **Error items**: Eligible only if:
 *    a. Haven't exceeded maxAttempts (default: 5)
 *    b. Backoff period has elapsed (nextAttemptAt < now)
 * 3. **Syncing/Synced items**: Never eligible (already processing or done)
 *
 * This prevents:
 * - Retrying items that have permanently failed (exceeded max attempts)
 * - Hammering the backend during transient failures (backoff period)
 * - Re-syncing items that are already in progress or succeeded
 *
 * @param config - Retry configuration with maxAttempts
 * @returns Array of sync items ready for retry
 */
export function getRetryEligible(
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): SettingsSyncItem[] {
  const now = Date.now();

  return syncQueue.filter((item) => {
    // Pending items are always eligible (first attempt or manual retry reset)
    if (item.status === 'pending') return true;

    // Error items must pass two checks before retry
    if (item.status === 'error') {
      // Permanent failure: max attempts exceeded (give up)
      if (item.attempts >= config.maxAttempts) return false;

      // Temporary backoff: wait period not yet elapsed (try later)
      if (item.nextAttemptAt && item.nextAttemptAt > now) return false;

      // Passed both checks: eligible for retry
      return true;
    }

    // Syncing/Synced items are not eligible
    return false;
  });
}

/**
 * Sort items by priority (legal > profile > notifications) and timestamp
 *
 * Priority Sorting for Conflict Resolution:
 * - Legal acceptances: Priority 3 (highest) - critical for compliance
 * - Profile changes: Priority 2 (medium) - user-visible identity
 * - Notification prefs: Priority 1 (lowest) - convenience settings
 *
 * Within same priority, older items sync first (FIFO by timestamp).
 *
 * This ensures:
 * - Compliance data syncs before user preferences
 * - Profile changes propagate before notification settings
 * - User intent preserved through chronological ordering
 *
 * Example queue:
 * 1. Legal acceptance @ t=100 (priority=3) - syncs first
 * 2. Profile change @ t=200 (priority=2) - syncs second
 * 3. Profile change @ t=300 (priority=2) - syncs third (older first)
 * 4. Notification pref @ t=150 (priority=1) - syncs last despite earlier timestamp
 *
 * @param items - Unsorted sync items
 * @returns Items sorted by priority DESC, then timestamp ASC
 */
function sortByPriority(items: SettingsSyncItem[]): SettingsSyncItem[] {
  return items.sort((a, b) => {
    // Primary sort: priority (higher priority first)
    const priorityDiff =
      SYNC_PRIORITY[b.operation] - SYNC_PRIORITY[a.operation];
    if (priorityDiff !== 0) return priorityDiff;

    // Secondary sort: timestamp (older first, FIFO)
    return a.timestamp - b.timestamp;
  });
}

/**
 * Sync a single item to Supabase
 */
async function syncItem(item: SettingsSyncItem): Promise<SyncResult> {
  try {
    let error = null;

    switch (item.operation) {
      case 'profile': {
        const { error: profileError } = await supabase.from('profiles').upsert({
          user_id: item.userId,
          ...item.data,
          updated_at: new Date().toISOString(),
        });
        error = profileError;
        break;
      }

      case 'notifications': {
        const { error: notifError } = await supabase
          .from('notification_preferences')
          .upsert({
            user_id: item.userId,
            ...item.data,
            last_updated: new Date().toISOString(),
          });
        error = notifError;
        break;
      }

      case 'legal': {
        const { error: legalError } = await supabase
          .from('legal_acceptances')
          .insert({
            user_id: item.userId,
            ...item.data,
            accepted_at: new Date().toISOString(),
          });
        error = legalError;
        break;
      }
    }

    if (error) {
      throw new Error(error.message);
    }

    return {
      success: true,
      itemId: item.id,
    };
  } catch (error) {
    return {
      success: false,
      itemId: item.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Process sync queue with batch processing
 */
export async function processQueue(): Promise<BatchSyncResult> {
  // Re-entry guard
  if (isProcessing) {
    return {
      processed: 0,
      succeeded: 0,
      failed: 0,
      results: [],
    };
  }

  // Check network connectivity
  if (!(await isOnline())) {
    return {
      processed: 0,
      succeeded: 0,
      failed: 0,
      results: [],
    };
  }

  isProcessing = true;

  try {
    // Get eligible items
    const eligible = getRetryEligible();
    if (eligible.length === 0) {
      return {
        processed: 0,
        succeeded: 0,
        failed: 0,
        results: [],
      };
    }

    // Sort by priority and take batch
    const sorted = sortByPriority(eligible);
    const batch = sorted.slice(0, MAX_BATCH_SIZE);

    // Mark items as syncing
    batch.forEach((item) => {
      item.status = 'syncing';
    });
    await saveQueue(syncQueue);

    // Process each item
    const results: SyncResult[] = [];
    let succeeded = 0;
    let failed = 0;

    for (const item of batch) {
      const result = await syncItem(item);
      results.push(result);

      if (result.success) {
        // Mark as synced and remove from queue
        syncQueue = syncQueue.filter((i) => i.id !== item.id);
        succeeded++;
      } else {
        // Increment attempts and calculate next retry
        const queueItem = syncQueue.find((i) => i.id === item.id);
        if (queueItem) {
          queueItem.attempts++;
          queueItem.status = 'error';
          queueItem.lastError = result.error;
          queueItem.nextAttemptAt = calculateNextAttempt(queueItem.attempts);
        }
        failed++;
      }
    }

    await saveQueue(syncQueue);

    // Update stats
    await updateStats({
      lastSyncAt: Date.now(),
      lastError: failed > 0 ? `${failed} items failed to sync` : null,
    });

    return {
      processed: batch.length,
      succeeded,
      failed,
      results,
    };
  } finally {
    isProcessing = false;
  }
}

/**
 * Get sync queue statistics
 */
export async function getSyncStats(): Promise<SyncQueueStats> {
  const queue = await loadQueue();

  const stats: SyncQueueStats = {
    pending: 0,
    syncing: 0,
    synced: 0,
    error: 0,
    lastSyncAt: null,
    lastError: null,
  };

  queue.forEach((item) => {
    switch (item.status) {
      case 'pending':
        stats.pending++;
        break;
      case 'syncing':
        stats.syncing++;
        break;
      case 'synced':
        stats.synced++;
        break;
      case 'error':
        stats.error++;
        break;
    }
  });

  // Load additional stats from storage
  const stored = storage.getString(STATS_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Partial<SyncQueueStats>;
      stats.lastSyncAt = parsed.lastSyncAt ?? null;
      stats.lastError = parsed.lastError ?? null;
    } catch {
      // Ignore parse errors
    }
  }

  return stats;
}

/**
 * Update sync statistics in storage
 */
async function updateStats(
  update: Partial<Pick<SyncQueueStats, 'lastSyncAt' | 'lastError'>>
): Promise<void> {
  const current = await getSyncStats();
  const next = {
    ...current,
    ...update,
  };
  storage.set(STATS_KEY, JSON.stringify(next));
}

/**
 * Manually retry failed items
 * Resets attempt counter for items that have exceeded max attempts
 */
export async function retryFailed(): Promise<void> {
  syncQueue.forEach((item) => {
    if (item.status === 'error') {
      item.status = 'pending';
      item.attempts = 0;
      item.nextAttemptAt = undefined;
      item.lastError = undefined;
    }
  });

  await saveQueue(syncQueue);
  await processQueue();
}

/**
 * Clear all synced items from queue (for testing/cleanup)
 */
export async function clearSyncedItems(): Promise<void> {
  syncQueue = syncQueue.filter((item) => item.status !== 'synced');
  await saveQueue(syncQueue);
}

/**
 * Get count of items with permanent errors (exceeded max attempts)
 */
export function getPermanentErrorCount(
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  return syncQueue.filter(
    (item) => item.status === 'error' && item.attempts >= config.maxAttempts
  ).length;
}
