/**
 * Playbook Selector
 *
 * Auto-selects appropriate playbook template based on plant properties.
 * Maps photoperiodType + environment to PlaybookSetup for automatic
 * task generation on plant creation.
 */

import { type Database, Q } from '@nozbe/watermelondb';

import type { PhotoperiodType, PlantEnvironment } from '@/api/plants/types';
import type { PlaybookSetup } from '@/types/playbook';

import type { PlaybookModel } from '../watermelon-models/playbook';

export type PlaybookSelectionCriteria = {
  photoperiodType?: PhotoperiodType;
  environment?: PlantEnvironment;
  locale?: string;
};

/**
 * Maps plant properties to PlaybookSetup
 *
 * Mapping:
 * - photoperiod + indoor → photo_indoor
 * - photoperiod + outdoor/greenhouse → photo_outdoor
 * - autoflower + indoor → auto_indoor
 * - autoflower + outdoor/greenhouse → auto_outdoor
 */
export function derivePlaybookSetup(
  criteria: PlaybookSelectionCriteria
): PlaybookSetup | null {
  const { photoperiodType, environment } = criteria;

  // Need both properties to determine setup
  if (!photoperiodType || !environment) {
    return null;
  }

  const isIndoor = environment === 'indoor';
  const isAuto = photoperiodType === 'autoflower';

  if (isAuto) {
    return isIndoor ? 'auto_indoor' : 'auto_outdoor';
  }

  // photoperiod
  return isIndoor ? 'photo_indoor' : 'photo_outdoor';
}

export interface PlaybookSelectorOptions {
  database: Database;
}

/**
 * PlaybookSelector finds the best matching playbook template
 * for a plant based on its properties.
 */
export class PlaybookSelector {
  private database: Database;

  constructor(options: PlaybookSelectorOptions) {
    this.database = options.database;
  }

  /**
   * Find the best matching playbook for given criteria.
   * Returns the first template playbook matching the derived setup.
   *
   * Priority:
   * 1. Exact setup match + locale match
   * 2. Exact setup match (any locale)
   * 3. null (no match)
   */
  async findMatchingPlaybook(
    criteria: PlaybookSelectionCriteria
  ): Promise<string | null> {
    const setup = derivePlaybookSetup(criteria);

    if (!setup) {
      console.log(
        '[PlaybookSelector] Cannot derive setup - missing photoperiodType or environment'
      );
      return null;
    }

    const locale = criteria.locale ?? 'en';

    // Query for template playbooks with matching setup
    const playbooks = await this.database
      .get<PlaybookModel>('playbooks')
      .query(
        Q.where('setup', setup),
        Q.where('is_template', true),
        Q.where('deleted_at', null)
      )
      .fetch();

    if (playbooks.length === 0) {
      console.log(
        `[PlaybookSelector] No template playbook found for setup: ${setup}`
      );
      return null;
    }

    // Prefer locale match, fall back to any
    const localeMatch = playbooks.find((p) => p.locale === locale);
    const selected = localeMatch ?? playbooks[0];

    console.log(
      `[PlaybookSelector] Selected playbook "${selected.name}" (${selected.id}) for setup: ${setup}`
    );

    return selected.id;
  }
}
