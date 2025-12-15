import { useMutation, useQueryClient } from '@tanstack/react-query';

import { deletePlant } from '@/lib/plants/plant-service';
import { syncPlantsToCloud } from '@/lib/plants/plants-sync';

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
      } catch (error) {
        // Sync failures shouldn't block the UI
        console.warn('[useDeletePlant] Sync failed after deletion', error);
      }
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['plants-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['plant', id] });
      options.onSuccess?.();
    },
    onError: (error) => {
      options.onError?.(error);
    },
  });
}
