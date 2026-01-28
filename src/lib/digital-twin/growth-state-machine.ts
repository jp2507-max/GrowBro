import type { PlantStage } from '@/api/plants/types';
import {
  AUTOFLOWER_NUDGE_START_DAY,
  STEM_SNAP_CHECK_DAYS,
} from '@/lib/growbro-task-engine/types';
import i18n from '@/lib/i18n';

import {
  PlantEventKind,
  type PlantEventKindValue,
} from '../plants/plant-event-kinds';
import type { TwinSignals, TwinState } from './twin-types';

const STAGE_ORDER: PlantStage[] = [
  'germination',
  'seedling',
  'vegetative',
  'flowering_stretch',
  'flowering',
  'ripening',
  'harvesting',
  'curing',
  'ready',
];

const SEEDLING_TO_VEG_DAYS = 14;
const AUTOFLOWER_GRACE_DAYS = 7;
const CURING_COMPLETE_DAYS = 21;

const ALLOWED_TRANSITIONS: Record<PlantStage, PlantStage[]> = {
  germination: ['seedling'],
  seedling: ['vegetative'],
  vegetative: ['flowering_stretch'],
  flowering_stretch: ['flowering'],
  flowering: ['ripening'],
  ripening: ['harvesting'],
  harvesting: ['curing'],
  curing: ['ready'],
  ready: [],
};

function hasEvent(signals: TwinSignals, kind: string): boolean {
  return signals.events.some((event) => event.kind === kind);
}

function getLatestEventPayload(
  signals: TwinSignals,
  kind: string
): Record<string, unknown> | null {
  const match = signals.events.find((event) => event.kind === kind);
  return (match?.payload as Record<string, unknown> | null) ?? null;
}

function getNodeCount(signals: TwinSignals): number | null {
  const payload = getLatestEventPayload(
    signals,
    PlantEventKind.NODE_COUNT_UPDATED
  );
  const value = payload?.nodeCount;
  return typeof value === 'number' ? value : null;
}

function shouldEnterFloweringStretch(state: TwinState): boolean {
  const { profile, dayFromPlanting } = state;
  if (profile.photoperiodType === 'autoflower') {
    return (
      dayFromPlanting >= AUTOFLOWER_NUDGE_START_DAY + AUTOFLOWER_GRACE_DAYS
    );
  }
  return hasEvent(state.signals, PlantEventKind.LIGHT_CYCLE_SWITCHED);
}

function shouldEnterRipening(state: TwinState): boolean {
  const threshold = Math.max(0, state.profile.floweringDays - 14);
  return state.dayInStage >= threshold;
}

function shouldEnterHarvesting(state: TwinState): boolean {
  const assessment = state.signals.latestTrichomeAssessment;
  const milky = assessment?.milkyPercent ?? 0;
  const amber = assessment?.amberPercent ?? 0;
  if (milky >= 70 && amber >= 5) return true;
  return hasEvent(state.signals, PlantEventKind.HARVEST_STARTED);
}

function shouldEnterCuring(state: TwinState): boolean {
  return (
    hasEvent(state.signals, PlantEventKind.HARVEST_COMPLETED) ||
    state.dayInStage >= STEM_SNAP_CHECK_DAYS
  );
}

function shouldEnterReady(state: TwinState): boolean {
  return state.dayInStage >= CURING_COMPLETE_DAYS;
}

function getVegetativeTransition(state: TwinState): {
  nextStage: PlantStage;
  reason: string;
  triggeredBy?: 'time' | PlantEventKindValue | 'trichomes';
} | null {
  if (!shouldEnterFloweringStretch(state)) return null;

  return {
    nextStage: 'flowering_stretch',
    reason:
      state.profile.photoperiodType === 'autoflower'
        ? i18n.t('twin.stageReason.autoflower_grace', {
            day: state.dayFromPlanting,
          })
        : i18n.t('twin.stageReason.light_cycle_switched'),
    triggeredBy:
      state.profile.photoperiodType === 'autoflower'
        ? 'time'
        : PlantEventKind.LIGHT_CYCLE_SWITCHED,
  };
}

