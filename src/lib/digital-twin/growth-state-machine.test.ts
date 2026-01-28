import { PlantEventKind } from '@/lib/plants/plant-event-kinds';

import { getNextStageCandidate } from './growth-state-machine';
import type { TwinState } from './twin-types';

function createBaseState(overrides: Partial<TwinState> = {}): TwinState {
  const now = new Date('2024-01-10T10:00:00Z');
  return {
    profile: {
      plantId: 'plant-1',
      stage: 'germination',
      stageEnteredAt: now,
      plantedAt: new Date('2024-01-01T10:00:00Z'),
      environment: 'indoor',
      photoperiodType: 'photoperiod',
      geneticLean: 'balanced',
      medium: 'soil',
      potSizeLiters: 10,
      floweringDays: 56,
      timezone: 'UTC',
    },
    stage: 'germination',
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

describe('growth-state-machine', () => {
  it('advances from germination to seedling on sprout event', () => {
    const state = createBaseState({
      stage: 'germination',
      signals: {
        events: [
          {
            id: 'event-1',
            plantId: 'plant-1',
            kind: PlantEventKind.SPROUT_CONFIRMED,
            occurredAt: Date.now(),
          },
        ],
        latestTrichomeAssessment: null,
        latestDiagnostic: null,
      },
    });

    const result = getNextStageCandidate(state);
    expect(result?.nextStage).toBe('seedling');
    expect(result?.triggeredBy).toBe(PlantEventKind.SPROUT_CONFIRMED);
  });

  it('advances vegetative photoperiod plants on light cycle switch', () => {
    const state = createBaseState({
      stage: 'vegetative',
      profile: {
        ...createBaseState().profile,
        stage: 'vegetative',
        photoperiodType: 'photoperiod',
      },
      signals: {
        events: [
          {
            id: 'event-2',
            plantId: 'plant-1',
            kind: PlantEventKind.LIGHT_CYCLE_SWITCHED,
            occurredAt: Date.now(),
          },
        ],
        latestTrichomeAssessment: null,
        latestDiagnostic: null,
      },
    });

    const result = getNextStageCandidate(state);
    expect(result?.nextStage).toBe('flowering_stretch');
    expect(result?.triggeredBy).toBe(PlantEventKind.LIGHT_CYCLE_SWITCHED);
  });

  it('advances to harvesting when trichomes indicate harvest window', () => {
    const state = createBaseState({
      stage: 'ripening',
      profile: {
        ...createBaseState().profile,
        stage: 'ripening',
      },
      signals: {
        events: [],
        latestTrichomeAssessment: {
          id: 'trichome-1',
          plantId: 'plant-1',
          createdAt: new Date().toISOString(),
          assessmentDate: new Date().toISOString(),
          clearPercent: 10,
          milkyPercent: 80,
          amberPercent: 10,
        },
        latestDiagnostic: null,
      },
    });

    const result = getNextStageCandidate(state);
    expect(result?.nextStage).toBe('harvesting');
    expect(result?.triggeredBy).toBe('trichomes');
  });

  it('advances to curing when harvest is completed', () => {
    const state = createBaseState({
      stage: 'harvesting',
      profile: {
        ...createBaseState().profile,
        stage: 'harvesting',
      },
      signals: {
        events: [
          {
            id: 'event-3',
            plantId: 'plant-1',
            kind: PlantEventKind.HARVEST_COMPLETED,
            occurredAt: Date.now(),
          },
        ],
        latestTrichomeAssessment: null,
        latestDiagnostic: null,
      },
    });

    const result = getNextStageCandidate(state);
    expect(result?.nextStage).toBe('curing');
    expect(result?.triggeredBy).toBe(PlantEventKind.HARVEST_COMPLETED);
  });
});
