/**
 * Inventory Types and Interfaces
 *
 * Type definitions for inventory management system including items,
 * batches, movements, and related operations.
 *
 * Requirements:
 * - 1.2: Item name, category, unit, tracking_mode, min_stock
 * - 1.3: Display item details with current stock and total value
 * - 8.1: Predefined categories with facet support
 */

/**
 * Tracking mode for inventory items
 * - simple: Aggregate tracking without lot/expiry
 * - batched: Lot and expiry tracking (FEFO)
 */
export type TrackingMode = 'simple' | 'batched';

/**
 * Predefined inventory categories
 * Requirement 8.1
 */
export type InventoryCategory =
  | 'Nutrients'
  | 'Seeds'
  | 'Growing Media'
  | 'Tools'
  | 'Containers'
  | 'Amendments';

/**
 * Movement types for inventory tracking
 * - receipt: Stock received (positive quantity)
 * - consumption: Stock consumed (negative quantity)
 * - adjustment: Manual correction (can be positive or negative)
 */
export type MovementType = 'receipt' | 'consumption' | 'adjustment';

/**
 * Create inventory item request
 * Requirement 1.2
 */
export interface CreateInventoryItemRequest {
  /** Item name (required) */
  name: string;

  /** Category classification (required) */
  category: InventoryCategory;

  /** Unit of measure (SI units preferred, required) */
  unitOfMeasure: string;

  /** Tracking mode: simple or batched (required) */
  trackingMode: TrackingMode;

  /** Whether item is consumable (required) */
  isConsumable: boolean;

  /** Minimum stock threshold for low-stock warnings (required) */
  minStock: number;

  /** Pack size / reorder multiple (required) */
  reorderMultiple: number;

  /** Lead time in days for reorder calculations (optional) */
  leadTimeDays?: number;

  /** Stock Keeping Unit (optional) */
  sku?: string;

  /** Barcode (optional) */
  barcode?: string;
}

/**
 * Update inventory item request
 * All fields optional (partial update)
 */
export interface UpdateInventoryItemRequest {
  name?: string;
  category?: InventoryCategory;
  unitOfMeasure?: string;
  trackingMode?: TrackingMode;
  isConsumable?: boolean;
  minStock?: number;
  reorderMultiple?: number;
  leadTimeDays?: number;
  sku?: string;
  barcode?: string;
}

/**
 * Inventory item response
 * Requirement 1.3
 */
export interface InventoryItem {
  id: string;
  name: string;
  category: InventoryCategory;
  unitOfMeasure: string;
  trackingMode: TrackingMode;
  isConsumable: boolean;
  minStock: number;
  reorderMultiple: number;
  leadTimeDays?: number;
  sku?: string;
  barcode?: string;
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

/**
 * Inventory item with computed fields
 * Requirement 1.3
 */
export interface InventoryItemWithStock extends InventoryItem {
  /** Current stock quantity */
  currentStock: number;

  /** Unit cost (from most recent batch or average) */
  unitCost: number;

  /** Total value (currentStock * unitCost) */
  totalValue: number;

  /** Whether item is below minimum stock threshold */
  isLowStock: boolean;
}

/**
 * Validation error for inventory operations
 */
export interface InventoryValidationError {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Result of inventory operation
 */
export interface InventoryOperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  validationErrors?: InventoryValidationError[];
}

/**
 * Inventory filters for querying
 */
export interface InventoryFilters {
  /** Filter by category */
  category?: InventoryCategory;

  /** Filter by tracking mode */
  trackingMode?: TrackingMode;

  /** Filter by consumable flag */
  isConsumable?: boolean;

  /** Filter by low stock status */
  isLowStock?: boolean;

  /** Search by name or SKU */
  search?: string;

  /** Include deleted items */
  includeDeleted?: boolean;
}

/**
 * Category facets for search and filtering
 * Requirement 8.1
 */
export interface CategoryFacet {
  /** Brand name (e.g., "General Hydroponics") */
  brand?: string;

  /** N-P-K ratio for nutrients (e.g., "10-10-10") */
  npkRatio?: string;

