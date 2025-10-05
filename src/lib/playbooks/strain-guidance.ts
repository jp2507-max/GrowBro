/**
 * Strain-Specific Guidance System
 *
 * Provides strain-specific playbook customization based on:
 * - Autoflower vs Photoperiod type
 * - Breeder flowering range
 * - Sativa/Indica lean
 *
 * All guidance is educational and non-commercial, compliant with app store policies.
 */

import type { GrowPhase, Playbook, PlaybookStep } from '@/types/playbook';
import type {
  GrowCharacteristics,
  StrainLean,
  StrainType,
} from '@/types/strains';

/**
 * Conservative default flowering times when breeder data is missing
 */
const CONSERVATIVE_FLOWERING_DEFAULTS = {
  autoflower: {
    seedling: 7, // 1 week
    veg: 21, // 3 weeks
    flower: 49, // 7 weeks
    harvest: 14, // 2 weeks
  },
  photoperiod: {
    seedling: 14, // 2 weeks
    veg: 42, // 6 weeks
    flower: 56, // 8 weeks
    harvest: 21, // 3 weeks
  },
} as const;

/**
 * Strain-specific assumptions for UI display
 */
export interface StrainAssumptions {
  usedDefaults: boolean;
  assumedStrainType?: StrainType;
  assumedFloweringWeeks?: number;
  assumedLean?: StrainLean;
  message: string;
}

/**
 * Customized phase durations based on strain characteristics
 */
export interface CustomizedPhaseDurations {
  seedling: number; // days
  veg: number; // days
  flower: number; // days
  harvest: number; // days
  assumptions: StrainAssumptions;
}

/**
 * Strain-specific tip for task descriptions
 */
export interface StrainTip {
  phase: GrowPhase;
  taskType: string;
  tip: string;
  isEducational: true; // Always true to ensure compliance
}

/**
 * Calculate customized phase durations based on strain characteristics
 */
export function calculatePhaseDurations(
  strainCharacteristics?: GrowCharacteristics
): CustomizedPhaseDurations {
  const assumptions: StrainAssumptions = {
    usedDefaults: false,
    message: '',
  };

  // If no strain characteristics provided, use photoperiod defaults
  if (!strainCharacteristics) {
    assumptions.usedDefaults = true;
    assumptions.assumedStrainType = 'photoperiod';
    assumptions.message =
      'Using conservative photoperiod defaults. Add strain details for customized timing.';

    return {
      ...CONSERVATIVE_FLOWERING_DEFAULTS.photoperiod,
      assumptions,
    };
  }

  const strainType = strainCharacteristics.strain_type || 'photoperiod';
  const breederRange = strainCharacteristics.breeder_flowering_range;

  // If breeder flowering range is provided, use it
  if (breederRange) {
    const avgFloweringWeeks =
      (breederRange.min_weeks + breederRange.max_weeks) / 2;
    const floweringDays = Math.round(avgFloweringWeeks * 7);

    // Use strain type to determine other phases
    const baseDefaults = CONSERVATIVE_FLOWERING_DEFAULTS[strainType];

    return {
      seedling: baseDefaults.seedling,
      veg: baseDefaults.veg,
      flower: floweringDays,
      harvest: baseDefaults.harvest,
      assumptions: {
        usedDefaults: false,
        message: breederRange.source
          ? `Using ${breederRange.source} flowering range (${breederRange.min_weeks}-${breederRange.max_weeks} weeks)`
          : `Using breeder flowering range (${breederRange.min_weeks}-${breederRange.max_weeks} weeks)`,
      },
    };
  }

  // Use strain type defaults
  assumptions.usedDefaults = true;
  assumptions.assumedStrainType = strainType;
  assumptions.message = `Using conservative ${strainType} defaults. Add breeder flowering range for precise timing.`;

  return {
    ...CONSERVATIVE_FLOWERING_DEFAULTS[strainType],
    assumptions,
  };
}

/**
 * Get autoflower-specific tips
 */
function getAutoflowerTips(): StrainTip[] {
  return [
    {
      phase: 'seedling',
      taskType: 'water',
      tip: 'Autoflowers are sensitive to overwatering in early stages. Start with small amounts and increase gradually.',
      isEducational: true,
    },
    {
      phase: 'veg',
      taskType: 'train',
      tip: 'Autoflowers have a short vegetative period. Low-stress training (LST) works best; avoid high-stress techniques.',
      isEducational: true,
    },
    {
      phase: 'flower',
      taskType: 'monitor',
      tip: 'Autoflowers transition to flowering automatically. Monitor trichomes closely as harvest window can be shorter.',
      isEducational: true,
    },
  ];
}

/**
 * Get photoperiod-specific tips
 */
