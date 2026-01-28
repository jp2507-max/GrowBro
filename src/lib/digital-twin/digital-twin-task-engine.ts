import { Q } from '@nozbe/watermelondb';
import { DateTime } from 'luxon';

import type { Plant, PlantStage } from '@/api/plants/types';
import { TaskEngine } from '@/lib/growbro-task-engine/task-engine';
import { TaskFactory } from '@/lib/growbro-task-engine/task-factory';
import type {
  PlantSettings,
  SeriesSpec,
} from '@/lib/growbro-task-engine/types';
import {
  DEFAULT_FLOWERING_DAYS_AUTOFLOWER,
  DEFAULT_FLOWERING_DAYS_PHOTOPERIOD,
} from '@/lib/growbro-task-engine/types';
import { parsePotSizeLiters } from '@/lib/growbro-task-engine/utils';
import { modelToDiagnosticResult } from '@/lib/nutrient-engine/services/diagnostic-mappers';
import type { PlantEventKindValue } from '@/lib/plants/plant-event-kinds';
import { database } from '@/lib/watermelon';
import type { DiagnosticResultModel } from '@/lib/watermelon-models/diagnostic-result';
import type { PlantModel } from '@/lib/watermelon-models/plant';
import type { PlantEventModel } from '@/lib/watermelon-models/plant-event';
import type { TrichomeAssessmentModel } from '@/lib/watermelon-models/trichome-assessment';

import { deriveTwinState } from './derive-twin-state';
import { getCuringIntents } from './engines/curing-engine';
import { getEnvironmentIntents } from './engines/environment-engine';
import { getHydrologyIntents } from './engines/hydrology-engine';
import { getNutritionIntents } from './engines/nutrition-engine';
import type { TaskIntent, TwinSignals } from './twin-types';

const EXCLUDED_LEGACY_CATEGORIES = new Set([
  'hydrology',
  'nutrition',
  'environment',
  'curing',
]);

