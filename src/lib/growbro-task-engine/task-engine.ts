import { Q } from '@nozbe/watermelondb';
import { DateTime } from 'luxon';

import type {
  GeneticLean,
  PhotoperiodType,
  Plant,
  PlantEnvironment,
  PlantStage,
} from '@/api/plants/types';
import { database } from '@/lib/watermelon';
import type { SeriesModel } from '@/lib/watermelon-models/series';
import type { TaskModel } from '@/lib/watermelon-models/task';

import { TaskFactory } from './task-factory';
import type {
  GrowMedium,
  PlantSettings,
  SeriesSpec,
  StageChangeEvent,
} from './types';
import {
  DEFAULT_FLOWERING_DAYS_AUTOFLOWER,
  DEFAULT_FLOWERING_DAYS_PHOTOPERIOD,
  ORIGIN_GROWBRO,
} from './types';
import { parsePotSizeLiters } from './utils';

function getSeriesCollection() {
  return database.get<SeriesModel>('series');
}

function getTasksCollection() {
  return database.get<TaskModel>('tasks');
}

type EngineMetadata = {
  engineKey?: string;
  signature?: string;
  engineSource?: string;
};

type DesiredSpec = {
  spec: SeriesSpec;
  engineKey: string;
  signature: string;
  fingerprint: string;
};

type SeriesUpdate = {
  series: SeriesModel;
  spec: SeriesSpec;
  engineKey: string;
  signature: string;
  signatureChanged: boolean;
};

type SeriesCreate = {
  spec: SeriesSpec;
  engineKey: string;
  signature: string;
};

type SeriesDiff = {
  updates: SeriesUpdate[];
  creates: SeriesCreate[];
  toDelete: SeriesModel[];
  seriesIdsNeedingCleanup: Set<string>;
};

