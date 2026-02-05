import type { PlantStage } from '@/api/plants/types';
import type { HarvestStage } from '@/types/harvest';

export type ProductPlantStage =
  | 'germination'
  | 'seedling'
  | 'vegetative'
  | 'flowering'
  | 'drying'
  | 'curing'
  | 'completed';

export function toProductStage(
  stage?: PlantStage,
  harvestStage?: HarvestStage
): ProductPlantStage | undefined {
  if (harvestStage) {
    switch (harvestStage) {
      case 'harvest':
      case 'drying':
        return 'drying';
      case 'curing':
        return 'curing';
      case 'inventory':
        return 'completed';
      default:
        return undefined;
    }
  }

  switch (stage) {
    case 'germination':
      return 'germination';
    case 'seedling':
      return 'seedling';
    case 'vegetative':
      return 'vegetative';
    case 'flowering_stretch':
    case 'flowering':
    case 'ripening':
      return 'flowering';
    case 'harvesting':
      return 'drying';
    case 'curing':
      return 'curing';
    case 'ready':
      return 'completed';
    default:
      return undefined;
  }
}

export function getProductStageLabelKey(stage: ProductPlantStage): string {
  return `plants.lifecycle.stage.${stage}`;
}
