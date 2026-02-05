import type { Race, Strain } from '@/api/strains/types';
import { supabase } from '@/lib/supabase';

import {
  DEFAULT_DESCRIPTION,
  DEFAULT_FLOWERING_TIME,
  DEFAULT_HEIGHT,
  DEFAULT_YIELD,
  NOT_REPORTED,
} from './constants';
import { generateId } from './normalization';

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

export function buildCustomStrain(name: string, race: Race = 'hybrid'): Strain {
  const id = generateId();
  const slug = slugify(name);

  const now = new Date().toISOString();

  return {
    id,
    name,
    slug,
    synonyms: [],
    link: '',
    imageUrl: '',
    description: [DEFAULT_DESCRIPTION],
    genetics: { parents: [], lineage: '' },
    race,
    thc: {},
    cbd: {},
    effects: [],
    flavors: [],
    terpenes: undefined,
    grow: {
      difficulty: 'beginner',
      indoor_suitable: true,
      outdoor_suitable: true,
      flowering_time: { label: DEFAULT_FLOWERING_TIME },
      yield: {
        indoor: { label: DEFAULT_YIELD },
        outdoor: { label: DEFAULT_YIELD },
      },
      height: { label: DEFAULT_HEIGHT },
    },
    source: {
      provider: 'custom',
      updated_at: now,
      attribution_url: '',
    },
    thc_display: NOT_REPORTED,
    cbd_display: NOT_REPORTED,
  };
}

function logSubmissionError(error: unknown): void {
  const errorWithCode = error as { code?: string };
  const isDuplicate = errorWithCode.code === '23505';
  if (isDuplicate) {
    console.debug('[custom-strain] duplicate submission ignored', error);
  } else {
    console.warn('[custom-strain] submission failed', error);
  }
}

async function submitCustomStrainToSupabase(strain: Strain): Promise<void> {
  // IMPORTANT:
  // `public.strain_cache` is service-role-only writable (RLS). So we do NOT write
  // user-generated strains into that table.
  //
  // Instead, user-created strains are submitted into `public.community_strains`
  // with a `pending` status for moderation, and only become visible to others
  // after approval.
  try {
    const { error } = await supabase.from('community_strains').insert({
      id: strain.id,
      slug: strain.slug,
      name: strain.name,
      race: strain.race,
      data: strain,
      status: 'pending',
    });

    if (error) {
      logSubmissionError(error);
    }
  } catch (error) {
    logSubmissionError(error);
  }
}

export async function saveCustomStrainToSupabase(
  strain: Strain
): Promise<void> {
  return submitCustomStrainToSupabase(strain);
}

export async function saveStrainToSupabase(strain: Strain): Promise<void> {
  // NOTE:
  // `public.strain_cache` is service-role-only writable. Server-side caching is
  // handled by the `strains-proxy` Edge Function / backfill scripts.
  void strain;
}
