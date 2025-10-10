/**
 * Sync Worker Types
 * Type definitions for WatermelonDB sync integration with retry logic and offline support
 */

/**
 * Server timestamp response for sync pull operations
 */
export type SyncPullResponse = {
  serverTimestamp: number; // ms epoch - authoritative checkpoint for next pull
  changes: {
    [table: string]: {
      id: string;
      server_revision?: number; // Monotonic revision from server (preferred)
      server_updated_at_ms?: number; // Server timestamp fallback
      _status?: 'created' | 'updated' | 'deleted';
      _changed?: string; // ISO timestamp from WatermelonDB
      [key: string]: any;
    }[];
  };
};

/**
 * Push payload sent to server
 */
export type SyncPushPayload = {
  changes: {
    [table: string]: {
      id: string;
      _status?: 'created' | 'updated' | 'deleted';
      _changed?: string;
      [key: string]: any;
    }[];
  };
  lastPulledAt: number; // From server's previous serverTimestamp
};

/**
 * Sync event callbacks
 */
export type SyncEventCallbacks = {
  onSyncStart?: () => void;
  onSyncSuccess?: () => void;
  onSyncError?: (error: Error) => void;
};

/**
 * Sync configuration
 */
export type SyncConfig = {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  enableLogging: boolean;
};

/**
 * Sync state
 */
export const SYNC_STATES = {
  IDLE: 'idle',
  SYNCING: 'syncing',
  ERROR: 'error',
  OFFLINE: 'offline',
} as const;

export type SyncState = (typeof SYNC_STATES)[keyof typeof SYNC_STATES];

/**
 * Sync status with metadata
 */
export type SyncStatus = {
  state: SyncState;
  lastSyncAt?: number;
  lastError?: string;
  pendingChanges: number;
  retryAttempt: number;
};

/**
 * Conflict resolution result
 */
export type ConflictResolution = {
  winner: 'local' | 'remote';
  localRevision?: number;
  remoteRevision?: number;
  localTimestamp?: number;
  remoteTimestamp?: number;
  reason: string;
};

/**
 * Deduplication key for readings
 */
export type DeduplicationKey = {
  plantId?: string;
  meterId?: string;
  measuredAtMs: number; // Bucketed to seconds
};

/**
 * Queue item for offline operations
 */
export type QueueItem = {
  id: string;
  table: string;
  operation: 'create' | 'update' | 'delete';
  payload: Record<string, any>;
  timestamp: number;
  retries: number;
  idempotencyKey?: string;
};
