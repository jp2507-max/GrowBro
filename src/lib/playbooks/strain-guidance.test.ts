/**
 * Tests for Strain-Specific Guidance System
 */

import type { Playbook } from '@/types/playbook';
import type { GrowCharacteristics } from '@/types/strains';

import {
  calculatePhaseDurations,
  customizePlaybookForStrain,
  getAssumptionsChipData,
  getStrainSpecificTips,
  STRAIN_GUIDANCE_DISCLAIMER,
} from './strain-guidance';

// Test data helpers
const createAutoflowerCharacteristics = (): GrowCharacteristics => ({
  difficulty: 'beginner',
  indoor_suitable: true,
  outdoor_suitable: false,
  flowering_time: { min_weeks: 8, max_weeks: 10 },
  yield: {},
  height: {},
  strain_type: 'autoflower',
});

const createPhotoperiodCharacteristics = (): GrowCharacteristics => ({
  difficulty: 'intermediate',
  indoor_suitable: true,
  outdoor_suitable: false,
  flowering_time: { min_weeks: 8, max_weeks: 10 },
  yield: {},
  height: {},
  strain_type: 'photoperiod',
});

const createCharacteristicsWithBreederRange = (
  source?: string
): GrowCharacteristics => ({
  difficulty: 'intermediate',
  indoor_suitable: true,
  outdoor_suitable: false,
  flowering_time: { min_weeks: 8, max_weeks: 10 },
  yield: {},
  height: {},
  strain_type: 'photoperiod',
  breeder_flowering_range: {
    min_weeks: 9,
    max_weeks: 11,
    source,
  },
});

describe('calculatePhaseDurations', () => {
  test('returns photoperiod defaults when no strain characteristics provided', () => {
    const result = calculatePhaseDurations();

    expect(result.seedling).toBe(14);
    expect(result.veg).toBe(42);
    expect(result.flower).toBe(56);
    expect(result.harvest).toBe(21);
    expect(result.assumptions.usedDefaults).toBe(true);
    expect(result.assumptions.assumedStrainType).toBe('photoperiod');
    expect(result.assumptions.message).toContain('photoperiod defaults');
  });

  test('returns autoflower defaults without breeder range', () => {
    const characteristics = createAutoflowerCharacteristics();
    const result = calculatePhaseDurations(characteristics);

    expect(result.seedling).toBe(7);
    expect(result.veg).toBe(21);
    expect(result.flower).toBe(49);
    expect(result.harvest).toBe(14);
    expect(result.assumptions.usedDefaults).toBe(true);
    expect(result.assumptions.assumedStrainType).toBe('autoflower');
  });

  test('uses breeder flowering range when provided', () => {
    const characteristics = createCharacteristicsWithBreederRange('FastBuds');
    const result = calculatePhaseDurations(characteristics);

    expect(result.flower).toBe(70); // Average of 9-11 weeks = 70 days
    expect(result.assumptions.usedDefaults).toBe(false);
    expect(result.assumptions.message).toContain('FastBuds');
    expect(result.assumptions.message).toContain('9-11 weeks');
  });

  test('calculates average flowering time correctly', () => {
    const characteristics = createCharacteristicsWithBreederRange();
    characteristics.breeder_flowering_range = {
      min_weeks: 8,
      max_weeks: 10,
    };

    const result = calculatePhaseDurations(characteristics);
    expect(result.flower).toBe(63); // Average of 8-10 weeks = 63 days
  });
});

describe('getStrainSpecificTips - Basic', () => {
  test('returns empty array when no strain characteristics provided', () => {
    const tips = getStrainSpecificTips();
    expect(tips).toEqual([]);
  });

  test('returns autoflower-specific tips', () => {
    const characteristics = createAutoflowerCharacteristics();
    const tips = getStrainSpecificTips(characteristics);

    expect(tips.length).toBeGreaterThan(0);
    expect(tips.every((tip) => tip.isEducational)).toBe(true);

    const wateringTip = tips.find(
      (t) => t.phase === 'seedling' && t.taskType === 'water'
    );
    expect(wateringTip).toBeDefined();
    expect(wateringTip?.tip).toContain('Autoflowers');
  });

  test('returns photoperiod-specific tips', () => {
    const characteristics = createPhotoperiodCharacteristics();
    const tips = getStrainSpecificTips(characteristics);

    expect(tips.length).toBeGreaterThan(0);
    const trainingTip = tips.find(
      (t) => t.phase === 'veg' && t.taskType === 'train'
    );
    expect(trainingTip).toBeDefined();
    expect(trainingTip?.tip).toContain('Photoperiods');
  });
});

describe('getStrainSpecificTips - Lean', () => {
  test('returns sativa-lean tips', () => {
    const characteristics = createPhotoperiodCharacteristics();
    characteristics.strain_lean = 'sativa';

    const tips = getStrainSpecificTips(characteristics);

    expect(tips.length).toBeGreaterThan(0);
    const sativaTip = tips.find((t) => t.tip.includes('Sativa'));
    expect(sativaTip).toBeDefined();
  });

  test('returns indica-lean tips', () => {
    const characteristics = createAutoflowerCharacteristics();
    characteristics.strain_lean = 'indica';

    const tips = getStrainSpecificTips(characteristics);

    expect(tips.length).toBeGreaterThan(0);
    const indicaTip = tips.find((t) => t.tip.includes('Indica'));
    expect(indicaTip).toBeDefined();
  });
});

