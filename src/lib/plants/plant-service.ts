import { Q } from '@nozbe/watermelondb';
import { randomUUID } from 'expo-crypto';

import type {
  GeneticLean,
  PhotoperiodType,
  Plant,
  PlantEnvironment,
  PlantMetadata,
  PlantStage,
} from '@/api/plants/types';
import type { CreatePlantVariables } from '@/api/plants/use-create-plant';
import { getOptionalAuthenticatedUserId } from '@/lib/auth';
import { database } from '@/lib/watermelon';
import type { OccurrenceOverrideModel } from '@/lib/watermelon-models/occurrence-override';
import type {
  PlantMetadataLocal,
  PlantModel,
} from '@/lib/watermelon-models/plant';
import type { SeriesModel } from '@/lib/watermelon-models/series';
import type { TaskModel } from '@/lib/watermelon-models/task';

import { createTaskEngine } from '../growbro-task-engine';
import { maybeAutoApplyPlaybook } from './playbook-auto-apply';

type PlantUpsertInput = CreatePlantVariables;

type PlantQueryOptions = {
  userId?: string | null;
};

function getCollection() {
  return database.get<PlantModel>('plants');
}

function generatePlantId(): string {
  return randomUUID();
}

/**
 * Extract hash and extension from a plant photo local URI.
 * Plant photos are stored as content-addressed files: {hash}.{ext}
 */
function extractPhotoHashFromUri(
  uri: string
): { hash: string; extension: string } | null {
  if (!uri || !uri.startsWith('file://')) {
    return null;
  }
  // Extract filename from URI
  const parts = uri.split('/');
  const filename = parts[parts.length - 1];
  if (!filename) return null;

  // Split filename into hash and extension
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex <= 0) return null;

  const hash = filename.slice(0, dotIndex);
  const extension = filename.slice(dotIndex + 1);

  // Validate hash looks like a content hash (hexadecimal)
  if (!/^[a-f0-9]{8,}$/i.test(hash)) {
    return null;
  }

  return { hash, extension };
}

/**
 * Enqueue plant photo for upload if it's a local file URI.
 */
async function maybeEnqueuePlantPhotoUpload(
  plantId: string,
  imageUrl: string | undefined | null
): Promise<void> {
  const photoInfo = extractPhotoHashFromUri(imageUrl ?? '');
  if (!photoInfo) {
    return; // Not a local file URI or invalid format
  }

  try {
    const { enqueuePlantProfilePhoto } = await import('@/lib/uploads/queue');
    await enqueuePlantProfilePhoto({
      localUri: imageUrl!,
      plantId,
      hash: photoInfo.hash,
      extension: photoInfo.extension,
    });
  } catch (error) {
    console.warn('[PlantService] Failed to enqueue plant photo upload:', error);
    // Don't fail the plant save if enqueueing fails
  }
}

function buildMetadata(
  input: PlantUpsertInput
): PlantMetadataLocal | undefined {
  const metadata: PlantMetadata = {
    photoperiodType: input.photoperiodType,
    environment: input.environment,
    geneticLean: input.geneticLean,
    medium: input.medium,
    potSize: input.potSize,
    lightSchedule: input.lightSchedule,
    lightHours: input.lightHours,
    height: input.height,
    notes: input.notes,
    strainId: input.strainId,
    strainSlug: input.strainSlug,
    strainSource: input.strainSource,
    strainRace: input.strainRace,
  };

  const filtered = Object.fromEntries(
    Object.entries(metadata).filter(
      ([, value]) => value !== undefined && value !== null
    )
  );

  return Object.keys(filtered).length > 0 ? filtered : undefined;
}

function assignString(value: string | undefined | null): string | undefined {
  return value ?? undefined;
}

export function toPlant(model: PlantModel): Plant {
  const metadata = (model.metadata as PlantMetadata | undefined) ?? undefined;

  return {
    id: model.id,
    name: model.name,
    stage: model.stage as PlantStage | undefined,
    strain: model.strain ?? undefined,
    plantedAt: model.plantedAt ?? undefined,
    expectedHarvestAt: model.expectedHarvestAt ?? undefined,
    lastWateredAt: model.lastWateredAt ?? undefined,
    lastFedAt: model.lastFedAt ?? undefined,
    health: model.health as Plant['health'],
    notes: model.notes ?? metadata?.notes,
    imageUrl: model.imageUrl ?? undefined,
    metadata,
    environment:
      (model.environment as PlantEnvironment | undefined) ??
      metadata?.environment,
    photoperiodType:
      (model.photoperiodType as PhotoperiodType | undefined) ??
      metadata?.photoperiodType,
    geneticLean:
      (model.geneticLean as GeneticLean | undefined) ?? metadata?.geneticLean,
  };
}

