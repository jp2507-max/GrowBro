import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';

import { getTasksByDateRange } from '@/lib/task-manager';
import type { Task } from '@/types/calendar';

export type PlantsAttentionMap = Record<
  string,
  {
    needsAttention: boolean;
    overdueCount: number;
    dueTodayCount: number;
  }
>;

/**
 * Fetches pending tasks for all plants within the attention window
 * and computes attention status for each plant.
 */
async function fetchPlantsAttentionMap(
  plantIds: string[]
): Promise<PlantsAttentionMap> {
  const now = DateTime.local();
  // Look back 30 days for overdue tasks, through end of today for due today
  const rangeStart = now.minus({ days: 30 }).startOf('day').toJSDate();
  const rangeEnd = now.endOf('day').toJSDate();

  const allTasks = await getTasksByDateRange(rangeStart, rangeEnd);

  // Filter to pending tasks only
  const pendingTasks = allTasks.filter(
    (task: Task) => task.status === 'pending'
  );

  // Initialize result map for all plants
  const attentionMap: PlantsAttentionMap = {};
  plantIds.forEach((plantId) => {
    attentionMap[plantId] = {
      needsAttention: false,
      overdueCount: 0,
      dueTodayCount: 0,
    };
  });

  const startOfToday = now.startOf('day');
  const endOfToday = now.endOf('day');

  // Group tasks by plant and count
  pendingTasks.forEach((task: Task) => {
    if (!task.plantId || !attentionMap[task.plantId]) return;

    const due = DateTime.fromISO(task.dueAtLocal);

    if (due < startOfToday) {
      attentionMap[task.plantId].overdueCount++;
    } else if (due >= startOfToday && due <= endOfToday) {
      attentionMap[task.plantId].dueTodayCount++;
    }
  });

  // Set needsAttention flag
  Object.values(attentionMap).forEach((status) => {
    status.needsAttention = status.overdueCount > 0 || status.dueTodayCount > 0;
  });

  return attentionMap;
}

type UsePlantsAttentionOptions = {
  enabled?: boolean;
};

/**
 * Hook to fetch attention status for multiple plants at once.
 * Returns a map of plantId -> attention status.
 */
export function usePlantsAttention(
  plantIds: string[],
  options: UsePlantsAttentionOptions = {}
): {
  attentionMap: PlantsAttentionMap;
  isLoading: boolean;
} {
  const { enabled = true } = options;

  const { data, isLoading } = useQuery({
    queryKey: ['plants-attention', plantIds.sort()],
    queryFn: () => fetchPlantsAttentionMap(plantIds),
    enabled: enabled && plantIds.length > 0,
    staleTime: 60 * 1000, // 1 minute - balance freshness with performance
    gcTime: 5 * 60 * 1000, // 5 minutes garbage collection
  });

  return {
    attentionMap: data ?? {},
    isLoading,
  };
}
