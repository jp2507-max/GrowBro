/**
 * Inventory Error Types
 *
 * Structured error types for inventory operations with recovery options.
 *
 * Requirements:
 * - 11.6: Specific error messages with recovery options
 * - 3.4: Three-choice insufficient stock handling
 */

/**
 * Validation error for inventory operations
 */
export interface InventoryValidationError {
  code: 'VALIDATION_ERROR';
  field: string;
  message: string;
  value: unknown;
}

/**
 * Business logic error for inventory operations
 */
export interface InventoryBusinessError {
  code: 'BUSINESS_ERROR';
  type:
    | 'INSUFFICIENT_STOCK'
    | 'BATCH_EXPIRED'
    | 'DUPLICATE_LOT'
    | 'UNIT_MISMATCH'
    | 'MISSING_ITEM'
    | 'INVALID_QUANTITY'
    | 'INVALID_COST';
  message: string;
  context: Record<string, unknown>;
  recoveryOptions: RecoveryOption[];
}

/**
 * Sync error for inventory operations
 */
export interface InventorySyncError {
  code: 'SYNC_ERROR';
  type: 'NETWORK_ERROR' | 'CONFLICT' | 'SERVER_ERROR';
  message: string;
  retryable: boolean;
  conflictData?: ConflictData;
}

/**
 * Recovery option for error handling
 */
export interface RecoveryOption {
  /** Recovery action identifier */
  action: string;

  /** User-friendly label */
  label: string;

  /** Detailed description */
  description?: string;

  /** Action-specific data */
  data?: Record<string, unknown>;

  /** Callback function for action */
  onPress?: () => void | Promise<void>;
}

/**
 * Conflict data for sync errors
 */
export interface ConflictData {
  /** Local version of the data */
  localVersion: unknown;

  /** Remote version of the data */
  remoteVersion: unknown;

  /** User-friendly conflict message */
  conflictMessage: string;

  /** Device that made the winning change */
  deviceName?: string;

  /** Timestamp of the winning change */
  timestamp?: Date;

  /** Action to reapply local change */
  reapplyAction?: () => Promise<void>;
}

/**
 * Undo information for destructive actions
 */
export interface UndoInfo {
  /** Action that can be undone */
  action: 'DELETE_BATCH' | 'ADJUST_INVENTORY' | 'DELETE_ITEM';

  /** Timestamp when action was performed */
  performedAt: Date;

  /** Expiry timestamp for undo window */
  expiresAt: Date;

  /** Data needed to undo the action */
  undoData: Record<string, unknown>;

  /** Callback to execute undo */
  onUndo: () => Promise<void>;
}

/**
 * Error result for inventory operations
 */
export interface InventoryErrorResult {
  success: false;
  error: string;
  errorType:
    | 'validation'
    | 'business_logic'
    | 'sync'
    | 'network'
    | 'permission'
    | 'unknown';
  validationErrors?: InventoryValidationError[];
  recoveryOptions?: RecoveryOption[];
  undoInfo?: UndoInfo;
}

/**
 * Success result for inventory operations
 */
export interface InventorySuccessResult<T = unknown> {
  success: true;
  data: T;
  undoInfo?: UndoInfo;
}

/**
 * Combined result type for inventory operations
 */
export type InventoryOperationResult<T = unknown> =
  | InventorySuccessResult<T>
  | InventoryErrorResult;