function getPhotoperiodTips(): StrainTip[] {
  return [
    {
      phase: 'veg',
      taskType: 'train',
      tip: 'Photoperiods can be trained extensively during vegetative growth. Consider topping, FIMing, or SCRoG techniques.',
      isEducational: true,
    },
    {
      phase: 'flower',
      taskType: 'monitor',
      tip: 'Photoperiods require light cycle change (12/12) to flower. Ensure complete darkness during dark periods.',
      isEducational: true,
    },
  ];
}

/**
 * Get sativa-lean tips
 */
function getSativaTips(): StrainTip[] {
  return [
    {
      phase: 'veg',
      taskType: 'prune',
      tip: 'Sativa-dominant plants tend to stretch more. Consider topping early to control height and promote bushier growth.',
      isEducational: true,
    },
    {
      phase: 'flower',
      taskType: 'monitor',
      tip: 'Sativa-dominant strains typically have longer flowering times. Be patient and monitor trichome development closely.',
      isEducational: true,
    },
  ];
}

/**
 * Get indica-lean tips
 */
function getIndicaTips(): StrainTip[] {
  return [
    {
      phase: 'veg',
      taskType: 'train',
      tip: 'Indica-dominant plants grow bushier and shorter. Focus on defoliation to improve light penetration.',
      isEducational: true,
    },
    {
      phase: 'flower',
      taskType: 'monitor',
      tip: 'Indica-dominant strains typically finish flowering faster. Watch for dense bud formation and potential mold issues.',
      isEducational: true,
    },
  ];
}

/**
 * Get strain-specific tips for task descriptions
 * All tips are educational and non-commercial
 */
export function getStrainSpecificTips(
  strainCharacteristics?: GrowCharacteristics
): StrainTip[] {
  if (!strainCharacteristics) {
    return [];
  }

  const tips: StrainTip[] = [];
  const { strain_type, strain_lean } = strainCharacteristics;

  if (strain_type === 'autoflower') {
    tips.push(...getAutoflowerTips());
  }

  if (strain_type === 'photoperiod') {
    tips.push(...getPhotoperiodTips());
  }

  if (strain_lean === 'sativa') {
    tips.push(...getSativaTips());
  }

  if (strain_lean === 'indica') {
    tips.push(...getIndicaTips());
  }

  return tips;
}

/**
 * Customize playbook steps with strain-specific guidance
 */
export function customizePlaybookForStrain(
  playbook: Playbook,
  strainCharacteristics?: GrowCharacteristics
): Playbook {
  const phaseDurations = calculatePhaseDurations(strainCharacteristics);
  const strainTips = getStrainSpecificTips(strainCharacteristics);

  // Create a map of tips by phase and task type for quick lookup
  const tipMap = new Map<string, string>();
  strainTips.forEach((tip) => {
    const key = `${tip.phase}:${tip.taskType}`;
    tipMap.set(key, tip.tip);
  });

  // Customize steps with strain-specific tips
  const customizedSteps: PlaybookStep[] = playbook.steps.map((step) => {
    const tipKey = `${step.phase}:${step.taskType}`;
    const strainTip = tipMap.get(tipKey);

    if (strainTip) {
      // Append strain-specific tip to description
      const enhancedDescription = step.descriptionIcu
        ? `${step.descriptionIcu}\n\n💡 Strain Tip: ${strainTip}`
        : `💡 Strain Tip: ${strainTip}`;

      return {
        ...step,
        descriptionIcu: enhancedDescription,
      };
    }

    return step;
  });

  // Update metadata with strain-specific information
  const customizedMetadata = {
    ...playbook.metadata,
    estimatedDuration: Math.ceil(
      (phaseDurations.seedling +
        phaseDurations.veg +
        phaseDurations.flower +
        phaseDurations.harvest) /
        7
    ),
    strainTypes: strainCharacteristics?.strain_type
      ? [strainCharacteristics.strain_type]
      : playbook.metadata.strainTypes,
  };

  return {
    ...playbook,
    steps: customizedSteps,
    metadata: customizedMetadata,
  };
}

/**
 * Generate assumptions chip data for UI display
 */
export function getAssumptionsChipData(assumptions: StrainAssumptions): {
  show: boolean;
  label: string;
  message: string;
} {
  if (!assumptions.usedDefaults) {
    return {
      show: false,
      label: '',
      message: '',
    };
  }

  return {
    show: true,
    label: 'Using Defaults',
    message: assumptions.message,
  };
}

/**
 * Educational disclaimer for strain guidance
 */
export const STRAIN_GUIDANCE_DISCLAIMER =
  'Strain-specific guidance is educational and based on general growing characteristics. ' +
  'Individual plants may vary. Always monitor your plants and adjust care as needed. ' +
  'This is not professional advice.';
