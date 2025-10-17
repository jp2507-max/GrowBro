/**
 * FEFO Batch Picker
 *
 * Implements First-Expire-First-Out (FEFO) batch picking for inventory consumption.
 * Excludes expired batches by default, with explicit override support.
 *
 * Requirements:
 * - 2.2: FEFO ordering for picking (expires_on sorting)
 * - 2.4: Expired batch exclusion with override
 * - 2.6: Expired batch override with reason
 */

import type { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';

import type { InventoryBatchModel } from '@/lib/watermelon-models/inventory-batch';
import type { BatchPickResult } from '@/types/inventory-deduction';

export interface PickBatchesOptions {
  database: Database;
  itemId: string;
  quantityNeeded: number;
  allowExpiredOverride?: boolean;
}

/**
 * Pick batches for consumption using FEFO ordering
 *
 * Sorts batches by expiration date (earliest first), then by received_at.
 * Excludes expired batches unless allowExpiredOverride is true.
 *
 * @param options - Batch picking options
 * @returns Array of batch picks satisfying quantity (or partial if insufficient)
 */
export async function pickBatchesForConsumption(
  options: PickBatchesOptions
): Promise<{
  picks: BatchPickResult[];
  totalAvailable: number;
  totalPicked: number;
  isPartial: boolean;
}> {
  const {
    database,
    itemId,
    quantityNeeded,
    allowExpiredOverride = false,
  } = options;
  const now = new Date();

  // Query batches for this item (non-deleted, with quantity > 0)
  let query = database
    .get<InventoryBatchModel>('inventory_batches')
    .query(
      Q.where('item_id', itemId),
      Q.where('deleted_at', null),
      Q.where('quantity', Q.gt(0))
    );

  const allBatches = await query.fetch();

  // Filter and sort batches using FEFO logic
  const eligibleBatches = filterAndSortByFEFO(
    allBatches,
    now,
    allowExpiredOverride
  );

  // Calculate total available quantity
  const totalAvailable = eligibleBatches.reduce(
    (sum, batch) => sum + batch.quantity,
    0
  );

  // Pick batches until quantity satisfied
  const picks = pickFromBatches(eligibleBatches, quantityNeeded, now);

  const totalPicked = picks.reduce((sum, pick) => sum + pick.quantity, 0);
  const isPartial = totalPicked < quantityNeeded;

  return {
    picks,
    totalAvailable,
    totalPicked,
    isPartial,
  };
}

/**
 * Get batches for item sorted by FEFO
 *
 * Utility function for displaying batch order in UI.
 *
 * @param database - WatermelonDB instance
 * @param itemId - Inventory item ID
 * @param includeExpired - Include expired batches in results
 * @returns Array of batches sorted by FEFO order
 */
export async function getBatchesByFEFO(
  database: Database,
  itemId: string,
  includeExpired: boolean = false
): Promise<InventoryBatchModel[]> {
  const now = new Date();

  const batches = await database
    .get<InventoryBatchModel>('inventory_batches')
    .query(
      Q.where('item_id', itemId),
      Q.where('deleted_at', null),
      Q.where('quantity', Q.gt(0))
    )
    .fetch();

  return batches
    .filter((batch) => {
      if (!includeExpired && batch.expiresOn && batch.expiresOn < now) {
        return false;
      }
      return true;
    })
    .sort((a, b) => sortByFEFO(a, b));
}

/**
 * Filter and sort batches using FEFO logic
 */
function filterAndSortByFEFO(
  batches: InventoryBatchModel[],
  now: Date,
  allowExpiredOverride: boolean
): InventoryBatchModel[] {
  return batches
    .filter((batch) => {
      if (!allowExpiredOverride && batch.expiresOn && batch.expiresOn < now) {
        return false;
      }
      return true;
    })
    .sort((a, b) => sortByFEFO(a, b));
}

/**
 * Sort two batches by FEFO order
 */
function sortByFEFO(a: InventoryBatchModel, b: InventoryBatchModel): number {
  const aExpires = a.expiresOn
    ? a.expiresOn.getTime()
    : Number.MAX_SAFE_INTEGER;
  const bExpires = b.expiresOn
    ? b.expiresOn.getTime()
    : Number.MAX_SAFE_INTEGER;

  if (aExpires !== bExpires) {
    return aExpires - bExpires;
  }

  return a.receivedAt.getTime() - b.receivedAt.getTime();
}

/**
 * Pick batches to satisfy quantity needed
 */
function pickFromBatches(
  batches: InventoryBatchModel[],
  quantityNeeded: number,
  now: Date
): BatchPickResult[] {
  const picks: BatchPickResult[] = [];
  let remainingNeeded = quantityNeeded;

  for (const batch of batches) {
    if (remainingNeeded <= 0) break;

    const quantityFromBatch = Math.min(batch.quantity, remainingNeeded);
    const isExpired = batch.expiresOn ? batch.expiresOn < now : false;

    picks.push({
      batchId: batch.id,
      lotNumber: batch.lotNumber,
      quantity: quantityFromBatch,
      costPerUnitMinor: batch.costPerUnitMinor,
      expiresOn: batch.expiresOn ? batch.expiresOn.toISOString() : null,
      isExpired,
    });

    remainingNeeded -= quantityFromBatch;
  }

  return picks;
}
