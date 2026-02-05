import { getCuringIntents } from '@/lib/digital-twin/engines/curing-engine';
import { getEnvironmentIntents } from '@/lib/digital-twin/engines/environment-engine';
import { getHydrologyIntents } from '@/lib/digital-twin/engines/hydrology-engine';
import { getNutritionIntents } from '@/lib/digital-twin/engines/nutrition-engine';
import type { TwinState } from '@/lib/digital-twin/twin-types';
import { PlantEventKind } from '@/lib/plants/plant-event-kinds';

const now = new Date('2024-01-10T10:00:00Z');

type DrynessPayloadInput = {
  severity: 'mild' | 'moderate' | 'severe';
  topDry: 'yes' | 'no' | 'unsure';
  wateredLast12h: 'yes' | 'no' | 'unsure';
};

function buildDrynessPayload(
  input: DrynessPayloadInput
): Record<string, unknown> {
  return { symptom: 'dryness', ...input };
}

function createDrynessEvent(params: {
  id: string;
  occurredAt: number;
  payload: DrynessPayloadInput;
}) {
  return {
    id: params.id,
    plantId: 'plant-1',
    kind: PlantEventKind.SYMPTOM_LOGGED,
    occurredAt: params.occurredAt,
    payload: buildDrynessPayload(params.payload),
  };
}

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
  it('creates overdue watering intent for soil', async () => {
    const state = createBaseState({
      profile: {
        ...createBaseState().profile,
        medium: 'soil',
        lastWateredAt: new Date('2023-12-31T10:00:00Z'),
      },
    });

    const intents = await getHydrologyIntents(state);
    const keys = intents.map((intent) => intent.engineKey);
    expect(keys).toContain('hydrology.check_water_need');
    expect(keys).toContain('hydrology.water_now.overdue');
  });

  it('creates twice-daily coco fertigation intents', async () => {
    const state = createBaseState({
      profile: {
        ...createBaseState().profile,
        medium: 'coco',
      },
    });

    const intents = await getHydrologyIntents(state);
    const keys = intents.map((intent) => intent.engineKey);
    expect(keys).toContain('hydrology.fertigate.coco.morning');
    expect(keys).toContain('hydrology.fertigate.coco.evening');
    expect(keys).not.toContain('hydrology.check_water_need.coco');
  });

  it('creates water-now intent for dryness check-ins', async () => {
    const event = createDrynessEvent({
      id: 'event-1',
      occurredAt: now.getTime() - 60 * 60 * 1000,
      payload: {
        severity: 'moderate',
        topDry: 'yes',
        wateredLast12h: 'no',
      },
    });
    const base = createBaseState();
    const state = createBaseState({
      signals: {
        ...base.signals,
        events: [event],
      },
    });

    const intents = await getHydrologyIntents(state, now);
    const waterNow = intents.find(
      (intent) => intent.engineKey === 'hydrology.water_now.symptom_dryness'
    );
    expect(waterNow).toBeTruthy();
    expect(waterNow?.count).toBe(1);
    expect(waterNow?.metadata?.sourceEventId).toBe('event-1');
  });

  it('creates check-water-need intent when answers are unsure', async () => {
    const event = createDrynessEvent({
      id: 'event-2',
      occurredAt: now.getTime() - 2 * 60 * 60 * 1000,
      payload: {
        severity: 'mild',
        topDry: 'yes',
        wateredLast12h: 'unsure',
      },
    });
    const base = createBaseState();
    const state = createBaseState({
      signals: {
        ...base.signals,
        events: [event],
      },
    });

    const intents = await getHydrologyIntents(state, now);
    const keys = intents.map((intent) => intent.engineKey);
    expect(keys).toContain('hydrology.check_water_need.symptom_dryness');
  });

  it('skips invalid dryness event timestamps and uses next valid event', async () => {
    const invalidEvent = createDrynessEvent({
      id: 'event-invalid',
      occurredAt: Number.NaN,
      payload: {
        severity: 'moderate',
        topDry: 'yes',
        wateredLast12h: 'no',
      },
    });
    const validEvent = createDrynessEvent({
      id: 'event-valid',
      occurredAt: now.getTime() - 3 * 60 * 60 * 1000,
      payload: {
        severity: 'moderate',
        topDry: 'yes',
        wateredLast12h: 'no',
      },
    });
    const base = createBaseState();
    const state = createBaseState({
      signals: {
        ...base.signals,
        events: [invalidEvent, validEvent],
      },
    });

    const intents = await getHydrologyIntents(state, now);
    const waterNow = intents.find(
      (intent) => intent.engineKey === 'hydrology.water_now.symptom_dryness'
    );
    expect(waterNow?.metadata?.sourceEventId).toBe('event-valid');
  });

  it('creates climate check triage intent for dryness when watered recently', () => {
    jest.useFakeTimers();
    jest.setSystemTime(now);

    try {
      const event = createDrynessEvent({
        id: 'event-3',
        occurredAt: now.getTime() - 60 * 60 * 1000,
        payload: {
          severity: 'mild',
          topDry: 'yes',
          wateredLast12h: 'yes',
        },
      });
      const base = createBaseState();
      const state = createBaseState({
        signals: {
          ...base.signals,
          events: [event],
        },
      });

      const intents = getEnvironmentIntents(state);
      const keys = intents.map((intent) => intent.engineKey);
      expect(keys).toContain('environment.climate_check.symptom_dryness');
    } finally {
      jest.useRealTimers();
    }
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
