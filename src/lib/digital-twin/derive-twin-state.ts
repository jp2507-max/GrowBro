import { DateTime } from 'luxon';

import type { Plant } from '@/api/plants/types';
import {
  DEFAULT_FLOWERING_DAYS_AUTOFLOWER,
  DEFAULT_FLOWERING_DAYS_PHOTOPERIOD,
} from '@/lib/growbro-task-engine/types';
import { parsePotSizeLiters } from '@/lib/growbro-task-engine/utils';

import { getNextStageCandidate } from './growth-state-machine';
import type { PlantProfile, TwinSignals, TwinState } from './twin-types';

function toDate(value?: string | null, fallback?: Date): Date {
  if (!value) return fallback ?? new Date();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback ?? new Date();
  return parsed;
}

function buildProfile(params: {
  plant: Plant;
  timezone: string;
}): PlantProfile {
  const { plant, timezone } = params;
  const metadata = plant.metadata ?? {};
  const photoperiodType =
    plant.photoperiodType ?? metadata.photoperiodType ?? 'photoperiod';
  const floweringDays =
    photoperiodType === 'autoflower'
      ? DEFAULT_FLOWERING_DAYS_AUTOFLOWER
      : DEFAULT_FLOWERING_DAYS_PHOTOPERIOD;
  const plantedAt = toDate(plant.plantedAt, new Date());
  const stageEnteredAt = toDate(plant.stageEnteredAt, plantedAt);
  const lastWateredAt = plant.lastWateredAt
    ? toDate(plant.lastWateredAt)
    : undefined;
  const lastFedAt = plant.lastFedAt ? toDate(plant.lastFedAt) : undefined;

  return {
    plantId: plant.id,
    stage: plant.stage ?? 'seedling',
    stageEnteredAt,
    plantedAt,
    environment: plant.environment ?? metadata.environment ?? 'indoor',
    photoperiodType,
    geneticLean: plant.geneticLean ?? metadata.geneticLean ?? 'unknown',
    medium: metadata.medium ?? 'soil',
    potSizeLiters: parsePotSizeLiters(metadata.potSize),
    floweringDays,
    timezone,
    heightCm: typeof metadata.height === 'number' ? metadata.height : undefined,
    lastWateredAt,
    lastFedAt,
  };
}

function diffInDays(start: Date, end: Date): number {
  const startDt = DateTime.fromJSDate(start).startOf('day');
  const endDt = DateTime.fromJSDate(end).startOf('day');
  return Math.max(0, Math.floor(endDt.diff(startDt, 'days').days));
}

export function deriveTwinState(params: {
  plant: Plant;
  signals: TwinSignals;
  timezone: string;
  now?: Date;
}): TwinState {
  const { plant, signals, timezone } = params;
  const now = params.now ?? new Date();
  const profile = buildProfile({ plant, timezone });
  const dayInStage = diffInDays(profile.stageEnteredAt, now);
  const dayFromPlanting = diffInDays(profile.plantedAt, now);

  const baseState: TwinState = {
    profile,
    stage: profile.stage,
    stageEnteredAt: profile.stageEnteredAt,
    dayInStage,
    dayFromPlanting,
    signals,
  };

  const candidate = getNextStageCandidate(baseState);
  return {
    ...baseState,
    transition: candidate ?? null,
  };
}
