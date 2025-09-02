import { NoopAnalytics } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';
import type { Series, Task } from '@/types/calendar';

type TelemetryCategory = 'water' | 'feed' | null;

function isTestEnvironment(): boolean {
  return (
    typeof process !== 'undefined' &&
    !!(process.env && (process.env as any).JEST_WORKER_ID !== undefined)
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

export async function onTaskCompleted(task: Task): Promise<void> {
  const category = classifyTaskCategory(task);
  if (!category) return;

  if (!isValidPlantId(task.plantId)) return;

  if (category === 'water') {
    NoopAnalytics.track('notif_rehydrate_scheduled', { taskId: task.id });
    await updatePlantField(task.plantId!, 'last_watered_at');
  } else if (category === 'feed') {
    NoopAnalytics.track('notif_rehydrate_scheduled', { taskId: task.id });
    await updatePlantField(task.plantId!, 'last_fed_at');
  }
}

export async function onSeriesOccurrenceCompleted(
  series: Series
): Promise<void> {
  const pseudoTask = {
    title: series.title,
    description: series.description,
    metadata: {},
    plantId: series.plantId,
  } as unknown as Task;
  await onTaskCompleted(pseudoTask);
}
