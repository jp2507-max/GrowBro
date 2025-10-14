/**
 * Offline Playbook Data
 * Static correction guidance for common pH/EC issues
 * Available without network connectivity
 */

export type PlaybookCategory =
  | 'ph_high'
  | 'ph_low'
  | 'ec_high'
  | 'ec_low'
  | 'calibration'
  | 'temp_issues';

export type PlaybookEntry = {
  id: string;
  category: PlaybookCategory;
  title: string;
  symptoms: string[];
  causes: string[];
  steps: {
    order: number;
    instruction: string;
    warning?: string;
  }[];
  tips: string[];
  disclaimer: string;
};

/**
 * Static playbook entries for offline access
 */
export const PLAYBOOKS: Record<PlaybookCategory, PlaybookEntry> = {
  ph_high: {
    id: 'ph_high',
    category: 'ph_high',
    title: 'pH Too High (Above Target Range)',
    symptoms: [
      'pH reading above 6.5-7.0 in soilless media',
      'Nutrient lockout symptoms appearing',
      'Micronutrient deficiencies (iron, manganese)',
    ],
    causes: [
      'High alkalinity in source water',
      'Too much pH Up added previously',
      'Media buffering capacity exhausted',
      'Nutrient solution too dilute',
    ],
    steps: [
      {
        order: 1,
        instruction:
          'Verify pH reading with fresh calibrated meter (buffers 4.0, 7.0, 10.0)',
      },
      {
        order: 2,
        instruction:
          'Check source water alkalinity (>100 mg/L CaCO₃ can cause drift)',
        warning: 'High alkalinity requires ongoing pH management',
      },
      {
        order: 3,
        instruction:
          'Add pH Down solution slowly in small increments (start with 0.5 mL per gallon)',
      },
      {
        order: 4,
        instruction:
          'Mix thoroughly and wait 15-30 minutes before re-measuring',
        warning: 'pH adjusters take time to react fully',
      },
      {
        order: 5,
        instruction: 'Re-check pH and repeat if needed with smaller doses',
      },
      {
        order: 6,
        instruction: 'Log adjustment in reservoir events for trend tracking',
      },
    ],
    tips: [
      'Adjust pH before adding nutrients for more stable results',
      'Consider acidifying amendments if source water alkalinity is high',
      'Monitor pH drift over 24 hours to understand water chemistry',
      'Use phosphoric acid-based pH Down for added phosphorus benefit',
    ],
    disclaimer:
      'This guidance is educational only. Always follow product labels and adjust conservatively. Consult experienced growers or agronomists for persistent issues.',
  },

  ph_low: {
    id: 'ph_low',
    category: 'ph_low',
    title: 'pH Too Low (Below Target Range)',
    symptoms: [
      'pH reading below 5.2-5.5 in soilless media',
      'Phosphorus, calcium, magnesium lockout',
      'Leaf tip burn or necrosis',
    ],
    causes: [
      'Too much pH Down added',
      'Acidic nutrients or additives',
      'Organic matter decomposition in media',
      'Root zone microbial activity',
    ],
    steps: [
      {
        order: 1,
        instruction: 'Verify pH reading with calibrated meter',
      },
      {
        order: 2,
        instruction: 'Add pH Up solution slowly (start with 0.5 mL per gallon)',
        warning: 'pH Up raises pH more aggressively than pH Down lowers it',
      },
      {
        order: 3,
        instruction: 'Mix well and wait 15-30 minutes',
      },
      {
        order: 4,
        instruction: 'Re-measure and adjust incrementally as needed',
      },
      {
        order: 5,
        instruction: 'Flush reservoir/media if pH drop is severe (< 4.5)',
      },
    ],
    tips: [
      'Small doses of pH Up go a long way',
      'Consider potassium silicate as pH Up alternative (adds silicon)',
      'Monitor root zone pH separately from reservoir pH',
      'Check for over-acidic additives in nutrient regimen',
    ],
    disclaimer:
      'Educational guidance only. Adjust conservatively and monitor plant response. Seek expert advice for recurring pH issues.',
  },

  ec_high: {
    id: 'ec_high',
    category: 'ec_high',
    title: 'EC/PPM Too High (Nutrient Burn Risk)',
    symptoms: [
      'EC above target range for growth stage',
      'Leaf tip burn',
      'Dark green leaves',
      'Slowed growth or wilting',
    ],
    causes: [
      'Too much nutrient added',
      'Insufficient dilution',
      'Water evaporation concentrating solution',
      'Nutrient accumulation in media',
    ],
    steps: [
      {
        order: 1,
        instruction:
          'Verify EC reading with calibrated meter (1.413 or 12.88 mS/cm buffer)',
      },
      {
        order: 2,
        instruction:
          'Check temperature compensation (readings normalized to 25°C)',
      },
      {
        order: 3,
        instruction:
          'Dilute solution by adding plain water (start with 10-20% of reservoir volume)',
        warning: 'Re-check pH after dilution and adjust if needed',
      },
      {
        order: 4,
        instruction: 'Mix thoroughly and measure EC again after 30 minutes',
      },
      {
        order: 5,
        instruction: 'For severe cases, perform partial reservoir change',
      },
      {
        order: 6,
        instruction: 'Reduce nutrient concentration in next feeding',
      },
    ],
    tips: [
      'Keep track of daily water consumption vs. top-off additions',
      'Increase dilution gradually to avoid osmotic shock',
      'Monitor plant response for 24-48 hours after adjustment',
      'Consider flushing media if EC remains high despite reservoir dilution',
    ],
    disclaimer:
      'Educational guidance. Follow conservative dose adjustments and monitor plant health. Consult growing communities or experts for persistent issues.',
  },

  ec_low: {
    id: 'ec_low',
    category: 'ec_low',
    title: 'EC/PPM Too Low (Nutrient Deficiency Risk)',
    symptoms: [
      'EC below target range for growth stage',
      'Pale or yellowing leaves',
      'Slow growth',
      'Weak stems',
    ],
    causes: [
      'Insufficient nutrients added',
      'Over-dilution',
      'Rapid plant uptake without replenishment',
      'Nutrient solution too old',
    ],
    steps: [
      {
        order: 1,
        instruction: 'Verify EC reading with calibrated meter',
      },
      {
        order: 2,
        instruction: 'Check source water baseline EC (should be subtracted)',
      },
      {
        order: 3,
        instruction:
          'Add nutrients gradually (10-20% of recommended dose per increment)',
        warning: 'Mix thoroughly between additions and wait 15 minutes',
      },
      {
        order: 4,
        instruction: 'Re-measure EC after mixing and stabilization',
      },
      {
        order: 5,
        instruction: 'Repeat small additions until target range reached',
      },
      {
        order: 6,
        instruction: 'Log nutrient addition in reservoir events',
      },
    ],
    tips: [
      'Build EC slowly to avoid overshooting target',
      'Track nutrient consumption rate for future feeding planning',
      'Consider reservoir change if solution is >10-14 days old',
      'Balance macro and micronutrients per growth stage requirements',
    ],
    disclaimer:
      'Educational content only. Use conservative dosing and verify with plant response. Seek guidance from experienced growers for optimal feeding strategies.',
  },

  calibration: {
    id: 'calibration',
    category: 'calibration',
    title: 'Meter Calibration & Maintenance',
    symptoms: [
      'Readings seem inaccurate or drifting',
      'Calibration is >30 days old',
      'Meter stored dry or in tap water',
    ],
    causes: [
      'Stale calibration',
      'Dried probe',
      'Contaminated storage solution',
      'Probe degradation',
    ],
    steps: [
      {
        order: 1,
        instruction: 'Rinse probe with distilled water and blot dry',
      },
      {
        order: 2,
        instruction:
          'For pH: calibrate with 7.0 buffer (mid-point), then 4.0 and/or 10.0',
        warning: 'Use fresh calibration buffers (<6 months old)',
      },
      {
        order: 3,
        instruction:
          'For EC: calibrate with 1.413 mS/cm (or 12.88 mS/cm) buffer at 25°C',
      },
      {
        order: 4,
        instruction: 'Allow 30-60 seconds stabilization time in each buffer',
      },
      {
        order: 5,
        instruction:
          'Store probe in proper storage solution (not distilled water)',
      },
      {
        order: 6,
        instruction: 'Log calibration date, slope, and offset in app',
      },
    ],
    tips: [
      'Calibrate pH meters every 2-4 weeks for best accuracy',
      'EC meters need calibration less frequently (monthly)',
      'Replace probe if slope is <85% or >105% of ideal',
      'Never store pH probes dry - keep in KCl storage solution',
    ],
    disclaimer:
      'Follow meter manufacturer guidelines. This is general educational guidance only.',
  },

  temp_issues: {
    id: 'temp_issues',
    category: 'temp_issues',
    title: 'Temperature & ATC Issues',
    symptoms: [
      'Solution temperature >28°C',
      'Readings fluctuate with temperature changes',
      'ATC not functioning',
    ],
    causes: [
      'High ambient temperature',
      'No temperature compensation',
      'Faulty temperature probe',
      'Manual readings without temperature tracking',
    ],
    steps: [
      {
        order: 1,
        instruction:
          'Check if meter has ATC (Automatic Temperature Compensation)',
      },
      {
        order: 2,
        instruction:
          'If no ATC, record temperature and apply compensation manually',
        warning: 'EC changes ~2% per °C away from 25°C reference',
      },
      {
        order: 3,
        instruction: 'Cool reservoir/solution if temp >28°C (root health risk)',
      },
      {
        order: 4,
        instruction: 'Take readings at consistent temperature when possible',
      },
      {
        order: 5,
        instruction: 'Log temperature with every pH/EC reading',
      },
    ],
    tips: [
      'Ideal solution temperature: 18-22°C for most crops',
      'High temps reduce dissolved oxygen and increase pathogen risk',
      'Use chillers, frozen water bottles, or insulation to manage temp',
      'App automatically compensates EC to 25°C when temperature logged',
    ],
    disclaimer:
      'Temperature management is critical for root health. Consult growing resources for optimal ranges per crop.',
  },
};

/**
 * Get playbook by category
 */
export function getPlaybook(category: PlaybookCategory): PlaybookEntry {
  return PLAYBOOKS[category];
}

/**
 * Get all playbook categories
 */
export function getPlaybookCategories(): PlaybookCategory[] {
  return Object.keys(PLAYBOOKS) as PlaybookCategory[];
}

/**
 * Search playbooks by keyword
 */
export function searchPlaybooks(keyword: string): PlaybookEntry[] {
  const lowerKeyword = keyword.toLowerCase();
  return Object.values(PLAYBOOKS).filter(
    (playbook) =>
      playbook.title.toLowerCase().includes(lowerKeyword) ||
      playbook.symptoms.some((s) => s.toLowerCase().includes(lowerKeyword)) ||
      playbook.causes.some((c) => c.toLowerCase().includes(lowerKeyword))
  );
}
