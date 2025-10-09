/**
 * Harvest Service
 *
 * Business logic for harvest CRUD operations with optimistic writes
 * Requirements: 1.3 (save with timestamp), 1.4 (offline support)
 */

import { Q } from '@nozbe/watermelondb';

import { type HarvestStage, HarvestStages } from '@/types/harvest';

import { database } from '../watermelon';
import type { HarvestModel } from '../watermelon-models/harvest';
import {
  cancelStageReminders,
  scheduleOverdueReminder,
  scheduleStageReminder,
} from './harvest-notification-service';
import { getAllStages, getStageIndex } from './stage-config';

export interface CreateHarvestInput {
  plantId: string;
  wetWeightG: number | null;
  dryWeightG: number | null;
  trimmingsWeightG: number | null;
  notes: string;
  photos?: {
    variant: string;
    localUri: string;
    remotePath?: string;
  }[];
}

export interface CreateHarvestResult {
  success: boolean;
  harvest: HarvestModel | null;
  error?: string;
}

/**
 * Create a new harvest record with optimistic write
 * Requirements: 1.3, 1.4
 *
 * @param input Harvest data
 * @returns Created harvest record
 */
export async function createHarvest(
  input: CreateHarvestInput
): Promise<CreateHarvestResult> {
  try {
    const harvestsCollection = database.get<HarvestModel>('harvests');

    const harvest = await database.write(async () => {
      return await harvestsCollection.create((record) => {
        record.plantId = input.plantId;
        record.stage = HarvestStages.HARVEST;
        record.wetWeightG = input.wetWeightG ?? undefined;
        record.dryWeightG = input.dryWeightG ?? undefined;
        record.trimmingsWeightG = input.trimmingsWeightG ?? undefined;
        record.notes = input.notes;
        record.photos = input.photos ?? [];
        record.conflictSeen = false;

        // Initialize stage timestamps (will be updated by server on sync)
        record.stageStartedAt = new Date();
        record.stageCompletedAt = undefined;
      });
    });

    return { success: true, harvest };
  } catch (error) {
    console.error('[HarvestService] Failed to create harvest:', error);
    return {
      success: false,
      harvest: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update an existing harvest record
 *
 * @param harvestId Harvest record ID
 * @param updates Partial harvest data to update
 * @returns Updated harvest record
 */
export async function updateHarvest(
  harvestId: string,
  updates: Partial<CreateHarvestInput>
): Promise<CreateHarvestResult> {
  try {
    const harvestsCollection = database.get<HarvestModel>('harvests');
    const harvest = await harvestsCollection.find(harvestId);

    const updated = await database.write(async () => {
      return await harvest.update((record) => {
        if (updates.wetWeightG !== undefined) {
          record.wetWeightG = updates.wetWeightG ?? undefined;
        }
        if (updates.dryWeightG !== undefined) {
          record.dryWeightG = updates.dryWeightG ?? undefined;
        }
        if (updates.trimmingsWeightG !== undefined) {
          record.trimmingsWeightG = updates.trimmingsWeightG ?? undefined;
        }
        if (updates.notes !== undefined) {
          record.notes = updates.notes;
        }
        if (updates.photos !== undefined) {
          record.photos = updates.photos;
        }
      });
    });

    return { success: true, harvest: updated };
  } catch (error) {
    console.error('[HarvestService] Failed to update harvest:', error);
    return {
      success: false,
      harvest: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get harvest by ID
 *
 * @param harvestId Harvest record ID
 * @returns Harvest record or null
 */
export async function getHarvest(
  harvestId: string
): Promise<HarvestModel | null> {
  try {
    const harvestsCollection = database.get<HarvestModel>('harvests');
    return await harvestsCollection.find(harvestId);
  } catch (error) {
    console.error('[HarvestService] Failed to get harvest:', error);
    return null;
  }
}

/**
 * Get all harvests for a plant
 *
 * @param plantId Plant ID
 * @returns Array of harvest records
 */
export async function getHarvestsForPlant(
  plantId: string
): Promise<HarvestModel[]> {
  try {
    const harvestsCollection = database.get<HarvestModel>('harvests');
    return await harvestsCollection.query(Q.where('plant_id', plantId)).fetch();
  } catch (error) {
    console.error('[HarvestService] Failed to get harvests for plant:', error);
    return [];
  }
}

/**
 * Delete harvest record (soft delete)
 *
 * @param harvestId Harvest record ID
 * @returns Success status
 */
export async function deleteHarvest(harvestId: string): Promise<boolean> {
  try {
    const harvestsCollection = database.get<HarvestModel>('harvests');
    const harvest = await harvestsCollection.find(harvestId);

    // Cancel any pending notifications before deleting
    await cancelStageReminders(harvestId);

    await database.write(async () => {
      await harvest.markAsDeleted();
    });

    return true;
  } catch (error) {
    console.error('[HarvestService] Failed to delete harvest:', error);
    return false;
  }
}

/**
 * Advance harvest to next stage with notification scheduling
 * Requirements: 14.1 (schedule notifications on stage entry)
 *
 * @param harvestId Harvest record ID
 * @returns Updated harvest record
 */
export async function advanceHarvestStage(
  harvestId: string
): Promise<CreateHarvestResult> {
  try {
    const harvestsCollection = database.get<HarvestModel>('harvests');
    const harvest = await harvestsCollection.find(harvestId);

    const currentStage = harvest.stage as HarvestStage;
    const stages = getAllStages();
    const currentIndex = getStageIndex(currentStage);

    // Validate we can advance
    if (currentIndex === -1 || currentIndex >= stages.length - 1) {
      return {
        success: false,
        harvest: null,
        error: 'Cannot advance from current stage',
      };
    }

    const nextStage = stages[currentIndex + 1];
    const now = new Date();

    // Cancel existing notifications before advancing
    await cancelStageReminders(harvestId);

    // Update harvest stage
    const updated = await database.write(async () => {
      return await harvest.update((record) => {
        record.stage = nextStage;
        record.stageCompletedAt = undefined; // Clear completion time for new stage
        record.stageStartedAt = now; // Start new stage
      });
    });

    // Schedule new notifications for the new stage
    const targetResult = await scheduleStageReminder(harvestId, nextStage, now);

    if (targetResult.scheduled) {
      const overdueResult = await scheduleOverdueReminder(
        harvestId,
        nextStage,
        now
      );

      console.log('[HarvestService] Scheduled notifications for stage:', {
        stage: nextStage,
        targetScheduled: targetResult.scheduled,
        overdueScheduled: overdueResult.scheduled,
      });
    }

    return { success: true, harvest: updated };
  } catch (error) {
    console.error('[HarvestService] Failed to advance harvest stage:', error);
    return {
      success: false,
      harvest: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
