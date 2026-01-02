import { useMutation, useQueryClient } from '@tanstack/react-query';

import { deletePlant } from '@/lib/plants/plant-service';
import { syncPlantsToCloud } from '@/lib/plants/plants-sync';
import { captureExceptionIfConsented } from '@/lib/settings/privacy-runtime';

type UseDeletePlantOptions = {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
};

export function useDeletePlant(options: UseDeletePlantOptions = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await deletePlant(id);
      try {
        await syncPlantsToCloud();
      } catch (syncError) {
        // Sync failures shouldn't block the UI
        console.error('[DeletePlant] sync to cloud failed', syncError);
        captureExceptionIfConsented(
          syncError instanceof Error ? syncError : new Error(String(syncError)),
          { context: 'plant-delete-sync', plantId: id }
        );
      }
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['plants-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['plant', { id }] });
      options.onSuccess?.();
    },
    onError: (error) => {
      options.onError?.(error);
    },
  });
}
