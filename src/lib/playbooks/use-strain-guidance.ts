/**
 * Strain Guidance Hook
 *
 * React hook for integrating strain-specific guidance with playbooks.
 * Provides customized playbooks based on strain characteristics.
 */

import { useMemo } from 'react';

import type { Playbook } from '@/types/playbook';
import type { GrowCharacteristics } from '@/types/strains';

import {
  calculatePhaseDurations,
  type CustomizedPhaseDurations,
  customizePlaybookForStrain,
  getAssumptionsChipData,
} from './strain-guidance';

interface UseStrainGuidanceOptions {
  playbook: Playbook;
  strainCharacteristics?: GrowCharacteristics;
}

interface UseStrainGuidanceResult {
  customizedPlaybook: Playbook;
  phaseDurations: CustomizedPhaseDurations;
  assumptionsChip: {
    show: boolean;
    label: string;
    message: string;
  };
  hasStrainData: boolean;
}

/**
 * Hook to customize playbook based on strain characteristics
 */
export function useStrainGuidance({
  playbook,
  strainCharacteristics,
}: UseStrainGuidanceOptions): UseStrainGuidanceResult {
  const phaseDurations = useMemo(
    () => calculatePhaseDurations(strainCharacteristics),
    [strainCharacteristics]
  );

  const customizedPlaybook = useMemo(
    () => customizePlaybookForStrain(playbook, strainCharacteristics),
    [playbook, strainCharacteristics]
  );

  const assumptionsChip = useMemo(
    () => getAssumptionsChipData(phaseDurations.assumptions),
    [phaseDurations.assumptions]
  );

  const hasStrainData = useMemo(
    () => Boolean(strainCharacteristics),
    [strainCharacteristics]
  );

  return {
    customizedPlaybook,
    phaseDurations,
    assumptionsChip,
    hasStrainData,
  };
}
