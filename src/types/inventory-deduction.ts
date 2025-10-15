/**
 * Inventory Deduction Type Definitions
 *
 * Types for automatic inventory deduction system triggered on task completion.
 * Supports FEFO picking, FIFO costing, and three-choice error recovery.
 *
 * Requirements:
 * - 3.1: Task-triggered deduction with per-plant scaling
 * - 3.3: Atomic transactions with idempotency
 * - 3.4: Insufficient stock handling with recovery options
 */

/**
 * Source of inventory deduction
 * - task: Triggered by task completion (feeding, harvest)
 * - manual: User-initiated manual deduction
 * - import: Bulk import via CSV
 */
export type DeductionSource = 'task' | 'manual' | 'import';

/**
 * Scaling mode for per-task quantity calculations
 * - fixed: Use perTaskQuantity as-is
 * - per-plant: Multiply by plant count from task context
 * - ec-based: Calculate nutrient amount from EC/ppm target (requires nutrient engine)
 */
export type ScalingMode = 'fixed' | 'per-plant' | 'ec-based';

/**
 * Deduction map entry defining what to consume
 * Stored in task metadata or template configuration
 */
export interface DeductionMapEntry {
  /** Inventory item ID to deduct from */
  itemId: string;

  /** Unit of measure (must match item.unit_of_measure) */
  unit: string;

  /** Fixed quantity per task (optional if perPlantQuantity used) */
  perTaskQuantity?: number;

  /** Quantity per plant (optional, requires scalingMode='per-plant') */
  perPlantQuantity?: number;

  /** Scaling calculation mode (default: 'fixed') */
  scalingMode?: ScalingMode;

  /** Human-readable label for UI display */
  label?: string;
}

/**
 * Context for scaling calculations
 * Extracted from task metadata and plant data
 */
export interface DeductionContext {
  /** Task ID triggering the deduction */
  taskId: string;

  /** Plant count (for per-plant scaling) */
  plantCount?: number;

  /** Target EC in mS/cm (for ec-based nutrient calculations) */
  targetEc?: number;

  /** Target PPM (alternative to EC) */
  targetPpm?: number;

  /** PPM scale factor (500 or 700) */
  ppmScale?: 500 | 700;

  /** Reservoir volume in liters (for nutrient dose calculations) */
  reservoirVolume?: number;
}

/**
 * Request to deduce inventory
 */
export interface DeduceInventoryRequest {
  /** Source of deduction (task, manual, import) */
  source: DeductionSource;

  /** Task ID if triggered by task completion */
  taskId?: string;

  /** Deduction map entries specifying what to consume */
  deductionMap: DeductionMapEntry[];

  /** Idempotency key for retry safety (generated if not provided) */
  idempotencyKey?: string;

  /** Allow consuming from expired batches (requires reason) */
  allowExpiredOverride?: boolean;

  /** Reason for expired batch override */
  expiredOverrideReason?: string;

  /** Context for scaling calculations */
  context?: DeductionContext;
}

/**
 * Result of batch picking for a single item
 */
export interface BatchPickResult {
  /** Batch ID */
  batchId: string;

  /** Lot number */
  lotNumber: string;

  /** Quantity to consume from this batch */
  quantity: number;

  /** Cost per unit in minor currency units (cents) */
  costPerUnitMinor: number;

  /** Expiration date (ISO string or null) */
  expiresOn: string | null;

  /** Whether this batch is expired */
  isExpired: boolean;
}

/**
 * Movement created by deduction
 */
export interface DeductionMovement {
  /** Movement ID (generated) */
  id: string;

  /** Item ID */
  itemId: string;

  /** Batch ID source */
  batchId: string;

  /** Quantity deducted (negative for consumption) */
  quantityDelta: number;

  /** Cost per unit from batch */
  costPerUnitMinor: number;

  /** Human-readable reason */
  reason: string;

  /** Linked task ID */
  taskId: string;

  /** Idempotency key */
  externalKey: string;

  /** Created timestamp */
  createdAt: Date;
}

/**
 * Recovery option for insufficient stock
 */
export interface RecoveryOption {
  /** Recovery action type */
  action: 'partial' | 'skip' | 'adjust';

  /** User-friendly label */
  label: string;

  /** Detailed description */
  description: string;

  /** Action-specific data */
  data?: {
    /** Available quantity for partial completion */
    availableQuantity?: number;

    /** Required quantity for adjustment */
    requiredQuantity?: number;

    /** Item ID for adjustment */
    itemId?: string;
  };
}

/**
 * Error when insufficient stock available
 */
export interface InsufficientStockError {
  /** Error code */
  code: 'INSUFFICIENT_STOCK';

  /** Item ID with insufficient stock */
  itemId: string;

  /** Item name for display */
  itemName: string;

  /** Required quantity */
  required: number;

  /** Available quantity */
  available: number;

  /** Unit of measure */
  unit: string;

  /** Recovery options presented to user */
  recoveryOptions: RecoveryOption[];

  /** User-friendly error message */
  message: string;
}

/**
 * Result of inventory deduction
 */
export interface DeductionResult {
  /** Whether deduction succeeded */
  success: boolean;

  /** Movements created (empty if failed) */
  movements: DeductionMovement[];

  /** Items with insufficient stock */
  insufficientItems?: InsufficientStockError[];

  /** General error message */
  error?: string;

  /** Idempotency key used */
  idempotencyKey: string;
}

/**
 * Validation error for deduction map
 */
export interface DeductionValidationError {
  /** Error code */
  code:
    | 'INVALID_QUANTITY'
    | 'INVALID_UNIT'
    | 'UNIT_MISMATCH'
    | 'MISSING_ITEM'
    | 'INVALID_SCALING';

  /** Field with error */
  field: string;

  /** Error message */
  message: string;

  /** Entry index in deduction map */
  entryIndex?: number;
}
