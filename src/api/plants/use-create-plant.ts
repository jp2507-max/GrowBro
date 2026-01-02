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
import { createPlantFromForm, toPlant } from '@/lib/plants/plant-service';
import { syncPlantsToCloud } from '@/lib/plants/plants-sync';
import { captureExceptionIfConsented } from '@/lib/settings/privacy-runtime';

export type CreatePlantVariables = {
  name: string;
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
  height?: number;
  notes?: string;
  imageUrl?: string;
};

export type CreatePlantResponse = Plant;

export const useCreatePlant = createMutation<
  CreatePlantResponse,
  CreatePlantVariables,
  Error
>({
  mutationFn: async (variables) => {
    const userId = await getOptionalAuthenticatedUserId();
    const model = await createPlantFromForm(variables, {
      userId: userId ?? undefined,
    });
    const plant = toPlant(model);
    // Best-effort cloud sync; do not block caller.
    void syncPlantsToCloud().catch((syncError) => {
      console.error('[CreatePlant] sync to cloud failed', syncError);
      captureExceptionIfConsented(
        syncError instanceof Error ? syncError : new Error(String(syncError)),
        { context: 'plant-create-sync', plantId: plant.id }
      );
    });
    return plant;
  },
});
