import type { PlantStage } from '@/api/plants/types';
import { AUTOFLOWER_NUDGE_START_DAY } from '@/lib/growbro-task-engine/types';

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
    return dayFromPlanting >= AUTOFLOWER_NUDGE_START_DAY;
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
  return hasEvent(state.signals, PlantEventKind.HARVEST_COMPLETED);
}

function shouldEnterReady(state: TwinState): boolean {
  return state.dayInStage >= 21;
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
        ? `Autoflower day ${state.dayFromPlanting}`
        : 'Light cycle switched to 12/12',
    triggeredBy:
      state.profile.photoperiodType === 'autoflower'
        ? 'time'
        : PlantEventKind.LIGHT_CYCLE_SWITCHED,
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
          reason: 'Sprout confirmed',
          triggeredBy: PlantEventKind.SPROUT_CONFIRMED,
        };
      }
      return null;
    case 'seedling': {
      const nodeCount = getNodeCount(state.signals);
      if (nodeCount !== null && nodeCount >= 3) {
        return {
          nextStage: 'vegetative',
          reason: 'Node count reached 3+',
          triggeredBy: PlantEventKind.NODE_COUNT_UPDATED,
        };
      }
      return null;
    }
    case 'vegetative':
      return getVegetativeTransition(state);
    case 'flowering_stretch':
      if (state.dayInStage >= 7) {
        return {
          nextStage: 'flowering',
          reason: 'Stretch period complete',
          triggeredBy: 'time',
        };
      }
      return null;
    case 'flowering':
      if (shouldEnterRipening(state)) {
        return {
          nextStage: 'ripening',
          reason: 'Approaching end of flowering window',
          triggeredBy: 'time',
        };
      }
      return null;
    case 'ripening':
      if (shouldEnterHarvesting(state)) {
        return {
          nextStage: 'harvesting',
          reason: 'Trichomes indicate harvest window',
          triggeredBy: hasEvent(state.signals, PlantEventKind.HARVEST_STARTED)
            ? PlantEventKind.HARVEST_STARTED
            : 'trichomes',
        };
      }
      return null;
    case 'harvesting':
      if (shouldEnterCuring(state)) {
        return {
          nextStage: 'curing',
          reason: 'Harvest complete',
          triggeredBy: PlantEventKind.HARVEST_COMPLETED,
        };
      }
      return null;
    case 'curing':
      if (shouldEnterReady(state)) {
        return {
          nextStage: 'ready',
          reason: 'Curing duration reached',
          triggeredBy: 'time',
        };
      }
      return null;
    case 'ready':
    default:
      return null;
  }
}
