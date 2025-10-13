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
  winner: 'local' | 'remote' | 'needs-review';
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

/**
 * Valid table names from WatermelonDB schema
 */
export const TABLE_NAMES = {
  SERIES: 'series',
  OCCURRENCE_OVERRIDES: 'occurrence_overrides',
  TASKS: 'tasks',
  NOTIFICATION_QUEUE: 'notification_queue',
  NOTIFICATIONS: 'notifications',
  NOTIFICATION_PREFERENCES: 'notification_preferences',
  DEVICE_TOKENS: 'device_tokens',
  IMAGE_UPLOAD_QUEUE: 'image_upload_queue',
  FAVORITES: 'favorites',
  CACHED_STRAINS: 'cached_strains',
  PLAYBOOKS: 'playbooks',
  PLAYBOOK_APPLICATIONS: 'playbook_applications',
  UNDO_DESCRIPTORS: 'undo_descriptors',
  OUTBOX_NOTIFICATION_ACTIONS: 'outbox_notification_actions',
  AI_SUGGESTIONS: 'ai_suggestions',
  TRICHOME_ASSESSMENTS: 'trichome_assessments',
  ADJUSTMENT_SUGGESTIONS: 'adjustment_suggestions',
  ADJUSTMENT_COOLDOWNS: 'adjustment_cooldowns',
  PLANT_ADJUSTMENT_PREFERENCES: 'plant_adjustment_preferences',
  HARVESTS: 'harvests',
  INVENTORY: 'inventory',
  HARVEST_AUDITS: 'harvest_audits',
  FEEDING_TEMPLATES: 'feeding_templates',
  PH_EC_READINGS_V2: 'ph_ec_readings_v2',
  RESERVOIRS_V2: 'reservoirs_v2',
  SOURCE_WATER_PROFILES_V2: 'source_water_profiles_v2',
  CALIBRATIONS: 'calibrations',
  DEVIATION_ALERTS_V2: 'deviation_alerts_v2',
  RESERVOIR_EVENTS: 'reservoir_events',
} as const;

export type TableName = (typeof TABLE_NAMES)[keyof typeof TABLE_NAMES];

/**
 * @deprecated Legacy conflict type for backward compatibility.
 * New code should use the conflict resolution API from conflict-resolver.ts
 */
export type LegacyConflict = {
  tableName: TableName;
  recordId: string;
  conflictFields: string[];
  localRecord?: Record<string, any>;
  remoteRecord?: Record<string, any>;
};
