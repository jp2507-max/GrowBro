/**
 * Overlap Detection Utility
 *
 * Detects and validates overlapping harvests per plant
 * Requirement 19.1: Support multiple harvests with explicit override for overlapping open harvests
 */

import { Q } from '@nozbe/watermelondb';

import { HarvestStage } from '@/types';

import { database } from '../watermelon';
import type { HarvestModel } from '../watermelon-models/harvest';

export interface OverlapCheckResult {
  hasOverlap: boolean;
  overlappingHarvests: HarvestModel[];
  canProceed: boolean;
  requiresOverride: boolean;
  message?: string;
}

export interface OverlapOverrideInput {
  reason: string;
  performedBy?: string;
}

/**
 * Check for overlapping open harvests on the same plant
 * Requirement 19.1
 *
 * Open harvest = stage is 'harvest' and not soft-deleted
 *
 * @param plantId Plant ID to check
 * @param excludeHarvestId Optional harvest ID to exclude from check (for updates)
 * @returns Overlap detection result
 */
export async function checkOverlappingHarvests(
  plantId: string,
  excludeHarvestId?: string
): Promise<OverlapCheckResult> {
  try {
    const harvestsCollection = database.get<HarvestModel>('harvests');

    // Query for open harvests on this plant
    const query = harvestsCollection
      .query(
        Q.where('plant_id', plantId),
        Q.where('stage', HarvestStage.HARVEST),
        Q.where('deleted_at', null)
      )
      .fetch();

    const openHarvests = await query;

    // Filter out the harvest being updated (if applicable)
    const overlapping = excludeHarvestId
      ? openHarvests.filter((h) => h.id !== excludeHarvestId)
      : openHarvests;

    const hasOverlap = overlapping.length > 0;

    return {
      hasOverlap,
      overlappingHarvests: overlapping,
      canProceed: !hasOverlap, // Can proceed only if no overlap
      requiresOverride: hasOverlap,
      message: hasOverlap
        ? `Found ${overlapping.length} open harvest(s) for this plant. Close existing harvests or override.`
        : undefined,
    };
  } catch (error) {
    console.error('[OverlapDetection] Failed to check overlaps:', error);
    return {
      hasOverlap: false,
      overlappingHarvests: [],
      canProceed: false,
      requiresOverride: false,
      message: 'Failed to validate overlapping harvests',
    };
  }
}

/**
 * Validate overlap override request
 * Requirement 19.1
 *
 * @param overrideInput Override reason and metadata
 * @returns Validation result
 */
export function validateOverlapOverride(overrideInput: OverlapOverrideInput): {
  valid: boolean;
  error?: string;
} {
  // Validate reason is provided and non-empty
  if (!overrideInput.reason || overrideInput.reason.trim().length === 0) {
    return {
      valid: false,
      error: 'Reason is mandatory for overlapping harvest override',
    };
  }

  // Validate reason has sufficient detail (at least 10 characters)
  if (overrideInput.reason.trim().length < 10) {
    return {
      valid: false,
      error: 'Override reason must be at least 10 characters',
    };
  }

  return { valid: true };
}

/**
 * Get all harvests for a plant (including completed and deleted)
 * Helper for overlap analysis and multi-harvest scenarios
 *
 * @param plantId Plant ID
 * @returns All harvests for the plant
 */
export async function getAllHarvestsForPlant(
  plantId: string
): Promise<HarvestModel[]> {
  try {
    const harvestsCollection = database.get<HarvestModel>('harvests');
    return await harvestsCollection.query(Q.where('plant_id', plantId)).fetch();
  } catch (error) {
    console.error('[OverlapDetection] Failed to get all harvests:', error);
    return [];
  }
}

/**
 * Count active harvests across all plants
 * Useful for dashboard metrics and validation
 *
 * @returns Count of active (non-deleted) harvests
 */
export async function countActiveHarvests(): Promise<number> {
  try {
    const harvestsCollection = database.get<HarvestModel>('harvests');
    const active = await harvestsCollection
      .query(Q.where('deleted_at', null))
      .fetch();
    return active.length;
  } catch (error) {
    console.error('[OverlapDetection] Failed to count active harvests:', error);
    return 0;
  }
}
