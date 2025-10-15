/**
 * Batch Picking Service
 *
 * Implements FEFO (First-Expire-First-Out) for picking/consumption
 * and FIFO (First-In-First-Out) for costing/accounting.
 *
 * FEFO Policy: Pick from batches expiring soonest first, exclude expired by default
 * FIFO Policy: Cost from oldest batch at time of picking, never revalue historical movements
 *
 * Requirements:
 * - 2.2: FEFO ordering for picking (expires_on sorting)
 * - 2.3: FEFO for picking, FIFO for costing
 * - 2.6: Expired batch exclusion with override and reason
 */

import {
  type AvailableBatchesOptions,
  type BatchAllocation,
  type CostAnalysis,
  type InventoryBatch,
  type InventoryBatchWithStatus,
  type PickOptions,
  type PickResult,
} from '@/types/inventory';

import { getBatchesForItem } from './batch-service';

/**
 * Calculate days until expiry for a batch
 *
 * @param expiresOn - Expiration date
 * @returns Days to expiry (negative if expired), undefined if no expiry
 */
function calculateDaysToExpiry(expiresOn?: Date): number | undefined {
  if (!expiresOn) return undefined;

  const now = new Date();
  const diffMs = expiresOn.getTime() - now.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Check if a batch is expired
 *
 * @param expiresOn - Expiration date
 * @returns True if expired, false otherwise
 */
function isBatchExpired(expiresOn?: Date): boolean {
  if (!expiresOn) return false;
  return expiresOn < new Date();
}

/**
 * Convert batch to batch with status
 * Requirement 2.6
 */
function addBatchStatus(batch: InventoryBatch): InventoryBatchWithStatus {
  const isExpired = isBatchExpired(batch.expiresOn);
  const daysToExpiry = calculateDaysToExpiry(batch.expiresOn);

  return {
    ...batch,
    isExpired,
    daysToExpiry,
    isExcludedFromPicking: isExpired,
  };
}

/**
 * Get available batches for picking with FEFO ordering
 * Requirement 2.2, 2.6
 *
 * Excludes expired batches by default unless explicitly included.
 * Filters by minimum shelf life if specified.
 *
 * @param itemId - Item ID
 * @param options - Query options
 * @returns Array of batches with status, FEFO-sorted (earliest expiry first)
 */
export async function getAvailableBatches(
  itemId: string,
  options?: AvailableBatchesOptions
): Promise<InventoryBatchWithStatus[]> {
  const includeExpired = options?.includeExpired ?? false;
  const minShelfDays = options?.minShelfDays;

  // Get batches from batch service (already FEFO-sorted)
  const batches = await getBatchesForItem(itemId, includeExpired);

  // Add status to each batch
  let batchesWithStatus = batches.map(addBatchStatus);

  // Filter by minimum shelf life if specified
  if (minShelfDays !== undefined) {
    batchesWithStatus = batchesWithStatus.filter((batch) => {
      if (!batch.daysToExpiry) return true; // No expiry = infinite shelf life
      return batch.daysToExpiry >= minShelfDays;
    });
  }

  return batchesWithStatus;
}

/**
 * Pick quantity from batches using FEFO policy
 * Requirement 2.3, 2.6
 *
 * Picks from batches expiring soonest first. Supports split-batch consumption.
 * Excludes expired batches unless override is enabled with reason.
 *
 * FIFO costing: Uses cost from each batch at time of picking (never revalues).
 *
 * @param itemId - Item ID to pick from
 * @param quantity - Quantity to pick
 * @param options - Picking options
 * @returns Pick result with allocations and costs
 */
export async function pickQuantity(
  itemId: string,
  quantity: number,
  options?: PickOptions
): Promise<PickResult> {
  if (quantity <= 0) {
    return {
      success: false,
      quantityPicked: 0,
      allocations: [],
      totalCostMinor: 0,
      averageCostPerUnitMinor: 0,
      error: 'Quantity must be positive',
    };
  }

  // Validate expired override
  if (options?.allowExpiredOverride && !options.expiredOverrideReason) {
    return {
      success: false,
      quantityPicked: 0,
      allocations: [],
      totalCostMinor: 0,
      averageCostPerUnitMinor: 0,
      error: 'Reason required when allowing expired override',
    };
  }

  // Get available batches (FEFO-sorted)
  const includeExpired = options?.allowExpiredOverride ?? false;
  const batches = await getAvailableBatches(itemId, { includeExpired });

  // If no batches with expiry exist and fallback to FIFO is enabled,
  // getBatchesForItem already returns batches in received_at order
  // when all batches have no expiry date

  if (batches.length === 0) {
    return {
      success: false,
      quantityPicked: 0,
      allocations: [],
      totalCostMinor: 0,
      averageCostPerUnitMinor: 0,
      error: 'No available batches',
      quantityShort: quantity,
    };
  }

  const allocations: BatchAllocation[] = [];
  let remainingQuantity = quantity;
  let totalCostMinor = 0;

  // Pick from batches in FEFO order
  for (const batch of batches) {
    if (remainingQuantity <= 0) break;

    const pickQuantity = Math.min(batch.quantity, remainingQuantity);
    const allocationCost = pickQuantity * batch.costPerUnitMinor;

    allocations.push({
      batchId: batch.id,
      lotNumber: batch.lotNumber,
      quantity: pickQuantity,
      costPerUnitMinor: batch.costPerUnitMinor,
      totalCostMinor: allocationCost,
    });

    totalCostMinor += allocationCost;
    remainingQuantity -= pickQuantity;
  }

  const quantityPicked = quantity - remainingQuantity;
  const averageCostPerUnitMinor =
    quantityPicked > 0 ? Math.round(totalCostMinor / quantityPicked) : 0;

  const success = remainingQuantity === 0;

  return {
    success,
    quantityPicked,
    allocations,
    totalCostMinor,
    averageCostPerUnitMinor,
    quantityShort: remainingQuantity > 0 ? remainingQuantity : undefined,
    error: success ? undefined : 'Insufficient inventory',
  };
}

/**
 * Calculate cost of goods from batch allocations
 * Requirement 2.3
 *
 * Uses FIFO costing: cost equals batch cost at time of picking.
 * Never revalues historical costs.
 *
 * @param allocations - Batch allocations from picking
 * @returns Cost analysis
 */
export function calculateCostOfGoods(
  allocations: BatchAllocation[]
): CostAnalysis {
  let totalCostMinor = 0;
  let totalQuantity = 0;

  for (const allocation of allocations) {
    totalCostMinor += allocation.totalCostMinor;
    totalQuantity += allocation.quantity;
  }

  const averageCostPerUnitMinor =
    totalQuantity > 0 ? Math.round(totalCostMinor / totalQuantity) : 0;

  return {
    totalCostMinor,
    averageCostPerUnitMinor,
    movementCount: allocations.length,
    totalQuantity,
  };
}

/**
 * Validate if picking can proceed with current options
 * Requirement 2.6
 *
 * @param batches - Available batches
 * @param quantity - Quantity to pick
 * @param options - Pick options
 * @returns Validation result with error message if invalid
 */
export function validatePick(
  batches: InventoryBatchWithStatus[],
  quantity: number,
  options?: PickOptions
): { valid: boolean; error?: string } {
  if (quantity <= 0) {
    return { valid: false, error: 'Quantity must be positive' };
  }

  if (batches.length === 0) {
    return { valid: false, error: 'No available batches' };
  }

  const hasExpiredBatches = batches.some((b) => b.isExpired);
  if (hasExpiredBatches && options?.allowExpiredOverride) {
    if (!options.expiredOverrideReason) {
      return {
        valid: false,
        error: 'Reason required for expired batch override',
      };
    }
  }

  return { valid: true };
}

/**
 * Get batch expiry warning message
 * Requirement 2.6
 *
 * @param batch - Batch to check
 * @returns Warning message for expired batches
 */
export function getBatchExpiryWarning(
  batch: InventoryBatchWithStatus
): string | undefined {
  if (!batch.isExpired) return undefined;

  const expiryDate = batch.expiresOn
    ? batch.expiresOn.toLocaleDateString()
    : 'unknown';
  return `Expired on ${expiryDate}. Excluded from auto-picking (FEFO). Override?`;
}
