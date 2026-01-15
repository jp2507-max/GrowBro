/**
 * Playbook Auto-Apply
 *
 * Automatically selects and applies a playbook template when a plant is created.
 * Uses plant properties (photoperiodType, environment) to find the best match.
 */

import type {
  PhotoperiodType,
  Plant,
  PlantEnvironment,
} from '@/api/plants/types';
import { NoopAnalytics } from '@/lib/analytics';
import { database } from '@/lib/watermelon';

import {
  type PlaybookSelectionCriteria,
  PlaybookSelector,
} from '../playbooks/playbook-selector';
import { PlaybookService } from '../playbooks/playbook-service';

export type AutoApplyResult = {
  applied: boolean;
  playbookId?: string;
  taskCount?: number;
  error?: string;
};

/**
 * Attempts to auto-apply a matching playbook to a newly created plant.
 * Non-blocking - failures are logged but don't affect plant creation.
 *
 * @param plantId - The ID of the newly created plant
 * @param criteria - Plant properties used to select the playbook
 * @returns Result indicating if a playbook was applied
 */
export async function maybeAutoApplyPlaybook(
  plantId: string,
  criteria: {
    photoperiodType?: PhotoperiodType;
    environment?: PlantEnvironment;
    locale?: string;
  }
): Promise<AutoApplyResult> {
  // Skip if we don't have enough info to select a playbook
  if (!criteria.photoperiodType || !criteria.environment) {
    console.log(
      `[PlaybookAutoApply] Skipping for plant ${plantId} - missing photoperiodType or environment`
    );
    return { applied: false };
  }

  try {
    const selector = new PlaybookSelector({ database });
    const playbookId = await selector.findMatchingPlaybook({
      photoperiodType: criteria.photoperiodType,
      environment: criteria.environment,
      locale: criteria.locale ?? 'en',
    });

    if (!playbookId) {
      console.log(
        `[PlaybookAutoApply] No matching playbook found for plant ${plantId}`
      );
      return { applied: false };
    }

    // Apply the playbook
    const service = new PlaybookService({
      database,
      analytics: NoopAnalytics,
    });

    const result = await service.applyPlaybookToPlant(playbookId, plantId, {
      idempotencyKey: `auto-apply-${plantId}`,
    });

    console.log(
      `[PlaybookAutoApply] Applied playbook ${playbookId} to plant ${plantId}, created ${result.appliedTaskCount} tasks`
    );

    return {
      applied: true,
      playbookId,
      taskCount: result.appliedTaskCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `[PlaybookAutoApply] Failed to auto-apply playbook for plant ${plantId}:`,
      message
    );
    return {
      applied: false,
      error: message,
    };
  }
}

/**
 * Helper to extract playbook selection criteria from a Plant object
 */
export function getPlaybookCriteriaFromPlant(
  plant: Plant
): PlaybookSelectionCriteria {
  return {
    photoperiodType: plant.photoperiodType ?? plant.metadata?.photoperiodType,
    environment: plant.environment ?? plant.metadata?.environment,
  };
}
