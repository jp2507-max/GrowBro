import { NoopAnalytics } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';
import type { Series, Task } from '@/types/calendar';

type TelemetryCategory = 'water' | 'feed' | null;

// Input type for series-based task completion (contains only fields needed for telemetry)
export type SeriesTaskInput = {
  title: string;
  description?: string;
  plantId?: string;
  metadata?: Record<string, unknown>;
};

function isTestEnvironment(): boolean {
  return (
    typeof process !== 'undefined' &&
    !!(
      process.env &&
      (process.env as NodeJS.ProcessEnv & { JEST_WORKER_ID?: string })
        .JEST_WORKER_ID !== undefined
    )
  );
}

export function classifyTaskCategory(
  task: Pick<Task, 'title' | 'description' | 'metadata'>
): TelemetryCategory {
  const meta = JSON.stringify(task.metadata ?? {});
  const haystack = [task.title ?? '', task.description ?? '', meta]
    .join(' ')
    .toLowerCase()
    .trim();

  // Basic keyword classification; future: template metadata or explicit category
  const water = /(\bwater(ing)?\b|\bmist(ing)?\b)/i.test(haystack);
  if (water) return 'water';
  const feed = /(\bfeed(ing)?\b|\bnutrient(s)?\b|\bfertil)/i.test(haystack);
  if (feed) return 'feed';
  return null;
}

function isValidPlantId(plantId?: string): boolean {
  if (!plantId || typeof plantId !== 'string') return false;
  // UUID v4/any version basic validation
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRe.test(plantId);
}

async function updatePlantField(
  plantId: string,
  field: 'last_watered_at' | 'last_fed_at'
): Promise<void> {
  try {
    // In tests, avoid network interactions entirely
    if (isTestEnvironment()) return;

    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from('plants')
      .update({ [field]: nowIso })
      .eq('id', plantId)
      .select('id');
    if (error) throw error;
  } catch (error) {
    // Non-blocking by design: log only
    console.warn('[PlantTelemetry] Failed to update plant field', {
      field,
      error,
    });
  }
}

export async function onTaskCompleted(
  input: Task | SeriesTaskInput
): Promise<void> {
  // Extract the fields we need for telemetry, with proper defaults
  const taskData = {
    title: input.title,
    description: input.description,
    plantId: input.plantId,
    metadata: input.metadata ?? {},
  };

  // Validate required fields
  if (!taskData.title || typeof taskData.title !== 'string') {
    console.warn('[PlantTelemetry] Invalid task title for telemetry');
    return;
  }

  const category = classifyTaskCategory(taskData);
  if (!category) return;

  if (!isValidPlantId(taskData.plantId)) return;

  // Extract task ID if available (for analytics tracking)
  const taskId = 'id' in input ? input.id : undefined;

  if (category === 'water') {
    NoopAnalytics.track('plant_watered', {
      taskId: taskId || 'series-occurrence',
    });
    await updatePlantField(taskData.plantId!, 'last_watered_at');
  } else if (category === 'feed') {
    NoopAnalytics.track('plant_fed', {
      taskId: taskId || 'series-occurrence',
    });
    await updatePlantField(taskData.plantId!, 'last_fed_at');
  }
}

export async function onSeriesOccurrenceCompleted(
  series: Series
): Promise<void> {
  const seriesTaskInput: SeriesTaskInput = {
    title: series.title,
    description: series.description,
    plantId: series.plantId,
    metadata: {},
  };

  await onTaskCompleted(seriesTaskInput);
}
