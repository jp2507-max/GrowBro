import { useQuery } from '@tanstack/react-query';
import { DateTime } from 'luxon';

import { getTasksByDateRange } from '@/lib/task-manager';
import type { Task } from '@/types/calendar';

type PlantTask = {
  id: string;
  title: string;
  type: 'water' | 'feed' | 'other';
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
  return {
    id: task.id,
    title: task.title,
    type: inferTaskType(task.title),
  };
}

async function fetchTodaysTasksForPlant(plantId: string): Promise<PlantTask[]> {
  const now = DateTime.local();
  const startOfDay = now.startOf('day').toJSDate();
  const endOfDay = now.endOf('day').toJSDate();

  const allTasks = await getTasksByDateRange(startOfDay, endOfDay);

  // Filter tasks for this specific plant
  const plantTasks = allTasks.filter((task) => task.plantId === plantId);

  return plantTasks.map(transformTask);
}

type UsePlantTasksOptions = {
  enabled?: boolean;
};

type UsePlantTasksResult = {
  tasks: PlantTask[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
};

/**
 * Hook to fetch today's pending tasks for a specific plant.
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