export async function getPlantById(id: string): Promise<PlantModel | null> {
  const collection = getCollection();
  const matches = await collection.query(Q.where('id', id)).fetch();
  return matches[0] ?? null;
}

export async function createPlantFromForm(
  input: PlantUpsertInput,
  options: { userId?: string } = {}
): Promise<PlantModel> {
  const collection = getCollection();
  const now = new Date();
  const id = generatePlantId();
  const metadata = buildMetadata(input);
  const stage = input.stage ?? 'seedling';

  const record = await database.write(async () => {
    return collection.create((rec) => {
      rec._raw.id = id;
      rec.userId = options.userId ?? undefined;
      rec.name = input.name;
      rec.stage = assignString(stage);
      rec.strain = assignString(input.strain);
      rec.photoperiodType = assignString(input.photoperiodType);
      rec.environment = assignString(input.environment);
      rec.geneticLean = assignString(input.geneticLean);
      rec.plantedAt = assignString(input.plantedAt);
      rec.expectedHarvestAt = assignString(input.expectedHarvestAt);
      rec.imageUrl = assignString(input.imageUrl);
      rec.notes = assignString(input.notes);
      rec.metadata = metadata;
      rec.createdAt = now;
      rec.updatedAt = now;
    });
  });

  // Non-blocking: Enqueue plant photo for background upload
  maybeEnqueuePlantPhotoUpload(id, input.imageUrl).catch((error) => {
    console.warn('[PlantService] Failed to enqueue photo upload:', error);
  });

  // Non-blocking: Create GrowBro task schedules for the new plant
  const engine = createTaskEngine();
  engine.ensureSchedulesForPlant(toPlant(record)).catch((error) => {
    console.warn(
      '[PlantService] Failed to create task schedules for new plant:',
      error
    );
  });

  // Non-blocking: Auto-apply matching playbook template for guided tasks
  maybeAutoApplyPlaybook(id, {
    photoperiodType: input.photoperiodType,
    environment: input.environment,
  }).catch((error) => {
    console.warn(
      '[PlantService] Failed to auto-apply playbook for new plant:',
      error
    );
  });

  return record;
}

export async function updatePlantFromForm(
  id: string,
  input: Partial<PlantUpsertInput>,
  options: { userId?: string } = {}
): Promise<PlantModel> {
  const record = await getPlantById(id);
  if (!record) {
    throw new Error(`Plant ${id} not found`);
  }

  // Capture previous stage and imageUrl for change detection
  const previousStage = record.stage as PlantStage | undefined;
  const previousImageUrl = record.imageUrl;
  const newStage = input.stage as PlantStage | undefined;
  const stageChanged =
    input.stage !== undefined && input.stage !== previousStage;
  const imageChanged =
    input.imageUrl !== undefined && input.imageUrl !== previousImageUrl;

  const metadata = buildMetadata(input as PlantUpsertInput);
  const now = new Date();

  await database.write(async () => {
    await record.update((model) => {
      if (options.userId !== undefined)
        model.userId = options.userId ?? undefined;
      if (input.name !== undefined) model.name = input.name;
      if (input.stage !== undefined) model.stage = assignString(input.stage);
      if (input.strain !== undefined) model.strain = assignString(input.strain);
      if (input.photoperiodType !== undefined)
        model.photoperiodType = assignString(input.photoperiodType);
      if (input.environment !== undefined)
        model.environment = assignString(input.environment);
      if (input.geneticLean !== undefined)
        model.geneticLean = assignString(input.geneticLean);
      if (input.plantedAt !== undefined)
        model.plantedAt = assignString(input.plantedAt);
      if (input.expectedHarvestAt !== undefined)
        model.expectedHarvestAt = assignString(input.expectedHarvestAt);
      if (input.imageUrl !== undefined)
        model.imageUrl = assignString(input.imageUrl);
      if (input.notes !== undefined) model.notes = assignString(input.notes);
      if (metadata !== undefined) model.metadata = metadata;
      model.updatedAt = now;
    });
  });

  // Non-blocking: Enqueue plant photo for background upload if image changed
  if (imageChanged) {
    maybeEnqueuePlantPhotoUpload(id, input.imageUrl).catch((error) => {
      console.warn('[PlantService] Failed to enqueue photo upload:', error);
    });
  }

  // Non-blocking: Handle stage change with TaskEngine
  if (stageChanged && newStage) {
    const engine = createTaskEngine();
    engine
      .onStageChange(
        { plantId: id, fromStage: previousStage ?? null, toStage: newStage },
        toPlant(record)
      )
      .catch((error) => {
        console.warn(
          '[PlantService] Failed to update task schedules on stage change:',
          error
        );
      });
  }

  return record;
}

async function cancelUploadQueueForPlant(plantId: string): Promise<void> {
  try {
    const { cancelQueueEntriesForPlant } = await import('@/lib/uploads/queue');
    await cancelQueueEntriesForPlant(plantId);
  } catch (error) {
    console.warn('[PlantService] Failed to cancel queue entries:', error);
  }
}

