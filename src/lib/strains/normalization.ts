/**
 * Data normalization utilities for strain information
 */

import type {
  Effect,
  Flavor,
  GrowCharacteristics,
  GrowDifficulty,
  PercentageRange,
  Strain,
  StrainRace,
  Terpene,
} from '@/types/strains';

import {
  DEFAULT_DESCRIPTION,
  DEFAULT_FLOWERING_TIME,
  DEFAULT_HEIGHT,
  DEFAULT_YIELD,
  FALLBACK_IMAGE_URL,
  NOT_REPORTED,
} from './constants';

/**
 * Generates a fallback ID for strains missing an ID
 */
export function generateId(): string {
  return `strain_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Parses percentage values that can be numeric, string, or qualitative
 * Handles formats like: "17%", "15-20%", "High", numeric values, objects
 *
 * @param value - Raw percentage value from API
 * @returns Normalized percentage range object
 */
export function parsePercentageRange(value: any): PercentageRange {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return {};
  }

  // Handle string values
  if (typeof value === 'string') {
    const trimmed = value.trim();

    // Handle qualitative values (High, Low, Medium, etc.)
    if (!/\d/.test(trimmed)) {
      return { label: trimmed };
    }

    // Remove % symbol if present
    const cleaned = trimmed.replace(/%/g, '');

    // Handle range format "15-20" or "15 - 20"
    const rangeMatch = cleaned.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
    if (rangeMatch) {
      const min = parseFloat(rangeMatch[1]);
      const max = parseFloat(rangeMatch[2]);
      return { min, max };
    }

    // Handle single numeric value "17" or "17%"
    const numericMatch = cleaned.match(/^(\d+(?:\.\d+)?)$/);
    if (numericMatch) {
      const val = parseFloat(numericMatch[1]);
      return { min: val, max: val };
    }

    // Fallback to label for unrecognized format
    return { label: trimmed };
  }

  // Handle numeric values
  if (typeof value === 'number') {
    return { min: value, max: value };
  }

  // Handle object with min/max fields
  if (typeof value === 'object') {
    const result: PercentageRange = {};

    if (typeof value.min === 'number') {
      result.min = value.min;
    }
    if (typeof value.max === 'number') {
      result.max = value.max;
    }
    if (typeof value.label === 'string') {
      result.label = value.label;
    }

    return result;
  }

  return {};
}

/**
 * Formats percentage range for display with locale support
 *
 * @param range - Parsed percentage range
 * @param locale - Optional locale for number formatting (defaults to 'en-US')
 * @returns Formatted display string
 */
export function formatPercentageDisplay(
  range: PercentageRange,
  locale = 'en-US'
): string {
  // Prioritize qualitative label
  if (range.label) {
    return range.label;
  }

  // Handle ranges
  if (range.min !== undefined && range.max !== undefined) {
    if (range.min === range.max) {
      return `${formatNumber(range.min, locale)}%`;
    }
    return `${formatNumber(range.min, locale)}-${formatNumber(range.max, locale)}%`;
  }

  // Handle min only
  if (range.min !== undefined) {
    return `${formatNumber(range.min, locale)}%+`;
  }

  // Handle max only
  if (range.max !== undefined) {
    return `Up to ${formatNumber(range.max, locale)}%`;
  }

  return NOT_REPORTED;
}

/**
 * Formats a number with locale-specific formatting
 * @param value - Number to format
 * @param locale - Locale for formatting
 * @returns Formatted number string
 */
function formatNumber(value: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    // Fallback for unsupported locales
    return value.toFixed(1).replace(/\.0$/, '');
  }
}

/**
 * Normalizes strain race/type values
 */
function normalizeRace(race: any): StrainRace {
  if (typeof race !== 'string') {
    return 'hybrid';
  }

  const normalized = race.toLowerCase().trim();

  if (normalized.includes('indica')) {
    return 'indica';
  }
  if (normalized.includes('sativa')) {
    return 'sativa';
  }

  return 'hybrid';
}

/**
 * Normalizes grow difficulty values
 */
function normalizeGrowDifficulty(difficulty: any): GrowDifficulty {
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
 * Normalizes effects array
 */
function normalizeEffects(effects: any): Effect[] {
  if (!Array.isArray(effects)) {
    return [];
  }

  return effects
    .filter((effect) => effect && typeof effect === 'object')
    .map((effect) => ({
      name: String(effect.name || effect),
      intensity: effect.intensity || undefined,
    }));
}

/**
 * Normalizes flavors array
 */
function normalizeFlavors(flavors: any): Flavor[] {
  if (!Array.isArray(flavors)) {
    return [];
  }

  return flavors
    .filter((flavor) => flavor)
    .map((flavor) =>
      typeof flavor === 'string'
        ? { name: flavor }
        : { name: String(flavor.name || flavor), category: flavor.category }
    );
}

/**
 * Normalizes terpenes array
 */
function normalizeTerpenes(terpenes: any): Terpene[] | undefined {
  if (!Array.isArray(terpenes) || terpenes.length === 0) {
    return undefined;
  }

  return terpenes
    .filter((terpene) => terpene && typeof terpene === 'object')
    .map((terpene) => ({
      name: String(terpene.name || ''),
      percentage:
        typeof terpene.percentage === 'number' ? terpene.percentage : undefined,
      aroma_description: terpene.aroma_description || undefined,
    }))
    .filter((terpene) => terpene.name);
}

/**
 * Normalizes growing characteristics
 */
function normalizeGrowCharacteristics(grow: any): GrowCharacteristics {
  const difficulty = normalizeGrowDifficulty(grow?.difficulty);

  return {
    difficulty,
    indoor_suitable: Boolean(grow?.indoor_suitable ?? true),
    outdoor_suitable: Boolean(grow?.outdoor_suitable ?? true),
    flowering_time: {
      min_weeks: grow?.flowering_time?.min_weeks,
      max_weeks: grow?.flowering_time?.max_weeks,
      label: grow?.flowering_time?.label || DEFAULT_FLOWERING_TIME,
    },
    yield: {
      indoor: grow?.yield?.indoor
        ? {
            min_grams: grow.yield.indoor.min_grams,
            max_grams: grow.yield.indoor.max_grams,
            min_oz: grow.yield.indoor.min_oz,
            max_oz: grow.yield.indoor.max_oz,
            label: grow.yield.indoor.label || DEFAULT_YIELD,
          }
        : { label: DEFAULT_YIELD },
      outdoor: grow?.yield?.outdoor
        ? {
            min_grams: grow.yield.outdoor.min_grams,
            max_grams: grow.yield.outdoor.max_grams,
            min_oz: grow.yield.outdoor.min_oz,
            max_oz: grow.yield.outdoor.max_oz,
            label: grow.yield.outdoor.label || DEFAULT_YIELD,
          }
        : { label: DEFAULT_YIELD },
    },
    height: {
      indoor_cm: grow?.height?.indoor_cm,
      outdoor_cm: grow?.height?.outdoor_cm,
      label: grow?.height?.label || DEFAULT_HEIGHT,
    },
  };
}

/**
 * Normalizes complete strain data from API response
 *
 * @param apiStrain - Raw strain data from API
 * @param locale - Optional locale for formatting (defaults to 'en-US')
 * @returns Normalized Strain object
 */
export function normalizeStrain(apiStrain: any, locale = 'en-US'): Strain {
  // Parse THC and CBD
  const thc = parsePercentageRange(apiStrain.thc);
  const cbd = parsePercentageRange(apiStrain.cbd);

  // Generate display strings
  const thc_display = formatPercentageDisplay(thc, locale);
  const cbd_display = formatPercentageDisplay(cbd, locale);

  // Normalize arrays
  const description = Array.isArray(apiStrain.description)
    ? apiStrain.description.filter(Boolean)
    : apiStrain.description
      ? [String(apiStrain.description)]
      : [DEFAULT_DESCRIPTION];

  const synonyms = Array.isArray(apiStrain.synonyms)
    ? apiStrain.synonyms.filter(Boolean).map(String)
    : [];

  return {
    id: apiStrain.id || generateId(),
    name: String(apiStrain.name || 'Unknown Strain'),
    slug: String(apiStrain.slug || apiStrain.name || 'unknown').toLowerCase(),
    synonyms,
    link: String(apiStrain.link || ''),
    imageUrl: String(
      apiStrain.imageUrl || apiStrain.image_url || FALLBACK_IMAGE_URL
    ),
    description,
    genetics: {
      parents: Array.isArray(apiStrain.genetics?.parents)
        ? apiStrain.genetics.parents.filter(Boolean).map(String)
        : [],
      lineage: String(apiStrain.genetics?.lineage || ''),
    },
    race: normalizeRace(apiStrain.race || apiStrain.type),
    thc,
    cbd,
    effects: normalizeEffects(apiStrain.effects),
    flavors: normalizeFlavors(apiStrain.flavors),
    terpenes: normalizeTerpenes(apiStrain.terpenes),
    grow: normalizeGrowCharacteristics(apiStrain.grow),
    source: {
      provider: String(apiStrain.source?.provider || 'The Weed DB'),
      updated_at: String(
        apiStrain.source?.updated_at || new Date().toISOString()
      ),
      attribution_url: String(
        apiStrain.source?.attribution_url || 'https://www.theweedb.com'
      ),
    },
    thc_display,
    cbd_display,
  };
}

/**
 * Formats flowering time for display
 */
export function formatFloweringTime(weeks?: {
  min_weeks?: number;
  max_weeks?: number;
}): string {
  if (!weeks) {
    return DEFAULT_FLOWERING_TIME;
  }

  if (weeks.min_weeks && weeks.max_weeks) {
    if (weeks.min_weeks === weeks.max_weeks) {
      return `${weeks.min_weeks} weeks`;
    }
    return `${weeks.min_weeks}-${weeks.max_weeks} weeks`;
  }

  if (weeks.min_weeks) {
    return `${weeks.min_weeks}+ weeks`;
  }

  if (weeks.max_weeks) {
    return `Up to ${weeks.max_weeks} weeks`;
  }

  return DEFAULT_FLOWERING_TIME;
}

/**
 * Formats yield information for display
 */
export function formatYield(
  yieldInfo?: { min_grams?: number; max_grams?: number; label?: string },
  unit: 'grams' | 'oz' = 'grams'
): string {
  if (!yieldInfo) {
    return DEFAULT_YIELD;
  }

  if (yieldInfo.label) {
    return yieldInfo.label;
  }

  const unitLabel = unit === 'grams' ? 'g' : 'oz';

  if (yieldInfo.min_grams && yieldInfo.max_grams) {
    if (yieldInfo.min_grams === yieldInfo.max_grams) {
      return `${yieldInfo.min_grams}${unitLabel}`;
    }
    return `${yieldInfo.min_grams}-${yieldInfo.max_grams}${unitLabel}`;
  }

  if (yieldInfo.min_grams) {
    return `${yieldInfo.min_grams}${unitLabel}+`;
  }

  if (yieldInfo.max_grams) {
    return `Up to ${yieldInfo.max_grams}${unitLabel}`;
  }

  return DEFAULT_YIELD;
}
