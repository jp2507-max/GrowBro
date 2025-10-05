import { NoopAnalytics } from '@/lib/analytics';

/**
 * Centralized sync analytics tracking
 * Tracks all sync-related metrics as specified in requirements 6.7
 */

export type SyncStage = 'push' | 'pull' | 'apply' | 'total';

export type SyncErrorCode =
  | 'network'
  | 'timeout'
  | 'conflict'
  | 'schema_mismatch'
  | 'permission'
  | 'unknown';

/**
 * Track sync latency in milliseconds
 */
export async function trackSyncLatency(
  stage: SyncStage,
  durationMs: number
): Promise<void> {
  try {
    await NoopAnalytics.track('sync_latency_ms', {
      ms: Math.round(durationMs),
    });
  } catch (error) {
    // Analytics failures should not break sync
    console.warn('Failed to track sync latency:', error);
  }
}

/**
 * Track sync failure rate with error codes
 */
export async function trackSyncFailure(
  _stage: SyncStage,
  _errorCode: SyncErrorCode,
  _errorMessage?: string
): Promise<void> {
  try {
    await NoopAnalytics.track('sync_fail_rate', {
      rate: 1,
    });
  } catch (error) {
    console.warn('Failed to track sync failure:', error);
  }
}

/**
 * Track successful sync completion
 */
export async function trackSyncSuccess(params: {
  pushed: number;
  applied: number;
  durationMs: number;
}): Promise<void> {
  try {
    await NoopAnalytics.track('sync_success', {
      duration_ms: Math.round(params.durationMs),
    });
  } catch (error) {
    console.warn('Failed to track sync success:', error);
  }
}

/**
 * Track conflict detection and resolution
 */
export async function trackConflict(params: {
  tableName: string;
  conflictFields: string[];
  resolution?: 'keep-local' | 'accept-server' | 'dismissed';
}): Promise<void> {
  try {
    await NoopAnalytics.track('sync_conflict', {
      table: params.tableName as 'tasks' | 'series' | 'occurrence_overrides',
      count: params.conflictFields.length,
    });
  } catch (error) {
    console.warn('Failed to track conflict:', error);
  }
}

/**
 * Track pending changes queue size
 */
export async function trackPendingChanges(count: number): Promise<void> {
  try {
    await NoopAnalytics.track('sync_pending_changes', {
      count,
    });
  } catch (error) {
    console.warn('Failed to track pending changes:', error);
  }
}

/**
 * Track sync retry attempts
 */
export async function trackSyncRetry(params: {
  attempt: number;
  maxAttempts: number;
  backoffMs: number;
}): Promise<void> {
  try {
    await NoopAnalytics.track('sync_retry', {
      attempt: params.attempt,
    });
  } catch (error) {
    console.warn('Failed to track sync retry:', error);
  }
}

/**
 * Track checkpoint age (time since last successful sync)
 */
export async function trackCheckpointAge(ageMs: number): Promise<void> {
  try {
    await NoopAnalytics.track('sync_checkpoint_age_ms', {
      ms: Math.round(ageMs),
    });
  } catch (error) {
    console.warn('Failed to track checkpoint age:', error);
  }
}

/**
 * Track payload sizes for monitoring bandwidth usage
 */
export async function trackPayloadSize(params: {
  direction: 'push' | 'pull';
  sizeBytes: number;
}): Promise<void> {
  try {
    await NoopAnalytics.track('sync_payload_size', {
      bytes: params.sizeBytes,
    });
  } catch (error) {
    console.warn('Failed to track payload size:', error);
  }
}