function getTimezone(): string {
  return DateTime.local().zoneName ?? 'UTC';
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function toPlant(model: PlantModel): Plant {
  const metadata = (model.metadata as Plant['metadata']) ?? undefined;
  return {
    id: model.id,
    name: model.name,
    stage: (model.stage as PlantStage | undefined) ?? undefined,
    stageEnteredAt: model.stageEnteredAt ?? undefined,
    strain: model.strain ?? undefined,
    plantedAt: model.plantedAt ?? undefined,
    expectedHarvestAt: model.expectedHarvestAt ?? undefined,
    lastWateredAt: model.lastWateredAt ?? undefined,
    lastFedAt: model.lastFedAt ?? undefined,
    health: model.health as Plant['health'],
    notes: model.notes ?? metadata?.notes,
    imageUrl: model.imageUrl ?? undefined,
    metadata,
    environment: model.environment as Plant['environment'],
    photoperiodType: model.photoperiodType as Plant['photoperiodType'],
    geneticLean: model.geneticLean as Plant['geneticLean'],
  };
}

function buildLegacySettings(plant: Plant, timezone: string): PlantSettings {
  const metadata = plant.metadata ?? {};
  const photoperiodType =
    plant.photoperiodType ?? metadata.photoperiodType ?? 'photoperiod';
  const floweringDays =
    photoperiodType === 'autoflower'
      ? DEFAULT_FLOWERING_DAYS_AUTOFLOWER
      : DEFAULT_FLOWERING_DAYS_PHOTOPERIOD;

  const plantedAt = plant.plantedAt ? new Date(plant.plantedAt) : new Date();
  const stageEnteredAt = plant.stageEnteredAt
    ? new Date(plant.stageEnteredAt)
    : plantedAt;

  return {
    plantId: plant.id,
    stage: plant.stage ?? 'seedling',
    medium: metadata.medium ?? 'soil',
    potSizeLiters: parsePotSizeLiters(metadata.potSize),
    environment: plant.environment ?? metadata.environment ?? 'indoor',
    photoperiodType,
    geneticLean: plant.geneticLean ?? metadata.geneticLean ?? 'unknown',
    plantedAt,
    floweringDays,
    timezone,
    stageEnteredAt,
  };
}

function toIntent(spec: SeriesSpec, fallbackKey: string): TaskIntent {
  const engineKey =
    (spec.metadata?.engineKey as string | undefined) ?? fallbackKey;

  return {
    engineKey,
    title: spec.title,
    description: spec.description,
    rrule: spec.rrule,
    dtstartLocal: spec.dtstartLocal,
    dtstartUtc: spec.dtstartUtc,
    timezone: spec.timezone,
    untilUtc: spec.untilUtc,
    count: spec.count,
    metadata: spec.metadata,
  };
}

async function loadTwinSignals(plantId: string): Promise<TwinSignals> {
  const events = await database
    .get<PlantEventModel>('plant_events')
    .query(
      Q.where('plant_id', plantId),
      Q.where('deleted_at', null),
      Q.sortBy('occurred_at', Q.desc)
    )
    .fetch();

  const trichomeRows = await database
    .get<TrichomeAssessmentModel>('trichome_assessments')
    .query(Q.where('plant_id', plantId), Q.sortBy('created_at', Q.desc))
    .fetch();

  const diagnosticRows = await database
    .get<DiagnosticResultModel>('diagnostic_results_v2')
    .query(Q.where('plant_id', plantId), Q.sortBy('created_at', Q.desc))
    .fetch();

  return {
    events: events.map((event) => ({
      id: event.id,
      plantId: event.plantId,
      kind: event.kind as PlantEventKindValue,
      occurredAt: event.occurredAt,
      payload: event.payload ?? undefined,
      userId: event.userId ?? undefined,
    })),
    latestTrichomeAssessment: trichomeRows[0]?.toTrichomeAssessment() ?? null,
    latestDiagnostic: diagnosticRows[0]
      ? modelToDiagnosticResult(diagnosticRows[0])
      : null,
  };
}

function buildLegacyIntents(plant: Plant, timezone: string): TaskIntent[] {
  const settings = buildLegacySettings(plant, timezone);
  const specs = TaskFactory.create(settings);

  return specs
    .filter((spec) => {
      const category = spec.metadata?.category;
      if (typeof category !== 'string') return true;
      return !EXCLUDED_LEGACY_CATEGORIES.has(category);
    })
    .map((spec) => toIntent(spec, `legacy.${slugify(spec.title)}`));
}

function toSeriesSpec(intent: TaskIntent): SeriesSpec {
  return {
    title: intent.title,
    description: intent.description,
    rrule: intent.rrule,
    dtstartLocal: intent.dtstartLocal,
    dtstartUtc: intent.dtstartUtc,
    timezone: intent.timezone,
    untilUtc: intent.untilUtc,
    count: intent.count,
    metadata: {
      ...(intent.metadata ?? {}),
      engineKey: intent.engineKey,
      engineSource: 'digital-twin',
    },
  };
}

export class DigitalTwinTaskEngine {
  private taskEngine: TaskEngine;
  private timezone: string;

  constructor(timezone: string = getTimezone()) {
    this.timezone = timezone;
    this.taskEngine = new TaskEngine(timezone);
  }

  async syncForPlant(plant: Plant): Promise<void> {
    if (!plant.stage) return;

    const signals = await loadTwinSignals(plant.id);
    const state = deriveTwinState({
      plant,
      signals,
      timezone: this.timezone,
    });

    const intents: TaskIntent[] = [
      ...getHydrologyIntents(state),
      ...(await getNutritionIntents(state)),
      ...getEnvironmentIntents(state),
      ...getCuringIntents(state),
      ...buildLegacyIntents(plant, this.timezone),
    ];

    const specs = intents.map(toSeriesSpec);
    await this.taskEngine.syncSchedulesForPlant(plant, specs);
  }

  async syncForPlantId(plantId: string): Promise<void> {
    const model = await database.get<PlantModel>('plants').find(plantId);
    await this.syncForPlant(toPlant(model));
  }
}

export async function syncAllPlantsDigitalTwin(): Promise<void> {
  const plants = await database.get<PlantModel>('plants').query().fetch();
  const engine = new DigitalTwinTaskEngine();
  for (const plant of plants) {
    await engine.syncForPlant(toPlant(plant));
  }
}
