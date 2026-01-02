import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';

import { getTasksByDateRange } from '@/lib/task-manager';
import type { Task } from '@/types/calendar';

export type PlantAttentionStatus = {
  needsAttention: boolean;
  overdueCount: number;
  dueTodayCount: number;
  isLoading: boolean;
};

/**
 * Fetches pending tasks for a plant that are overdue or due today.
 * Returns counts and a boolean indicating if attention is needed.
 */
async function fetchPlantAttentionStatus(
  plantId: string
): Promise<Omit<PlantAttentionStatus, 'isLoading'>> {
  const now = DateTime.local();
  // Look back 30 days for overdue tasks, through end of today for due today
  const rangeStart = now.minus({ days: 30 }).startOf('day').toJSDate();
  const rangeEnd = now.endOf('day').toJSDate();

  const allTasks = await getTasksByDateRange(rangeStart, rangeEnd);

  // Filter to this plant's pending tasks only
  const plantTasks = allTasks.filter(
    (task: Task) => task.plantId === plantId && task.status === 'pending'
  );

  const startOfToday = now.startOf('day');
  const endOfToday = now.endOf('day');

  const overdueCount = plantTasks.filter((task: Task) => {
    const due = DateTime.fromISO(task.dueAtLocal);
    return due < startOfToday;
  }).length;

  const dueTodayCount = plantTasks.filter((task: Task) => {
    const due = DateTime.fromISO(task.dueAtLocal);
    return due >= startOfToday && due <= endOfToday;
  }).length;

  return {
    needsAttention: overdueCount > 0 || dueTodayCount > 0,
    overdueCount,
    dueTodayCount,
  };
}

type UsePlantAttentionOptions = {
  enabled?: boolean;
};

/**
 * Hook to check if a plant needs attention based on pending tasks.
 * Returns true if there are overdue tasks or tasks due today.
 */
export function usePlantAttention(
  plantId: string,
  options: UsePlantAttentionOptions = {}
): PlantAttentionStatus {
  const { enabled = true } = options;

  const { data, isLoading } = useQuery({
    queryKey: ['plant-attention', plantId],
    queryFn: () => fetchPlantAttentionStatus(plantId),
    enabled: enabled && Boolean(plantId),
    staleTime: 60 * 1000, // 1 minute - balance freshness with performance
    gcTime: 5 * 60 * 1000, // 5 minutes garbage collection
  });

  return {
    needsAttention: data?.needsAttention ?? false,
    overdueCount: data?.overdueCount ?? 0,
    dueTodayCount: data?.dueTodayCount ?? 0,
    isLoading,
  };
}
