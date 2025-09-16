import type { DeletionAdapter } from '@/lib/privacy/deletion-adapter';
import { supabase } from '@/lib/supabase';

async function deleteByPrefix(
  prefix: string,
  countHint?: number
): Promise<number> {
  try {
    // List objects under the prefix; fetch up to countHint (or a safe cap)
    const limit = Math.max(1, Math.min(countHint ?? 100, 1000));
    const { data, error } = await supabase.storage
      .from('plant-images')
      .list(prefix, {
        limit,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' },
      } as any);
    if (error) return 0;
    const files = (data ?? []).filter((e: any) => e && e.name && !e.id);
    if (files.length === 0) return 0;
    const paths = files.map((f: any) => `${prefix}/${f.name}`);
    const { error: rmError } = await supabase.storage
      .from('plant-images')
      .remove(paths);
    if (rmError) return 0;
    return paths.length;
  } catch {
    return 0;
  }
}

export function createSupabaseDeletionAdapter(): DeletionAdapter {
  return {
    async purgeInferenceImages(countHint?: number): Promise<number> {
      return deleteByPrefix('inference', countHint);
    },
    async purgeTrainingImages(countHint?: number): Promise<number> {
      return deleteByPrefix('training', countHint);
    },
  };
}
