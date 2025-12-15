import { createMutation } from 'react-query-kit';

import type {
  GeneticLean,
  PhotoperiodType,
  Plant,
  PlantEnvironment,
  PlantMetadata,
  PlantStage,
  Race,
} from '@/api/plants/types';
import { getOptionalAuthenticatedUserId } from '@/lib/auth';
import { toPlant, updatePlantFromForm } from '@/lib/plants/plant-service';
import { syncPlantsToCloud } from '@/lib/plants/plants-sync';

export type UpdatePlantVariables = {
  id: string;
  name?: string;
  stage?: PlantStage;
  strain?: string;
  strainId?: string;
  strainSlug?: string;
  strainSource?: 'api' | 'custom';
  strainRace?: Race;
  plantedAt?: string;
  expectedHarvestAt?: string;
  photoperiodType?: PhotoperiodType;
  environment?: PlantEnvironment;
  geneticLean?: GeneticLean;
  medium?: PlantMetadata['medium'];
  potSize?: string;
  lightSchedule?: string;
  lightHours?: number;
  notes?: string;
  imageUrl?: string;
};

export type UpdatePlantResponse = Plant;

export const useUpdatePlant = createMutation<
  UpdatePlantResponse,
  UpdatePlantVariables,
  Error
>({
  mutationFn: async ({ id, ...rest }) => {
    const userId = await getOptionalAuthenticatedUserId();
    const model = await updatePlantFromForm(
      id,
      {
        ...rest,
      },
      { userId: userId ?? undefined }
    );
    const plant = toPlant(model);
    void syncPlantsToCloud().catch(() => {});
    return plant;
  },
});