  /** Form (powder, liquid, granular) */
  form?: 'powder' | 'liquid' | 'granular' | 'pellet';

  /** Hazard flags for storage guidance */
  hazardFlags?: HazardFlag[];
}

/**
 * Hazard flags for inventory items
 */
export type HazardFlag =
  | 'flammable'
  | 'corrosive'
  | 'oxidizer'
  | 'toxic'
  | 'irritant'
  | 'photosensitive'
  | 'temperature_sensitive';

// ============================================================================
// Batch Management Types (Requirement 2)
// ============================================================================

/**
 * Create batch request
 * Requirement 2.1
 */
export interface CreateBatchRequest {
  /** Item ID this batch belongs to */
  itemId: string;

  /** Lot number / batch identifier (required) */
  lotNumber: string;

  /** Expiration date (optional for non-perishable items) */
  expiresOn?: Date;

  /** Initial quantity (required, must be positive) */
  quantity: number;

  /** Cost per unit in minor currency units (cents) (required) */
  costPerUnitMinor: number;

  /** Timestamp when batch was received (optional, defaults to now) */
  receivedAt?: Date;
}

/**
 * Update batch request
 * Only quantity can be updated directly (with movement record)
 */
export interface UpdateBatchRequest {
  /** New quantity (must be >= 0) */
  quantity: number;

  /** Reason for adjustment (required for audit trail) */
  reason: string;
}

/**
 * Inventory batch response
 * Requirement 2.1
 */
export interface InventoryBatch {
  id: string;
  itemId: string;
  lotNumber: string;
  expiresOn?: Date;
  quantity: number;
  costPerUnitMinor: number;
  receivedAt: Date;
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

/**
 * Batch with computed expiry status
 * Requirement 2.2, 2.6
 */
export interface InventoryBatchWithStatus extends InventoryBatch {
  /** Whether batch is expired */
  isExpired: boolean;

  /** Days until expiry (negative if expired) */
  daysToExpiry?: number;

  /** Whether batch is excluded from FEFO picking */
  isExcludedFromPicking: boolean;
}

/**
 * Options for querying available batches
 * Requirement 2.2, 2.6
 */
export interface AvailableBatchesOptions {
  /** Include expired batches (default: false) */
  includeExpired?: boolean;

  /** Minimum shelf life in days (filters out batches expiring sooner) */
  minShelfDays?: number;
}

/**
 * Single batch allocation from picking operation
 * Requirement 2.3
 */
export interface BatchAllocation {
  /** Batch ID */
  batchId: string;

  /** Lot number for reference */
  lotNumber: string;

  /** Quantity picked from this batch */
  quantity: number;

  /** Cost per unit at time of picking (FIFO cost) */
  costPerUnitMinor: number;

  /** Total cost for this allocation (quantity * costPerUnitMinor) */
  totalCostMinor: number;
}

/**
 * Result of picking operation
 * Requirement 2.3
 */
export interface PickResult {
  /** Whether pick was successful */
  success: boolean;

  /** Total quantity picked */
  quantityPicked: number;

  /** Batch allocations (FEFO ordered) */
  allocations: BatchAllocation[];

  /** Total cost in minor units */
  totalCostMinor: number;

  /** Average cost per unit in minor units */
  averageCostPerUnitMinor: number;

  /** Error message if pick failed */
  error?: string;

  /** Quantity short (if insufficient inventory) */
  quantityShort?: number;
}

/**
 * Options for picking operation
 * Requirement 2.3, 2.6
 */
export interface PickOptions {
  /** Allow picking from expired batches with reason */
  allowExpiredOverride?: boolean;

  /** Reason for expired override (required if allowExpiredOverride is true) */
  expiredOverrideReason?: string;

  /** Fallback to FIFO when no expiry dates exist */
  fallbackToFIFO?: boolean;
}

/**
 * Cost analysis result
 * Requirement 2.3
 */
export interface CostAnalysis {
  /** Total cost in minor units */
  totalCostMinor: number;

  /** Average cost per unit in minor units */
  averageCostPerUnitMinor: number;

  /** Number of movements analyzed */
  movementCount: number;

  /** Total quantity consumed */
  totalQuantity: number;
}
