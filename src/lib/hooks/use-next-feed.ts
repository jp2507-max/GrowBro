import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';

import { getTasksByDateRange } from '@/lib/task-manager';
import type { Task } from '@/types/calendar';

export type NextFeedResult = {
  nextFeed: {
    id: string;
    dueAt: string;
    title: string;
  } | null;
  hoursUntil: number | null;
  isLoading: boolean;
};

/**
 * Heuristic to identify feeding tasks.
 * Checks metadata type first, then falls back to title keywords.
 */
function isFeedTask(task: Task): boolean {
  // Check metadata type - 'feed' from task-factory, 'feeding' from nutrient engine
  if (task.metadata?.type === 'feed' || task.metadata?.type === 'feeding') {
    return true;
  }

  const lowerTitle = task.title.toLowerCase();
  return (
    lowerTitle.includes('feed') ||
    lowerTitle.includes('nutrient') ||
    lowerTitle.includes('fertiliz')
  );
}

async function fetchNextFeed(
  plantId: string
): Promise<NextFeedResult['nextFeed']> {
  const now = DateTime.now();
  const start = now.toJSDate();
  // Look ahead 14 days for the next feed to cover most schedules
  const end = now.plus({ days: 14 }).toJSDate();

  const tasks = await getTasksByDateRange(start, end);

  // Filter for this plant and feed type
  const feedTasks = tasks
    .filter((t) => t.plantId === plantId && t.status === 'pending')
    .filter(isFeedTask)
    .sort((a, b) => (a.dueAtLocal < b.dueAtLocal ? -1 : 1));

  if (feedTasks.length === 0) return null;

  const next = feedTasks[0];
  return {
    id: next.id,
    dueAt: next.dueAtLocal,
    title: next.title,
  };
}

export function useNextFeed(plantId: string): NextFeedResult {
  const { data, isLoading } = useQuery({
    queryKey: ['plant-next-feed', plantId],
    queryFn: () => fetchNextFeed(plantId),
    enabled: Boolean(plantId),
    staleTime: 60 * 1000, // 1 minute
  });

  const nextFeed = data ?? null;

  let hoursUntil: number | null = null;
  if (nextFeed) {
    const due = DateTime.fromISO(nextFeed.dueAt);
    const diff = due.diffNow('hours').hours;
    // Show 0 if overdue or due now, otherwise round to nearest hour
    hoursUntil = Math.max(0, Math.round(diff));
  }

  return {
    nextFeed,
    hoursUntil,
    isLoading,
  };
}
