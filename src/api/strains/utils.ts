import { parsePercentageRange } from '@/lib/strains';

import type {
  Effect,
  Flavor,
  GrowCharacteristics,
  GrowDifficulty,
  PercentageRange,
  Race,
  Strain,
  Terpene,
} from './types';
export { parsePercentageRange };

/**
 * Default placeholder for missing strain images
 */
export const DEFAULT_STRAIN_IMAGE =
  'https://placehold.co/400x300/e5e5e5/666666?text=No+Image';

/**
 * Default BlurHash placeholder for image loading
 */
export const DEFAULT_BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

/**
 * Normalize race value to standard format
 */
export function normalizeRace(race: any): Race {
  if (typeof race !== 'string') return 'hybrid';

  const normalized = race.toLowerCase().trim();
  if (normalized.includes('indica')) return 'indica';
  if (normalized.includes('sativa')) return 'sativa';
  return 'hybrid';
}

/**
 * Format percentage range for display with locale support
 */
export function formatPercentageDisplay(
  range: PercentageRange,
  locale: string = 'en-US'
): string {
  // Use label if available
  if (range.label) {
    return range.label;
  }

  // Format numeric ranges
  if (range.min !== undefined && range.max !== undefined) {
    const formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });

    if (range.min === range.max) {
      return `${formatter.format(range.min)}%`;
    }
    return `${formatter.format(range.min)}-${formatter.format(range.max)}%`;
  }

  // Handle min-only (e.g., "15%+")
  if (range.min !== undefined) {
    const formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });
    return `${formatter.format(range.min)}%+`;
  }

  // Fallback for missing data
  return 'Not reported';
}

/**
 * Normalize effects array
 */
export function normalizeEffects(effects: any): Effect[] {
  if (!Array.isArray(effects)) {
    return [];
  }

  return effects
    .map((effect) => {
      if (typeof effect === 'string') {
        return { name: effect };
      }
      if (typeof effect === 'object' && effect !== null && effect.name) {
        return {
          name: effect.name,
          intensity: ['low', 'medium', 'high'].includes(effect.intensity)
            ? effect.intensity
            : undefined,
        };
      }
      return null;
    })
    .filter((e): e is Effect => e !== null);
}

/**
 * Normalize flavors array
 */
export function normalizeFlavors(flavors: any): Flavor[] {
  if (!Array.isArray(flavors)) {
    return [];
  }

  return flavors
    .map((flavor) => {
      if (typeof flavor === 'string') {
        return { name: flavor };
      }
      if (typeof flavor === 'object' && flavor !== null && flavor.name) {
        return {
          name: flavor.name,
          category: flavor.category || undefined,
        };
      }
      return null;
    })
    .filter((f): f is Flavor => f !== null);
}

/**
 * Normalize terpenes array
 */
export function normalizeTerpenes(terpenes: any): Terpene[] | undefined {
  if (!Array.isArray(terpenes) || terpenes.length === 0) {
    return undefined;
  }

  return terpenes
    .map((terpene) => {
      if (typeof terpene === 'string') {
        return { name: terpene };
      }
      if (typeof terpene === 'object' && terpene !== null && terpene.name) {
        return {
          name: terpene.name,
          percentage:
            typeof terpene.percentage === 'number'
              ? terpene.percentage
              : undefined,
          aroma_description: terpene.aroma_description || undefined,
        };
      }
      return null;
    })
    .filter((t): t is Terpene => t !== null);
}

/**
 * Normalize grow difficulty
 */
export function normalizeGrowDifficulty(difficulty: any): GrowDifficulty {
  if (typeof difficulty !== 'string') {
    return 'intermediate';
  }

  const normalized = difficulty.toLowerCase().trim();
  if (normalized.includes('beginner') || normalized.includes('easy')) {
    return 'beginner';
  }
  if (normalized.includes('advanced') || normalized.includes('expert')) {
    return 'advanced';
  }
  return 'intermediate';
}

