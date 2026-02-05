import { classifyTaskCategory } from '@/lib/plant-telemetry';
import type { Task } from '@/types/calendar';

const HYDROLOGY_ENGINE_PREFIXES = [
  'hydrology.water_now',
  'hydrology.check_water_need',
  'hydrology.fertigate',
];
const CLIMATE_ENGINE_PREFIX = 'environment.climate_check';

function getEngineKey(task: Task): string | undefined {
  const engineKey = task.metadata?.engineKey;
  return typeof engineKey === 'string' && engineKey.length > 0
    ? engineKey
    : undefined;
}

function isEligibleEngineKey(engineKey: string): boolean {
  if (engineKey.startsWith(CLIMATE_ENGINE_PREFIX)) return true;
  return HYDROLOGY_ENGINE_PREFIXES.some((prefix) =>
    engineKey.startsWith(prefix)
  );
}

export function shouldPromptTaskOutcome(task: Task): boolean {
  if (!task.plantId) return false;
  const engineKey = getEngineKey(task);
  if (engineKey) return isEligibleEngineKey(engineKey);
  return classifyTaskCategory(task) === 'water';
}

export function getTaskOutcomeCheckInParams(task: Task): {
  plantId: string;
  source: 'task_outcome';
  sourceTaskId: string;
  sourceTaskEngineKey?: string;
} | null {
  if (!shouldPromptTaskOutcome(task) || !task.plantId) return null;
  return {
    plantId: task.plantId,
    source: 'task_outcome',
    sourceTaskId: task.id,
    sourceTaskEngineKey: getEngineKey(task),
  };
}