type DeleteTaskFn = (task: TaskModel, now: Date) => Promise<boolean>;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const entries = keys.map(
      (key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`
    );
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function stripEngineMetadata(
  metadata?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  const { engineKey, signature, engineSource, ...rest } = metadata;
  void engineKey;
  void signature;
  void engineSource;
  return Object.keys(rest).length ? rest : undefined;
}

function buildSpecSignature(spec: SeriesSpec, engineKey: string): string {
  const payload = {
    engineKey,
    title: spec.title,
    description: spec.description ?? null,
    rrule: spec.rrule,
    dtstartLocal: spec.dtstartLocal,
    dtstartUtc: spec.dtstartUtc,
    timezone: spec.timezone,
    untilUtc: spec.untilUtc ?? null,
    count: spec.count ?? null,
    metadata: stripEngineMetadata(spec.metadata),
  };
  return stableStringify(payload);
}

function buildSpecFingerprint(spec: SeriesSpec): string {
  const payload = {
    title: spec.title,
    description: spec.description ?? null,
    rrule: spec.rrule,
    dtstartLocal: spec.dtstartLocal,
    dtstartUtc: spec.dtstartUtc,
    timezone: spec.timezone,
    untilUtc: spec.untilUtc ?? null,
    count: spec.count ?? null,
  };
  return stableStringify(payload);
}

function buildSeriesFingerprint(series: SeriesModel): string {
  const payload = {
    title: series.title,
    description: series.description ?? null,
    rrule: series.rrule,
    dtstartLocal: series.dtstartLocal,
    dtstartUtc: series.dtstartUtc,
    timezone: series.timezone,
    untilUtc: series.untilUtc ?? null,
    count: series.count ?? null,
  };
  return stableStringify(payload);
}

function getEngineKeyFromSpec(spec: SeriesSpec, fallback: string): string {
  const engineKey = spec.metadata?.engineKey;
  return typeof engineKey === 'string' && engineKey.length > 0
    ? engineKey
    : fallback;
}

function getEngineMetadata(series: SeriesModel): EngineMetadata {
  const metadata = (series.metadata ?? {}) as EngineMetadata;
  return metadata ?? {};
}

function buildDesiredSpecs(specs: SeriesSpec[]): DesiredSpec[] {
  return specs.map((spec, index) => {
    const fallbackKey = `legacy.${slugify(spec.title)}.${index}`;
    const engineKey = getEngineKeyFromSpec(spec, fallbackKey);
    const signature = buildSpecSignature(spec, engineKey);
    const fingerprint = buildSpecFingerprint(spec);
    return { spec, engineKey, signature, fingerprint };
  });
}

function buildExistingSeriesMaps(existingSeries: SeriesModel[]): {
  existingByKey: Map<string, SeriesModel>;
  legacySeries: SeriesModel[];
} {
  const existingByKey = new Map<string, SeriesModel>();
  const legacySeries: SeriesModel[] = [];

  for (const series of existingSeries) {
    const meta = getEngineMetadata(series);
    if (typeof meta.engineKey === 'string' && meta.engineKey.length > 0) {
      existingByKey.set(meta.engineKey, series);
    } else {
      legacySeries.push(series);
    }
  }

  return { existingByKey, legacySeries };
}

function buildSeriesDiff(params: {
  existingSeries: SeriesModel[];
  desired: DesiredSpec[];
  existingByKey: Map<string, SeriesModel>;
  legacySeries: SeriesModel[];
}): SeriesDiff {
  const { existingSeries, desired, existingByKey, legacySeries } = params;
  const matchedIds = new Set<string>();
  const updates: SeriesUpdate[] = [];
  const creates: SeriesCreate[] = [];
  const seriesIdsNeedingCleanup = new Set<string>();

  for (const item of desired) {
    let series = existingByKey.get(item.engineKey);

    if (!series) {
      const legacyMatchIndex = legacySeries.findIndex(
        (candidate) => buildSeriesFingerprint(candidate) === item.fingerprint
      );
      if (legacyMatchIndex >= 0) {
        series = legacySeries.splice(legacyMatchIndex, 1)[0];
      }
    }

    if (series) {
      matchedIds.add(series.id);
      const meta = getEngineMetadata(series);
      const signatureChanged = meta.signature !== item.signature;
      if (signatureChanged || meta.engineKey !== item.engineKey) {
        updates.push({
          series,
          spec: item.spec,
          engineKey: item.engineKey,
          signature: item.signature,
          signatureChanged,
        });
      }
    } else {
      creates.push({
        spec: item.spec,
        engineKey: item.engineKey,
        signature: item.signature,
      });
    }
  }

  const toDelete = existingSeries.filter(
    (series) => !matchedIds.has(series.id)
  );

  return { updates, creates, toDelete, seriesIdsNeedingCleanup };
}

async function applySeriesDiff(params: {
  plant: Plant;
  updates: SeriesUpdate[];
  creates: SeriesCreate[];
  toDelete: SeriesModel[];
  seriesIdsNeedingCleanup: Set<string>;
  seriesCollection: ReturnType<typeof getSeriesCollection>;
  tasksCollection: ReturnType<typeof getTasksCollection>;
  deleteFutureOrInvalidTask: DeleteTaskFn;
}): Promise<void> {
  const {
    plant,
    updates,
    creates,
    toDelete,
    seriesIdsNeedingCleanup,
    seriesCollection,
    tasksCollection,
    deleteFutureOrInvalidTask,
  } = params;

  await database.write(async () => {
    const now = new Date();

    await applySeriesUpdates({
      plant,
      updates,
      creates,
      seriesCollection,
      seriesIdsNeedingCleanup,
      now,
    });

    await applySeriesDeletions({
      toDelete,
      seriesIdsNeedingCleanup,
      now,
    });

    await cleanupFutureTasks({
      seriesIdsNeedingCleanup,
      tasksCollection,
      deleteFutureOrInvalidTask,
      now,
    });
  });
}

async function applySeriesUpdates(params: {
  plant: Plant;
  updates: SeriesUpdate[];
  creates: SeriesCreate[];
  seriesCollection: ReturnType<typeof getSeriesCollection>;
  seriesIdsNeedingCleanup: Set<string>;
  now: Date;
}): Promise<void> {
  const {
    plant,
    updates,
    creates,
    seriesCollection,
    seriesIdsNeedingCleanup,
    now,
  } = params;

  for (const update of updates) {
    await update.series.update((record) => {
      record.title = update.spec.title;
      record.description = update.spec.description;
      record.dtstartLocal = update.spec.dtstartLocal;
      record.dtstartUtc = update.spec.dtstartUtc;
      record.timezone = update.spec.timezone;
      record.rrule = update.spec.rrule;
      record.untilUtc = update.spec.untilUtc;
      record.count = update.spec.count;
      record.origin = ORIGIN_GROWBRO;
      record.metadata = {
        ...(update.spec.metadata ?? {}),
        engineKey: update.engineKey,
        signature: update.signature,
        engineSource: 'growbro',
      };
      record.updatedAt = now;
    });

    if (update.signatureChanged) {
      seriesIdsNeedingCleanup.add(update.series.id);
    }
  }

  for (const create of creates) {
    await seriesCollection.create((record) => {
      record.title = create.spec.title;
      record.description = create.spec.description;
      record.dtstartLocal = create.spec.dtstartLocal;
      record.dtstartUtc = create.spec.dtstartUtc;
      record.timezone = create.spec.timezone;
      record.rrule = create.spec.rrule;
      record.plantId = plant.id;
      record.origin = ORIGIN_GROWBRO;
      record.untilUtc = create.spec.untilUtc;
      record.count = create.spec.count;
      record.metadata = {
        ...(create.spec.metadata ?? {}),
        engineKey: create.engineKey,
        signature: create.signature,
        engineSource: 'growbro',
      };
      record.createdAt = now;
      record.updatedAt = now;
    });
  }
}

async function applySeriesDeletions(params: {
  toDelete: SeriesModel[];
  seriesIdsNeedingCleanup: Set<string>;
  now: Date;
}): Promise<void> {
  const { toDelete, seriesIdsNeedingCleanup, now } = params;

  for (const series of toDelete) {
    await series.update((record) => {
      record.deletedAt = now;
      record.updatedAt = now;
    });
    seriesIdsNeedingCleanup.add(series.id);
  }
}

async function cleanupFutureTasks(params: {
  seriesIdsNeedingCleanup: Set<string>;
  tasksCollection: ReturnType<typeof getTasksCollection>;
  deleteFutureOrInvalidTask: DeleteTaskFn;
  now: Date;
}): Promise<void> {
  const {
    seriesIdsNeedingCleanup,
    tasksCollection,
    deleteFutureOrInvalidTask,
    now,
  } = params;

  if (seriesIdsNeedingCleanup.size === 0) {
    return;
  }

  const futureTasks = await tasksCollection
    .query(
      Q.where('series_id', Q.oneOf(Array.from(seriesIdsNeedingCleanup))),
      Q.where('status', 'pending'),
      Q.where('deleted_at', null)
    )
    .fetch();

  for (const task of futureTasks) {
    await deleteFutureOrInvalidTask(task, now);
  }
}

/**
 * Build PlantSettings from a Plant object
 */
function buildPlantSettings(params: {
  plant: Plant;
  stage: PlantStage;
  timezone: string;
  stageEnteredAt?: Date;
}): PlantSettings {
  const { plant, stage, timezone, stageEnteredAt } = params;
  const metadata = plant.metadata ?? {};
  const medium: GrowMedium = metadata.medium ?? 'soil';
  const potSizeLiters = parsePotSizeLiters(metadata.potSize);
  const environment: PlantEnvironment =
    plant.environment ?? metadata.environment ?? 'indoor';
  const photoperiodType: PhotoperiodType =
    plant.photoperiodType ?? metadata.photoperiodType ?? 'photoperiod';
  const geneticLean: GeneticLean =
    plant.geneticLean ?? metadata.geneticLean ?? 'unknown';
  let plantedAt: Date;
  if (plant.plantedAt) {
    const parsed = new Date(plant.plantedAt);
    if (isNaN(parsed.getTime())) {
      console.warn(
        `[TaskEngine] Plant ${plant.id} has malformed plantedAt: "${plant.plantedAt}". Using current time as fallback. This may cause schedule drift.`
      );
      plantedAt = new Date();
    } else {
      plantedAt = parsed;
    }
  } else {
    console.warn(
      `[TaskEngine] Plant ${plant.id} missing plantedAt, using current time. This may cause schedule drift.`
    );
    plantedAt = new Date();
  }

  // Use default flowering days based on strain type
  // TODO: breeder_flowering_range must be denormalized into Plant.metadata or otherwise
  // made available to buildPlantSettings before replacing the defaults.
  const floweringDays =
    photoperiodType === 'autoflower'
      ? DEFAULT_FLOWERING_DAYS_AUTOFLOWER
      : DEFAULT_FLOWERING_DAYS_PHOTOPERIOD;

  return {
    plantId: plant.id,
    stage,
    medium,
    potSizeLiters,
    environment,
    photoperiodType,
    geneticLean,
    plantedAt,
    floweringDays,
    timezone,
    stageEnteredAt,
  };
}

/**
 * TaskEngine orchestrates the creation and cleanup of GrowBro task schedules.
 */
export class TaskEngine {
  private timezone: string;

  constructor(timezone: string = DateTime.local().zoneName ?? 'UTC') {
    this.timezone = timezone;
  }

  /**
   * Ensure all appropriate schedules exist for a plant's current stage.
   * Idempotent - safe to call multiple times.
   *
   * Uses diff-based sync so schedules stay aligned with the latest plant settings.
   */
  async ensureSchedulesForPlant(plant: Plant): Promise<void> {
    if (!plant.stage) {
      console.warn(
        `[TaskEngine] Plant ${plant.id} has no stage - skipping schedule creation`
      );
      return;
    }

    // Build settings and create series
    const settings = buildPlantSettings({
      plant,
      stage: plant.stage,
      timezone: this.timezone,
      stageEnteredAt: plant.stageEnteredAt
        ? new Date(plant.stageEnteredAt)
        : undefined,
    });
    const specs = TaskFactory.create(settings);

    await this.syncSchedulesForPlant(plant, specs);
  }

  /**
   * Handle a stage change by cleaning up old schedules and creating new ones.
   */
  async onStageChange(event: StageChangeEvent, plant: Plant): Promise<void> {
    const { plantId, fromStage, toStage } = event;

    console.log(
      `[TaskEngine] Stage change for plant ${plantId}: ${fromStage ?? 'none'} -> ${toStage}`
    );

    const settings = buildPlantSettings({
      plant,
      stage: toStage,
      timezone: this.timezone,
      stageEnteredAt: plant.stageEnteredAt
        ? new Date(plant.stageEnteredAt)
        : new Date(),
    });
    const specs = TaskFactory.create(settings);
    await this.syncSchedulesForPlant(plant, specs);
    console.log(
      `[TaskEngine] Synced ${specs.length} schedules for plant ${plantId} after stage change to ${toStage}`
    );
  }

  /**
   * Diff-based sync for GrowBro schedules using metadata.engineKey/signature.
   */
  async syncSchedulesForPlant(
    plant: Plant,
    specs: SeriesSpec[]
  ): Promise<void> {
    const seriesCollection = getSeriesCollection();
    const tasksCollection = getTasksCollection();

    const existingSeries = await seriesCollection
      .query(
        Q.where('plant_id', plant.id),
        Q.where('origin', ORIGIN_GROWBRO),
        Q.where('deleted_at', null)
      )
      .fetch();

    if (specs.length === 0 && existingSeries.length === 0) {
      return;
    }

    const desired = buildDesiredSpecs(specs);
    const { existingByKey, legacySeries } =
      buildExistingSeriesMaps(existingSeries);
    const { updates, creates, toDelete, seriesIdsNeedingCleanup } =
      buildSeriesDiff({
        existingSeries,
        desired,
        existingByKey,
        legacySeries,
      });

    await applySeriesDiff({
      plant,
      updates,
      creates,
      toDelete,
      seriesIdsNeedingCleanup,
      seriesCollection,
      tasksCollection,
      deleteFutureOrInvalidTask: (task, now) =>
        this.deleteFutureOrInvalidTask(task, now),
    });
  }

  /**
   * Clean up all GrowBro-generated schedules for a plant.
   * Soft-deletes series and future pending tasks.
   */
  async cleanupSchedulesForPlant(plantId: string): Promise<void> {
    const seriesCollection = getSeriesCollection();
    const tasksCollection = getTasksCollection();

    // Find all GrowBro series for this plant
    // Note: v37 migration backfilled all legacy null-origin series to 'growbro'
    const seriesToDelete = await seriesCollection
      .query(
        Q.where('plant_id', plantId),
        Q.where('origin', ORIGIN_GROWBRO),
        Q.where('deleted_at', null)
      )
      .fetch();

    if (seriesToDelete.length === 0) {
      return;
    }

    const seriesIds = seriesToDelete.map((s) => s.id);
    const now = new Date();

    await database
      .write(async () => {
        // Soft-delete the series
        for (const series of seriesToDelete) {
          await series.update((record) => {
            record.deletedAt = now;
            record.updatedAt = now;
          });
        }

        // Soft-delete future pending tasks for these series
        const futureTasks = await tasksCollection
          .query(
            Q.where('series_id', Q.oneOf(seriesIds)),
            Q.where('status', 'pending'),
            Q.where('deleted_at', null)
            // Add filter for due_at_local >= current date if supported by your schema
          )
          .fetch();

        for (const task of futureTasks) {
          await this.deleteFutureOrInvalidTask(task, now);
        }
      })
      .catch((error) => {
        console.error(
          `[TaskEngine] Failed to cleanup schedules for plant ${plantId}:`,
          error
        );
        throw error;
      });

    console.log(
      `[TaskEngine] Cleaned up ${seriesToDelete.length} series for plant ${plantId}`
    );
  }

  /**
   * Helper to delete a task if it's in the future or has invalid date.
   * MUST be called within a database.write() block.
   */
  private async deleteFutureOrInvalidTask(
    task: TaskModel,
    now: Date
  ): Promise<boolean> {
    const parsedDt = DateTime.fromISO(task.dueAtLocal);

    if (!parsedDt.isValid) {
      console.warn(
        `[TaskEngine] Invalid dueAtLocal for task ${task.id}: ${task.dueAtLocal} - deleting orphaned task`
      );
      try {
        await task.update((record) => {
          record.deletedAt = now;
          record.updatedAt = now;
        });
        return true;
      } catch (error) {
        console.error(
          `[TaskEngine] Failed to delete invalid task ${task.id}:`,
          error
        );
        return false;
      }
    }

    const taskDueAt = parsedDt.toJSDate();
    // Only delete tasks that are strictly in the future (not overdue from earlier today)
    if (taskDueAt > now) {
      await task.update((record) => {
        record.deletedAt = now;
        record.updatedAt = now;
      });
      return true;
    }

    return false;
  }

  /**
   * Create series in the database from specs
   */
  private async createSeriesFromSpecs(
    plantId: string,
    specs: SeriesSpec[]
  ): Promise<void> {
    const collection = getSeriesCollection();

    await database
      .write(async () => {
        for (const [index, spec] of specs.entries()) {
          const fallbackKey = `legacy.${slugify(spec.title)}.${index}`;
          const engineKey = getEngineKeyFromSpec(spec, fallbackKey);
          const signature = buildSpecSignature(spec, engineKey);
          await collection.create((record) => {
            record.title = spec.title;
            record.description = spec.description;
            record.dtstartLocal = spec.dtstartLocal;
            record.dtstartUtc = spec.dtstartUtc;
            record.timezone = spec.timezone;
            record.rrule = spec.rrule;
            record.plantId = plantId;
            record.origin = ORIGIN_GROWBRO;
            if (spec.untilUtc !== undefined) {
              record.untilUtc = spec.untilUtc;
            }
            if (spec.count !== undefined) {
              record.count = spec.count;
            }
            record.metadata = {
              ...(spec.metadata ?? {}),
              engineKey,
              signature,
              engineSource: 'growbro',
            };
            record.createdAt = new Date();
            record.updatedAt = new Date();
          });
        }
      })
      .catch((error) => {
        console.error(
          `[TaskEngine] Failed to create series for plant ${plantId}:`,
          error
        );
        throw error;
      });
  }
}

/**
 * Create a TaskEngine instance with the device's local timezone
 */
export function createTaskEngine(): TaskEngine {
  const timezone = DateTime.local().zoneName ?? 'UTC';
  return new TaskEngine(timezone);
}