/**
 * Normalize grow characteristics
 */
export function normalizeGrowCharacteristics(grow: any): GrowCharacteristics {
  if (typeof grow !== 'object' || grow === null) {
    return {
      difficulty: 'intermediate',
      indoor_suitable: true,
      outdoor_suitable: true,
      flowering_time: {},
      yield: {},
      height: {},
    };
  }

  return {
    difficulty: normalizeGrowDifficulty(grow.difficulty),
    indoor_suitable: Boolean(grow.indoor_suitable ?? true),
    outdoor_suitable: Boolean(grow.outdoor_suitable ?? true),
    flowering_time: {
      min_weeks:
        typeof grow.flowering_time?.min_weeks === 'number'
          ? grow.flowering_time.min_weeks
          : undefined,
      max_weeks:
        typeof grow.flowering_time?.max_weeks === 'number'
          ? grow.flowering_time.max_weeks
          : undefined,
      label: grow.flowering_time?.label || undefined,
    },
    yield: {
      indoor: grow.yield?.indoor
        ? {
            min_grams:
              typeof grow.yield.indoor.min_grams === 'number'
                ? grow.yield.indoor.min_grams
                : undefined,
            max_grams:
              typeof grow.yield.indoor.max_grams === 'number'
                ? grow.yield.indoor.max_grams
                : undefined,
            label: grow.yield.indoor.label || undefined,
          }
        : undefined,
      outdoor: grow.yield?.outdoor
        ? {
            min_grams:
              typeof grow.yield.outdoor.min_grams === 'number'
                ? grow.yield.outdoor.min_grams
                : undefined,
            max_grams:
              typeof grow.yield.outdoor.max_grams === 'number'
                ? grow.yield.outdoor.max_grams
                : undefined,
            label: grow.yield.outdoor.label || undefined,
          }
        : undefined,
    },
    height: {
      indoor_cm:
        typeof grow.height?.indoor_cm === 'number'
          ? grow.height.indoor_cm
          : undefined,
      outdoor_cm:
        typeof grow.height?.outdoor_cm === 'number'
          ? grow.height.outdoor_cm
          : undefined,
      label: grow.height?.label || undefined,
    },
  };
}

/**
 * Generate a slug from a string
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Normalize complete strain data from API response
 */
export function normalizeStrain(
  apiStrain: any,
  locale: string = 'en-US'
): Strain {
  const thc = parsePercentageRange(apiStrain.thc);
  const cbd = parsePercentageRange(apiStrain.cbd);

  return {
    id: apiStrain.id || generateId(),
    name: apiStrain.name || 'Unknown Strain',
    slug: apiStrain.slug || slugify(apiStrain.name || 'unknown'),
    synonyms: Array.isArray(apiStrain.synonyms) ? apiStrain.synonyms : [],
    link: apiStrain.link || '',
    imageUrl: apiStrain.image || apiStrain.imageUrl || DEFAULT_STRAIN_IMAGE,
    description: Array.isArray(apiStrain.description)
      ? apiStrain.description
      : apiStrain.description
        ? [apiStrain.description]
        : ['No description available'],
    genetics: {
      parents: Array.isArray(apiStrain.parents)
        ? apiStrain.parents
        : apiStrain.genetics?.parents || [],
      lineage: apiStrain.lineage || apiStrain.genetics?.lineage || '',
    },
    race: normalizeRace(apiStrain.race || apiStrain.type),
    thc,
    cbd,
    effects: normalizeEffects(apiStrain.effects),
    flavors: normalizeFlavors(apiStrain.flavors),
    terpenes: normalizeTerpenes(apiStrain.terpenes),
    grow: normalizeGrowCharacteristics(apiStrain.grow),
    source: {
      provider: 'The Weed DB',
      updated_at: new Date().toISOString(),
      attribution_url: apiStrain.link || '',
    },
    thc_display: formatPercentageDisplay(thc, locale),
    cbd_display: formatPercentageDisplay(cbd, locale),
  };
}
