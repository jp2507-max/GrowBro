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
import { database } from '@/lib/watermelon';
import type {
  PlantMetadataLocal,
  PlantModel,
} from '@/lib/watermelon-models/plant';

import { createTaskEngine } from '../growbro-task-engine';

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

  const record = await database.write(async () => {
    return collection.create((rec) => {
      rec._raw.id = id;
      rec.userId = options.userId ?? undefined;
      rec.name = input.name;
      rec.stage = assignString(input.stage);
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

  // Non-blocking: Create GrowBro task schedules for the new plant
  if (input.stage) {
    try {
      const engine = createTaskEngine();
      await engine.ensureSchedulesForPlant(toPlant(record));
    } catch (error) {
      console.warn(
        '[PlantService] Failed to create task schedules for new plant: ' + error
      );
    }
  }

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

  // Capture previous stage for change detection
  const previousStage = record.stage as PlantStage | undefined;
  const newStage = input.stage as PlantStage | undefined;
  const stageChanged =
    input.stage !== undefined && input.stage !== previousStage;

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

  // Non-blocking: Handle stage change with TaskEngine
  if (stageChanged && newStage) {
    try {
      const engine = createTaskEngine();
      await engine.onStageChange(
        { plantId: id, fromStage: previousStage ?? null, toStage: newStage },
        toPlant(record)
      );
    } catch (error) {
      console.warn(
        '[PlantService] Failed to update task schedules on stage change:',
        error
      );
    }
  }

  return record;
}

export async function deletePlant(id: string): Promise<void> {
  const record = await getPlantById(id);
  if (!record) {
    throw new Error(`Plant ${id} not found`);
  }

  await database.write(async () => {
    await record.markAsDeleted();
  });
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