describe('getStrainSpecificTips - Combined', () => {
  test('combines multiple tip types for complex strains', () => {
    const characteristics = createAutoflowerCharacteristics();
    characteristics.strain_lean = 'sativa';

    const tips = getStrainSpecificTips(characteristics);

    const autoflowerTips = tips.filter((t) => t.tip.includes('Autoflower'));
    const sativaTips = tips.filter((t) => t.tip.includes('Sativa'));

    expect(autoflowerTips.length).toBeGreaterThan(0);
    expect(sativaTips.length).toBeGreaterThan(0);
  });

  test('all tips are marked as educational', () => {
    const characteristics = createAutoflowerCharacteristics();
    characteristics.strain_lean = 'indica';

    const tips = getStrainSpecificTips(characteristics);

    tips.forEach((tip) => {
      expect(tip.isEducational).toBe(true);
    });
  });
});

// Mock playbook for testing
const createMockPlaybook = (): Playbook => ({
  id: 'test-playbook',
  name: 'Test Playbook',
  setup: 'auto_indoor',
  locale: 'en',
  phaseOrder: ['seedling', 'veg', 'flower', 'harvest'],
  steps: [
    {
      id: 'step-1',
      phase: 'seedling',
      title: 'Water seedling',
      descriptionIcu: 'Water your seedling gently',
      relativeDay: 1,
      defaultReminderLocal: '08:00',
      taskType: 'water',
      dependencies: [],
    },
    {
      id: 'step-2',
      phase: 'veg',
      title: 'Train plant',
      descriptionIcu: 'Apply LST techniques',
      relativeDay: 14,
      defaultReminderLocal: '10:00',
      taskType: 'train',
      dependencies: [],
    },
  ],
  metadata: {},
  isTemplate: true,
  isCommunity: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

describe('customizePlaybookForStrain', () => {
  test('returns playbook unchanged when no strain characteristics', () => {
    const mockPlaybook = createMockPlaybook();
    const result = customizePlaybookForStrain(mockPlaybook);

    expect(result.steps.length).toBe(mockPlaybook.steps.length);
    expect(result.steps[0].descriptionIcu).toBe(
      mockPlaybook.steps[0].descriptionIcu
    );
  });

  test('adds strain-specific tips to relevant steps', () => {
    const mockPlaybook = createMockPlaybook();
    const characteristics = createAutoflowerCharacteristics();
    const result = customizePlaybookForStrain(mockPlaybook, characteristics);

    const wateringStep = result.steps.find((s) => s.taskType === 'water');
    expect(wateringStep?.descriptionIcu).toContain('💡 Strain Tip:');
    expect(wateringStep?.descriptionIcu).toContain('Autoflowers');

    const trainingStep = result.steps.find((s) => s.taskType === 'train');
    expect(trainingStep?.descriptionIcu).toContain('💡 Strain Tip:');
  });

  test('updates metadata with estimated duration', () => {
    const mockPlaybook = createMockPlaybook();
    const characteristics = createAutoflowerCharacteristics();
    const result = customizePlaybookForStrain(mockPlaybook, characteristics);

    expect(result.metadata.estimatedDuration).toBeDefined();
    expect(result.metadata.estimatedDuration).toBeGreaterThan(0);
  });

  test('updates metadata with strain types', () => {
    const mockPlaybook = createMockPlaybook();
    const characteristics = createPhotoperiodCharacteristics();
    const result = customizePlaybookForStrain(mockPlaybook, characteristics);

    expect(result.metadata.strainTypes).toContain('photoperiod');
  });
});

describe('getAssumptionsChipData', () => {
  test('returns show=false when no defaults used', () => {
    const assumptions = {
      usedDefaults: false,
      message: 'Using breeder data',
    };

    const result = getAssumptionsChipData(assumptions);

    expect(result.show).toBe(false);
  });

  test('returns chip data when defaults used', () => {
    const assumptions = {
      usedDefaults: true,
      assumedStrainType: 'photoperiod' as const,
      message: 'Using conservative photoperiod defaults',
    };

    const result = getAssumptionsChipData(assumptions);

    expect(result.show).toBe(true);
    expect(result.label).toBe('Using Defaults');
    expect(result.message).toBe(assumptions.message);
  });
});

describe('STRAIN_GUIDANCE_DISCLAIMER', () => {
  test('contains educational disclaimer', () => {
    expect(STRAIN_GUIDANCE_DISCLAIMER).toContain('educational');
    expect(STRAIN_GUIDANCE_DISCLAIMER).toContain('not professional advice');
  });

  test('is non-commercial', () => {
    expect(STRAIN_GUIDANCE_DISCLAIMER.toLowerCase()).not.toContain('buy');
    expect(STRAIN_GUIDANCE_DISCLAIMER.toLowerCase()).not.toContain('purchase');
    expect(STRAIN_GUIDANCE_DISCLAIMER.toLowerCase()).not.toContain('product');
  });
});