async function triggerPlantDeletionSync(): Promise<void> {
  try {
    const { syncPlantsBidirectional } = await import(
      '@/lib/plants/plants-sync'
    );
    await syncPlantsBidirectional();
  } catch (error) {
    console.warn('[PlantService] Failed to sync deleted plant:', error);
  }
}

async function getLinkedRecords(plantId: string) {
  const { SeriesModel } = await import('@/lib/watermelon-models/series');
  const { TaskModel } = await import('@/lib/watermelon-models/task');
  const { OccurrenceOverrideModel } = await import(
    '@/lib/watermelon-models/occurrence-override'
  );

  const seriesCollection = database.get<InstanceType<typeof SeriesModel>>(
    SeriesModel.table
  );
  const tasksCollection = database.get<InstanceType<typeof TaskModel>>(
    TaskModel.table
  );
  const overridesCollection = database.get<
    InstanceType<typeof OccurrenceOverrideModel>
  >(OccurrenceOverrideModel.table);

  const linkedSeries = await seriesCollection
    .query(Q.where('plant_id', plantId), Q.where('deleted_at', null))
    .fetch();
  const seriesIds = linkedSeries.map((s) => s.id);

  const linkedTasks = await tasksCollection
    .query(
      Q.or(
        Q.where('plant_id', plantId),
        seriesIds.length > 0
          ? Q.where('series_id', Q.oneOf(seriesIds))
          : Q.where('id', null)
      ),
      Q.where('deleted_at', null)
    )
    .fetch();

  const linkedOverrides =
    seriesIds.length > 0
      ? await overridesCollection
          .query(
            Q.where('series_id', Q.oneOf(seriesIds)),
            Q.where('deleted_at', null)
          )
          .fetch()
      : [];

  return { linkedSeries, linkedTasks, linkedOverrides };
}

type SoftDeleteOptions = {
  linkedTasks: TaskModel[];
  linkedOverrides: OccurrenceOverrideModel[];
  linkedSeries: SeriesModel[];
  plantRecord: PlantModel;
  userId?: string | null;
};

async function softDeleteRelatedRecords(
  options: SoftDeleteOptions
): Promise<void> {
  const { linkedTasks, linkedOverrides, linkedSeries, plantRecord, userId } =
    options;
  const now = new Date();

  await database.write(async () => {
    for (const task of linkedTasks) {
      await task.update((rec: TaskModel) => {
        rec.deletedAt = now;
        rec.updatedAt = now;
      });
    }

    for (const override of linkedOverrides) {
      await override.update((rec: OccurrenceOverrideModel) => {
        rec.deletedAt = now;
        rec.updatedAt = now;
      });
    }

    for (const series of linkedSeries) {
      await series.update((rec: SeriesModel) => {
        rec.deletedAt = now;
        rec.updatedAt = now;
      });
    }

    await plantRecord.update((rec: PlantModel) => {
      if (userId) rec.userId = userId;
      rec.deletedAt = now;
      rec.updatedAt = now;
    });
    await plantRecord.markAsDeleted();
  });
}

export async function deletePlant(id: string): Promise<void> {
  const record = await getPlantById(id);
  if (!record) {
    throw new Error(`Plant ${id} not found`);
  }

  const userId = await getOptionalAuthenticatedUserId();
  await cancelUploadQueueForPlant(id);

  try {
    const { TaskNotificationService } = await import(
      '@/lib/task-notifications'
    );
    const { linkedSeries, linkedTasks, linkedOverrides } =
      await getLinkedRecords(id);

    for (const task of linkedTasks) {
      await TaskNotificationService.cancelForTask(task.id);
    }

    await softDeleteRelatedRecords({
      linkedTasks,
      linkedOverrides,
      linkedSeries,
      plantRecord: record,
      userId: userId ?? undefined,
    });

    console.log(
      `[PlantService] Deleted plant ${id} with ${linkedTasks.length} tasks, ${linkedSeries.length} series, and ${linkedOverrides.length} overrides`
    );
  } catch (error) {
    console.warn('[PlantService] Failed to cleanup tasks/series:', error);
    await database.write(async () => {
      const now = new Date();
      await record.update((rec: PlantModel) => {
        if (userId) rec.userId = userId;
        rec.deletedAt = now;
        rec.updatedAt = now;
      });
      await record.markAsDeleted();
    });
  }

  void triggerPlantDeletionSync();
}

export async function listPlantsForUser(
  options: PlantQueryOptions = {}
): Promise<PlantModel[]> {
  const collection = getCollection();
  const query = options.userId
    ? collection.query(Q.where('user_id', options.userId))
    : collection.query();
  return query.fetch();
}