type StageTransition = {
  nextStage: PlantStage;
  reason: string;
  triggeredBy?: 'time' | PlantEventKindValue | 'trichomes';
};

function getSeedlingTransition(state: TwinState): StageTransition | null {
  const nodeCount = getNodeCount(state.signals);
  if (nodeCount !== null && nodeCount >= 3) {
    return {
      nextStage: 'vegetative',
      reason: i18n.t('twin.stageReason.node_count'),
      triggeredBy: PlantEventKind.NODE_COUNT_UPDATED,
    };
  }
  if (state.dayInStage >= SEEDLING_TO_VEG_DAYS) {
    return {
      nextStage: 'vegetative',
      reason: i18n.t('twin.stageReason.seedling_time', {
        days: state.dayInStage,
      }),
      triggeredBy: 'time',
    };
  }
  return null;
}

function getHarvestingTransition(state: TwinState): StageTransition | null {
  if (!shouldEnterCuring(state)) return null;

  const isHarvestComplete = hasEvent(
    state.signals,
    PlantEventKind.HARVEST_COMPLETED
  );

  return {
    nextStage: 'curing',
    reason: isHarvestComplete
      ? i18n.t('twin.stageReason.harvest_complete')
      : i18n.t('twin.stageReason.drying_window', {
          days: state.dayInStage,
        }),
    triggeredBy: isHarvestComplete ? PlantEventKind.HARVEST_COMPLETED : 'time',
  };
}

export function isTransitionAllowed(
  fromStage: PlantStage,
  toStage: PlantStage
): boolean {
  if (fromStage === toStage) return false;
  return (ALLOWED_TRANSITIONS[fromStage] ?? []).includes(toStage);
}

export function getStageOrderIndex(stage: PlantStage): number {
  return STAGE_ORDER.indexOf(stage);
}

export function getNextStageCandidate(state: TwinState): {
  nextStage: PlantStage;
  reason: string;
  triggeredBy?: 'time' | PlantEventKindValue | 'trichomes';
} | null {
  switch (state.stage) {
    case 'germination':
      if (hasEvent(state.signals, PlantEventKind.SPROUT_CONFIRMED)) {
        return {
          nextStage: 'seedling',
          reason: i18n.t('twin.stageReason.sprout_confirmed'),
          triggeredBy: PlantEventKind.SPROUT_CONFIRMED,
        };
      }
      return null;
    case 'seedling': {
      return getSeedlingTransition(state);
    }
    case 'vegetative':
      return getVegetativeTransition(state);
    case 'flowering_stretch':
      if (state.dayInStage >= 7) {
        return {
          nextStage: 'flowering',
          reason: i18n.t('twin.stageReason.stretch_complete'),
          triggeredBy: 'time',
        };
      }
      return null;
    case 'flowering':
      if (shouldEnterRipening(state)) {
        return {
          nextStage: 'ripening',
          reason: i18n.t('twin.stageReason.flowering_end'),
          triggeredBy: 'time',
        };
      }
      return null;
    case 'ripening':
      if (shouldEnterHarvesting(state)) {
        return {
          nextStage: 'harvesting',
          reason: i18n.t('twin.stageReason.trichomes'),
          triggeredBy: hasEvent(state.signals, PlantEventKind.HARVEST_STARTED)
            ? PlantEventKind.HARVEST_STARTED
            : 'trichomes',
        };
      }
      return null;
    case 'harvesting':
      return getHarvestingTransition(state);
    case 'curing':
      if (shouldEnterReady(state)) {
        return {
          nextStage: 'ready',
          reason: i18n.t('twin.stageReason.curing_complete'),
          triggeredBy: 'time',
        };
      }
      return null;
    case 'ready':
    default:
      return null;
  }
}
