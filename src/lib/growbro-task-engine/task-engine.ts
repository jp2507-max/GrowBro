import { Q } from '@nozbe/watermelondb';
import { DateTime } from 'luxon';

import type {
  GeneticLean,
  PhotoperiodType,
  Plant,
  PlantEnvironment,
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

/**
 * Build PlantSettings from a Plant object
 */
function buildPlantSettings(
  plant: Plant,
  timezone: string,
  stageEnteredAt?: Date
): PlantSettings {
  const metadata = plant.metadata ?? {};
  const medium: GrowMedium = metadata.medium ?? 'soil';
  const potSizeLiters = parsePotSizeLiters(metadata.potSize);
  const environment: PlantEnvironment =
    plant.environment ?? metadata.environment ?? 'indoor';
  const photoperiodType: PhotoperiodType =
    plant.photoperiodType ?? metadata.photoperiodType ?? 'photoperiod';
  const geneticLean: GeneticLean =
    plant.geneticLean ?? metadata.geneticLean ?? 'unknown';
  const plantedAt = plant.plantedAt ? new Date(plant.plantedAt) : new Date();

  // Determine flowering days from strain or use defaults
  const floweringDays =
    photoperiodType === 'autoflower'
      ? DEFAULT_FLOWERING_DAYS_AUTOFLOWER
      : DEFAULT_FLOWERING_DAYS_PHOTOPERIOD;

  return {
    plantId: plant.id,
    stage: plant.stage ?? 'seedling',
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
   */
  async ensureSchedulesForPlant(plant: Plant): Promise<void> {
    if (!plant.stage) {
      console.warn(
        `[TaskEngine] Plant ${plant.id} has no stage - skipping schedule creation`
      );
      return;
    }

    // Check if schedules already exist for this plant
    const existingSeries = await getSeriesCollection()
      .query(
        Q.where('plant_id', plant.id),
        Q.or(
          Q.where('origin', ORIGIN_GROWBRO),
          Q.where('origin', null) // Legacy series created before v36
        ),
        Q.where('deleted_at', null)
      )
      .fetch();

    if (existingSeries.length > 0) {
      console.log(
        `[TaskEngine] Plant ${plant.id} already has ${existingSeries.length} GrowBro schedules - skipping`
      );
      return;
    }

    // Build settings and create series
    const settings = buildPlantSettings(plant, this.timezone);
    const specs = TaskFactory.create(settings);

    if (specs.length === 0) {
      console.log(
        `[TaskEngine] No schedules needed for plant ${plant.id} in stage ${plant.stage}`
      );
      return;
    }

    await this.createSeriesFromSpecs(plant.id, specs);
    console.log(
      `[TaskEngine] Created ${specs.length} schedules for plant ${plant.id} in stage ${plant.stage}`
    );
  }

  /**
   * Handle a stage change by cleaning up old schedules and creating new ones.
   */
  async onStageChange(event: StageChangeEvent, plant: Plant): Promise<void> {
    const { plantId, fromStage, toStage } = event;

    console.log(
      `[TaskEngine] Stage change for plant ${plantId}: ${fromStage ?? 'none'} -> ${toStage}`
    );

    // Clean up existing GrowBro schedules
    await this.cleanupSchedulesForPlant(plantId);

    // Create new schedules for the new stage
    const settings = buildPlantSettings(plant, this.timezone, new Date());
    // Override the stage with the new stage (in case plant object hasn't been updated yet)
    const updatedSettings: PlantSettings = {
      ...settings,
      stage: toStage,
      stageEnteredAt: new Date(),
    };
    const specs = TaskFactory.create(updatedSettings);

    if (specs.length === 0) {
      console.log(
        `[TaskEngine] No schedules needed for plant ${plantId} in stage ${toStage}`
      );
      return;
    }

    await this.createSeriesFromSpecs(plantId, specs);
    console.log(
      `[TaskEngine] Created ${specs.length} schedules for plant ${plantId} after stage change to ${toStage}`
    );
  }

  /**
   * Clean up all GrowBro-generated schedules for a plant.
   * Soft-deletes series and future pending tasks.
   */
  async cleanupSchedulesForPlant(plantId: string): Promise<void> {
    const seriesCollection = getSeriesCollection();
    const tasksCollection = getTasksCollection();

    // Find all GrowBro series for this plant (including legacy series with null origin)
    const seriesToDelete = await seriesCollection
      .query(
        Q.where('plant_id', plantId),
        Q.or(
          Q.where('origin', ORIGIN_GROWBRO),
          Q.where('origin', null) // Legacy series created before v36
        ),
        Q.where('deleted_at', null)
      )
      .fetch();

    if (seriesToDelete.length === 0) {
      return;
    }

    const seriesIds = seriesToDelete.map((s) => s.id);
    const now = new Date();
    const startOfToday = DateTime.fromJSDate(now).startOf('day').toJSDate();

    await database.write(async () => {
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
        )
        .fetch();

      for (const task of futureTasks) {
        const parsedDt = DateTime.fromISO(task.dueAtLocal);
        if (!parsedDt.isValid) {
          console.warn(
            `[TaskEngine] Invalid dueAtLocal for task ${task.id}: ${task.dueAtLocal}`
          );
          continue;
        }
        const taskDueAt = parsedDt.toJSDate();
        // Only delete tasks that are due today or in the future
        if (taskDueAt >= startOfToday) {
          await task.update((record) => {
            record.deletedAt = now;
            record.updatedAt = now;
          });
        }
      }
    });

    console.log(
      `[TaskEngine] Cleaned up ${seriesToDelete.length} series for plant ${plantId}`
    );
  }

  /**
   * Create series in the database from specs
   */
  private async createSeriesFromSpecs(
    plantId: string,
    specs: SeriesSpec[]
  ): Promise<void> {
    const collection = getSeriesCollection();

    await database.write(async () => {
      for (const spec of specs) {
        await collection.create((record) => {
          record.title = spec.title;
          record.description = spec.description;
          record.dtstartLocal = spec.dtstartLocal;
          record.dtstartUtc = spec.dtstartUtc;
          record.timezone = spec.timezone;
          record.rrule = spec.rrule;
          record.plantId = plantId;
          record.origin = ORIGIN_GROWBRO;
          if (spec.untilUtc) {
            record.untilUtc = spec.untilUtc;
          }
          if (spec.count !== undefined) {
            record.count = spec.count;
          }
          if (spec.metadata) {
            record.metadata = spec.metadata;
          }
          record.createdAt = new Date();
          record.updatedAt = new Date();
        });
      }
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
