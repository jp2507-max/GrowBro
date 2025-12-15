import type { Race, Strain } from '@/api/strains/types';

import {
  DEFAULT_DESCRIPTION,
  DEFAULT_FLOWERING_TIME,
  DEFAULT_HEIGHT,
  DEFAULT_YIELD,
  FALLBACK_IMAGE_URL,
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
    imageUrl: FALLBACK_IMAGE_URL,
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

async function upsertStrainToSupabase(strain: Strain): Promise<void> {
  try {
    const { supabase } = await import('@/lib/supabase');
    const { error } = await supabase.from('strain_cache').upsert(
      {
        id: strain.id,
        slug: strain.slug,
        name: strain.name,
        race: strain.race,
        data: strain,
      },
      { onConflict: 'id' }
    );

    if (error) {
      console.debug('[custom-strain-cache] upsert failed', error);
    }
  } catch (error) {
    console.debug('[custom-strain-cache] Supabase client unavailable', error);
  }
}

export async function saveCustomStrainToSupabase(
  strain: Strain
): Promise<void> {
  return upsertStrainToSupabase(strain);
}

export async function saveStrainToSupabase(strain: Strain): Promise<void> {
  return upsertStrainToSupabase(strain);
}
