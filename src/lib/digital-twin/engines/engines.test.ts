import { getCuringIntents } from '@/lib/digital-twin/engines/curing-engine';
import { getEnvironmentIntents } from '@/lib/digital-twin/engines/environment-engine';
import { getHydrologyIntents } from '@/lib/digital-twin/engines/hydrology-engine';
import { getNutritionIntents } from '@/lib/digital-twin/engines/nutrition-engine';
import type { TwinState } from '@/lib/digital-twin/twin-types';

const now = new Date('2024-01-10T10:00:00Z');

function createBaseState(overrides: Partial<TwinState> = {}): TwinState {
  return {
    profile: {
      plantId: 'plant-1',
      stage: 'seedling',
      stageEnteredAt: now,
      plantedAt: new Date('2024-01-01T10:00:00Z'),
      environment: 'indoor',
      photoperiodType: 'photoperiod',
      geneticLean: 'balanced',
      medium: 'soil',
      potSizeLiters: 10,
      floweringDays: 56,
      timezone: 'UTC',
      heightCm: 25,
      lastWateredAt: new Date('2024-01-01T10:00:00Z'),
      lastFedAt: new Date('2024-01-05T10:00:00Z'),
    },
    stage: 'seedling',
    stageEnteredAt: now,
    dayInStage: 3,
    dayFromPlanting: 9,
    transition: null,
    signals: {
      events: [],
      latestTrichomeAssessment: null,
      latestDiagnostic: null,
    },
    ...overrides,
  };
}

describe('digital-twin engines', () => {
  it('creates overdue watering intent for soil', () => {
    const state = createBaseState({
      profile: {
        ...createBaseState().profile,
        medium: 'soil',
        lastWateredAt: new Date('2023-12-31T10:00:00Z'),
      },
    });

    const intents = getHydrologyIntents(state);
    const keys = intents.map((intent) => intent.engineKey);
    expect(keys).toContain('hydrology.check_water_need');
    expect(keys).toContain('hydrology.water_now.overdue');
  });

  it('creates twice-daily coco fertigation intents', () => {
    const state = createBaseState({
      profile: {
        ...createBaseState().profile,
        medium: 'coco',
      },
    });

    const intents = getHydrologyIntents(state);
    const keys = intents.map((intent) => intent.engineKey);
    expect(keys).toContain('hydrology.fertigate.coco.morning');
    expect(keys).toContain('hydrology.fertigate.coco.evening');
    expect(keys).not.toContain('hydrology.check_water_need.coco');
  });

  it('creates biological IPM tasks in flower', () => {
    const state = createBaseState({
      stage: 'flowering',
      profile: {
        ...createBaseState().profile,
        stage: 'flowering',
      },
    });

    const intents = getEnvironmentIntents(state);
    const keys = intents.map((intent) => intent.engineKey);
    expect(keys).toContain('environment.ipm_biological');
    expect(keys).not.toContain('environment.ipm_preventative');
  });

  it('creates ramped nutrition descriptions', async () => {
    const state = createBaseState({
      stage: 'vegetative',
      dayInStage: 5,
      profile: {
        ...createBaseState().profile,
        stage: 'vegetative',
        medium: 'soil',
      },
    });

    const intents = await getNutritionIntents(state);
    const feed = intents.find(
      (intent) => intent.engineKey === 'nutrition.feed_plant'
    );
    expect(feed?.description).toContain('%');
  });

  it('builds curing schedule with week1/2/3 intents', () => {
    const state = createBaseState({
      stage: 'curing',
      profile: {
        ...createBaseState().profile,
        stage: 'curing',
      },
    });

    const intents = getCuringIntents(state);
    const keys = intents.map((intent) => intent.engineKey);
    expect(keys).toContain('curing.burp.week1.morning');
    expect(keys).toContain('curing.burp.week1.evening');
    expect(keys).toContain('curing.burp.week2');
    expect(keys).toContain('curing.burp.week3plus');
  });
});
