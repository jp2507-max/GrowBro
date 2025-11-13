/**
 * Harvest Workflow Type Definitions
 *
 * Defines types for post-harvest tracking through stages:
 * harvest → drying → curing → inventory
 *
 * Requirements: 11.1 (integer grams), 11.3 (validation)
 */

/**
 * ISO 8601 date string as stored in database
 */
export type ISODateString = string;

/**
 * Harvest stage finite state machine
 * Allowed transitions: HARVEST → DRYING → CURING → INVENTORY (forward only)
 */
export const HarvestStages = {
  HARVEST: 'harvest',
  DRYING: 'drying',
  CURING: 'curing',
  INVENTORY: 'inventory',
} as const;

export type HarvestStage = (typeof HarvestStages)[keyof typeof HarvestStages];

/**
 * Photo object for harvest documentation
 */
export interface HarvestPhotoObject {
  variant: string;
  localUri: string;
  remotePath?: string;
}

/**
 * Harvest record tracking post-harvest workflow
 * Synchronized between Supabase and WatermelonDB
 */
export interface Harvest {
  id: string;
  plant_id: string;
  user_id: string;
  stage: HarvestStage;

  /** Weight in integer grams (Requirement 11.1) */
  wet_weight_g: number | null;

  /** Weight in integer grams (Requirement 11.1) */
  dry_weight_g: number | null;

  /** Weight in integer grams (Requirement 11.1) */
  trimmings_weight_g: number | null;

  notes: string;

  /** Server-authoritative UTC timestamp (ISO 8601) */
  stage_started_at: Date;

  /** Server-authoritative UTC timestamp (ISO 8601) */
  stage_completed_at: Date | null;

  /** Photo objects for harvest documentation */
  photos: HarvestPhotoObject[];

  /** Server-authoritative UTC timestamp (ISO 8601) */
  created_at: Date;

  /** Server-authoritative UTC timestamp (ISO 8601) */
  updated_at: Date;

  /** Soft delete timestamp */
  deleted_at: Date | null;

  /** Sync: server revision number for conflict resolution */
  server_revision?: number;

  /** Sync: server timestamp in milliseconds for LWW */
  server_updated_at_ms?: number;

  /** Sync: flag indicating conflict detected during sync */
  conflict_seen: boolean;
}

/**
 * Inventory record created when curing stage completes
 * One inventory record per harvest (UNIQUE constraint)
 */
export interface Inventory {
  id: string;
  plant_id: string;
  harvest_id: string;
  user_id: string;

  /** Final dry weight in integer grams (Requirement 11.1, 11.3) */
  final_weight_g: number;

  /** ISO-8601 date string when harvest was completed (as stored in DB) */
  harvest_date: ISODateString;

  /** Total duration from harvest start to inventory creation (days) */
  total_duration_days: number;

  /** Server-authoritative UTC timestamp (ISO 8601) */
  created_at: Date;

  /** Server-authoritative UTC timestamp (ISO 8601) */
  updated_at: Date;

  /** Soft delete timestamp */
  deleted_at: Date | null;

  /** Sync: server revision number for conflict resolution */
  server_revision?: number;

  /** Sync: server timestamp in milliseconds for LWW */
  server_updated_at_ms?: number;
}

/**
 * Stage configuration with timing guidance
 */
export interface StageConfig {
  stage: HarvestStage;
  name: string;
  description: string;
  target_duration_days: number;
  min_duration_days: number;
  max_duration_days: number;
  required_fields: string[];
  optional_fields: string[];
  canAdvance: boolean;
}

/**
 * Weight validation error messages
 */
export interface WeightValidationError {
  field: 'wet_weight_g' | 'dry_weight_g' | 'trimmings_weight_g';
  message: string;
}

/**
 * Chart data point for weight tracking
 */
export interface ChartDataPoint {
  date: Date;
  weight_g: number;
  stage: HarvestStage;
  plant_id?: string;
}

/**
 * Time range filter for charts
 */
export type TimeRange = '7d' | '30d' | '90d' | '365d' | 'all';

/**
 * Photo metadata for harvest documentation
 */
export interface HarvestPhoto {
  /** File URI on device */
  uri: string;

  /** Content-addressable filename (hash + extension) */
  filename: string;

  /** Captured timestamp */
  captured_at: Date;

  /** Associated harvest stage */
  stage: HarvestStage;

  /** File size in bytes */
  size_bytes?: number;

  /** Image dimensions */
  width?: number;
  height?: number;
}

/**
 * API request for completing curing and creating inventory atomically
 */
export interface CompleteCuringRequest {
  harvest_id: string;
  final_weight_g: number;
  notes?: string;

  /** UUID for idempotent operations (Requirement 10.3) */
  idempotency_key: string;
}

/**
 * API response from atomic inventory creation
 */
export interface CompleteCuringResponse {
  harvest_id: string;
  inventory_id: string;

  /** Server-authoritative timestamp in milliseconds */
  server_timestamp_ms: number;
}

/**
 * Audit action types for harvest workflow state changes
 */
export const HarvestAuditActions = {
  STAGE_ADVANCE: 'stage_advance',
  STAGE_UNDO: 'stage_undo',
  STAGE_REVERT: 'stage_revert',
  STAGE_OVERRIDE_SKIP: 'stage_override_skip',
  SYNC_REJECTED: 'sync_rejected',
} as const;

export type HarvestAuditAction =
  (typeof HarvestAuditActions)[keyof typeof HarvestAuditActions];

/**
 * Audit entry status
 */
export const HarvestAuditStatuses = {
  PERMITTED: 'permitted',
  BLOCKED: 'blocked',
} as const;

export type HarvestAuditStatus =
  (typeof HarvestAuditStatuses)[keyof typeof HarvestAuditStatuses];

/**
 * Audit entry for harvest workflow state changes
 * Requirements: 9.2, 9.7
 */
export interface HarvestAuditEntry {
  id: string;
  harvest_id: string;
  user_id: string | null;

  /** Action type (advance, undo, revert, override_skip) */
  action: HarvestAuditAction;

  /** Whether action was permitted or blocked */
  status: HarvestAuditStatus;

  /** Stage before action */
  from_stage: HarvestStage | null;

  /** Stage after action (null if blocked) */
  to_stage: HarvestStage | null;

  /** User-provided reason (mandatory for override/revert) */
  reason: string | null;

  /** Server-authoritative UTC timestamp (ISO 8601) */
  performed_at: Date;

  /** Additional metadata (JSON) */
  metadata: Record<string, unknown>;

  created_at: Date;
}

/**
 * Stage transition request
 */
export interface StageTransitionRequest {
  harvest_id: string;
  to_stage: HarvestStage;
  notes?: string;
}

/**
 * Stage undo request (within 15-second window)
 */
export interface StageUndoRequest {
  harvest_id: string;

  /** Server timestamp when stage was completed (for validation) */
  stage_completed_at: Date;
}

/**
 * Stage revert request (after 15-second window)
 */
export interface StageRevertRequest {
  harvest_id: string;
  to_stage: HarvestStage;

  /** Mandatory reason for revert */
  reason: string;
}

/**
 * Override & skip request
 */
export interface OverrideSkipRequest {
  harvest_id: string;
  to_stage: HarvestStage;

  /** Mandatory reason for override */
  reason: string;
}

/**
 * Stage transition result
 */
export interface StageTransitionResult {
  success: boolean;
  harvest: Harvest | null;
  audit_entry_id: string | null;
  error?: string;
  can_undo?: boolean;
  undo_expires_at?: Date;
}
