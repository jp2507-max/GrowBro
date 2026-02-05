import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';

import {
  getCompletedTasksByDateRange,
  getTasksByDateRange,
} from '@/lib/task-manager';
import type { Task } from '@/types/calendar';

export type PlantTask = {
  id: string;
  title: string;
  description?: string;
  type: 'water' | 'feed' | 'other';
  completed: boolean;
};

function inferTaskType(title: string): PlantTask['type'] {
  const lowerTitle = title.toLowerCase();
  if (lowerTitle.includes('water') || lowerTitle.includes('watering')) {
    return 'water';
  }
  if (
    lowerTitle.includes('feed') ||
    lowerTitle.includes('nutrient') ||
    lowerTitle.includes('fertiliz')
  ) {
    return 'feed';
  }
  return 'other';
}

function transformTask(task: Task): PlantTask {
  const metadataType = task.metadata?.type;
  const type =
    metadataType === 'water' || metadataType === 'feed'
      ? metadataType
      : inferTaskType(task.title);

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    type,
    completed: task.status === 'completed',
  };
}

async function fetchTodaysTasksForPlant(plantId: string): Promise<PlantTask[]> {
  const now = DateTime.local();
  const startOfDay = now.startOf('day').toJSDate();
  const endOfDay = now.endOf('day').toJSDate();

  // Fetch both pending and completed tasks for today
  const [pendingTasks, completedTasks] = await Promise.all([
    getTasksByDateRange(startOfDay, endOfDay),
    getCompletedTasksByDateRange(startOfDay, endOfDay),
  ]);

  // Merge and deduplicate by task id
  const taskMap = new Map<string, Task>();
  for (const task of [...pendingTasks, ...completedTasks]) {
    if (!taskMap.has(task.id)) {
      taskMap.set(task.id, task);
    }
  }
  const allTasks = Array.from(taskMap.values());

  // Filter tasks for this specific plant
  const plantTasks = allTasks.filter((task) => task.plantId === plantId);

  // Sort: pending tasks first, then completed
  return plantTasks.map(transformTask).sort((a, b) => {
    if (a.completed === b.completed) return 0;
    return a.completed ? 1 : -1;
  });
}

type UsePlantTasksOptions = {
  enabled?: boolean;
};

type UsePlantTasksResult = {
  tasks: PlantTask[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<unknown>;
};

/**
 * Hook to fetch today's tasks (pending and completed) for a specific plant.
 */
export function usePlantTasks(
  plantId: string,
  options: UsePlantTasksOptions = {}
): UsePlantTasksResult {
  const { enabled = true } = options;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['plant-tasks', plantId],
    queryFn: () => fetchTodaysTasksForPlant(plantId),
    enabled: enabled && Boolean(plantId),
    staleTime: 30 * 1000, // 30 seconds
  });

  return {
    tasks: data ?? [],
    isLoading,
    isError,
    refetch,
  };
}
