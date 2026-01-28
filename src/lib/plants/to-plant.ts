import type {
  GeneticLean,
  PhotoperiodType,
  Plant,
  PlantEnvironment,
  PlantMetadata,
  PlantStage,
} from '@/api/plants/types';
import type { PlantModel } from '@/lib/watermelon-models/plant';

export function toPlant(model: PlantModel): Plant {
  const metadata = (model.metadata as PlantMetadata | undefined) ?? undefined;

  return {
    id: model.id,
    name: model.name,
    stage: model.stage as PlantStage | undefined,
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
