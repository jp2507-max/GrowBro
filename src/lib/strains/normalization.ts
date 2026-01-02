/**
 * Data normalization utilities for strain information
 */

import type {
  Effect,
  Flavor,
  FloweringTime,
  GrowCharacteristics,
  GrowDifficulty,
  HeightInfo,
  PercentageRange,
  Strain,
  StrainRace,
  Terpene,
  YieldInfo,
} from '@/types/strains';

import {
  DEFAULT_DESCRIPTION,
  DEFAULT_FLOWERING_TIME,
  DEFAULT_HEIGHT,
  DEFAULT_YIELD,
  NOT_REPORTED,
} from './constants';

/**
 * Convert a string to URL-safe slug format
 * Handles spaces, special characters, and multiple dashes
 */
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with dashes
    .replace(/[^\w\-]+/g, '') // Remove non-word characters except dashes
    .replace(/\-\-+/g, '-') // Replace multiple dashes with single dash
    .replace(/^-+/, '') // Trim dashes from start
    .replace(/-+$/, ''); // Trim dashes from end
}

/**
 * Generates a fallback ID for strains missing an ID
 * Uses timestamp and random string for collision-resistant IDs
 */
export function generateId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `strain_${timestamp}_${random}`;
}

// Type for raw API percentage values
type RawPercentageValue =
  | string
  | number
  | { min?: number; max?: number; label?: string }
  | null
  | undefined;

/**
 * Parses percentage values that can be numeric, string, or qualitative
 * Handles formats like: "17%", "15-20%", "High", numeric values, objects
 *
 * @param value - Raw percentage value from API
 * @returns Normalized percentage range object
 */
export function parsePercentageRange(
  value: RawPercentageValue
): PercentageRange {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return {};
  }

  // Handle string values
  if (typeof value === 'string') {
    const trimmed = value.trim();

    // Handle empty strings
    if (trimmed.length === 0) {
      return {};
    }

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
export function normalizeRace(race: unknown): StrainRace {
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
export function normalizeGrowDifficulty(difficulty: unknown): GrowDifficulty {
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

// Type for raw API effect values
type RawEffect =
  | string
  | { name: string; intensity?: 'low' | 'medium' | 'high' };

/**
 * Normalizes effects array
 */
export function normalizeEffects(effects: unknown): Effect[] {
  if (!Array.isArray(effects)) {
    return [];
  }

  const mapped = effects
    .filter(
      (effect): effect is RawEffect =>
        effect !== null &&
        (typeof effect === 'string' ||
          (typeof effect === 'object' && typeof effect.name === 'string'))
    )
    .map((effect): Effect | null => {
      const name =
        typeof effect === 'string' ? effect.trim() : effect.name.trim();
      if (!name) {
        return null;
      }
      const intensity =
        effect &&
        typeof effect === 'object' &&
        typeof effect.intensity === 'string' &&
        ['low', 'medium', 'high'].includes(effect.intensity)
          ? (effect.intensity as 'low' | 'medium' | 'high')
          : undefined;
      return {
        name,
        intensity,
      };
    });

  return mapped.filter((effect): effect is Effect => effect !== null);
}

// Type for raw API flavor values
type RawFlavor = string | { name: string; category?: string };

/**
 * Normalizes flavors array
 */
export function normalizeFlavors(flavors: unknown): Flavor[] {
  if (!Array.isArray(flavors)) {
    return [];
  }

  return flavors
    .filter(
      (flavor): flavor is RawFlavor =>
        flavor !== null &&
        (typeof flavor === 'string' ||
          (typeof flavor === 'object' && typeof flavor.name === 'string'))
    )
    .map((flavor) => {
      if (typeof flavor === 'string') {
        const name = flavor.trim();
        return name ? { name } : null;
      }

      // At this point, flavor is an object with string name
      const name = flavor.name.trim();
      if (!name) return null;

      const result: Flavor = { name };

      if (typeof flavor.category === 'string') {
        result.category = flavor.category;
      }

      return result;
    })
    .filter((flavor): flavor is Flavor => flavor !== null);
}

// Type for raw API terpene values
type RawTerpene =
  | string
  | {
      name?: string;
      percentage?: number;
      aroma_description?: string;
    };

/**
 * Normalizes terpenes array
 */
export function normalizeTerpenes(terpenes: unknown): Terpene[] | undefined {
  if (!Array.isArray(terpenes) || terpenes.length === 0) {
    return undefined;
  }

  return terpenes
    .filter((terpene): terpene is RawTerpene => terpene != null)
    .map((terpene) =>
      typeof terpene === 'string'
        ? { name: String(terpene) }
        : {
            name: typeof terpene.name === 'string' ? terpene.name : undefined,
            percentage:
              typeof terpene.percentage === 'number'
                ? terpene.percentage
                : undefined,
            aroma_description: terpene.aroma_description || undefined,
          }
    )
    .filter((t): t is Terpene => typeof t.name === 'string');
}

// Type for raw API yield data
type RawYieldData =
  | {
      min_grams?: number;
      max_grams?: number;
      min_oz?: number;
      max_oz?: number;
      label?: string;
    }
  | null
  | undefined;

/**
 * Normalizes yield data for indoor or outdoor growing
 */
function normalizeYieldData(yieldData: RawYieldData): YieldInfo {
  if (!yieldData) return { label: DEFAULT_YIELD };

  return {
    min_grams:
      typeof yieldData.min_grams === 'number' ? yieldData.min_grams : undefined,
    max_grams:
      typeof yieldData.max_grams === 'number' ? yieldData.max_grams : undefined,
    min_oz: typeof yieldData.min_oz === 'number' ? yieldData.min_oz : undefined,
    max_oz: typeof yieldData.max_oz === 'number' ? yieldData.max_oz : undefined,
    label: yieldData.label || DEFAULT_YIELD,
  };
}

// Type for raw API flowering time data
type RawFloweringTime =
  | {
      min_weeks?: number;
      max_weeks?: number;
      label?: string;
    }
  | null
  | undefined;

/**
 * Normalizes flowering time data
 */
function normalizeFloweringTime(
  floweringTime: RawFloweringTime
): FloweringTime {
  return {
    min_weeks:
      typeof floweringTime?.min_weeks === 'number'
        ? floweringTime.min_weeks
        : undefined,
    max_weeks:
      typeof floweringTime?.max_weeks === 'number'
        ? floweringTime.max_weeks
        : undefined,
    label: floweringTime?.label || DEFAULT_FLOWERING_TIME,
  };
}

// Type for raw API height data
type RawHeightData =
  | {
      indoor_cm?: number;
      outdoor_cm?: number;
      label?: string;
    }
  | null
  | undefined;

/**
 * Normalizes height data
 */
function normalizeHeight(height: RawHeightData): HeightInfo {
  return {
    indoor_cm:
      typeof height?.indoor_cm === 'number' ? height.indoor_cm : undefined,
    outdoor_cm:
      typeof height?.outdoor_cm === 'number' ? height.outdoor_cm : undefined,
    label: height?.label || DEFAULT_HEIGHT,
  };
}

// Type for raw API grow characteristics
type RawGrowCharacteristics =
  | {
      difficulty?: unknown;
      indoor_suitable?: boolean;
      outdoor_suitable?: boolean;
      flowering_time?: RawFloweringTime;
      yield?: {
        indoor?: RawYieldData;
        outdoor?: RawYieldData;
      };
      height?: RawHeightData;
    }
  | null
  | undefined;

/**
 * Normalizes growing characteristics
 */
export function normalizeGrowCharacteristics(
  grow: RawGrowCharacteristics
): GrowCharacteristics {
  const difficulty = normalizeGrowDifficulty(grow?.difficulty);

  return {
    difficulty,
    indoor_suitable: Boolean(grow?.indoor_suitable ?? true),
    outdoor_suitable: Boolean(grow?.outdoor_suitable ?? true),
    flowering_time: normalizeFloweringTime(grow?.flowering_time),
    yield: {
      indoor: normalizeYieldData(grow?.yield?.indoor),
      outdoor: normalizeYieldData(grow?.yield?.outdoor),
    },
    height: normalizeHeight(grow?.height),
  };
}

// Type for raw API strain data
export type RawApiStrain = {
  id?: string | number;
  name?: string;
  slug?: string;
  synonyms?: unknown;
  link?: string;
  imageUrl?: string;
  image_url?: string;
  description?: string | string[];
  // Nested genetics object format
  genetics?:
    | {
        parents?: unknown;
        lineage?: string;
      }
    | string; // Can also be string like "Indica (90-100%)"
  parents?: unknown;
  lineage?: string;
  race?: unknown;
  type?: unknown;
  thc?: RawPercentageValue;
  cbd?: RawPercentageValue;
  // API uses both 'effects' and 'effect' (singular)
  effects?: unknown;
  effect?: unknown;
  // API uses both 'flavors' and 'smellAndFlavour'
  flavors?: unknown;
  smellAndFlavour?: unknown;
  terpenes?: unknown;
  // Nested grow object format
  grow?: RawGrowCharacteristics;
  // Flat grow fields from API (alternative format)
  growDifficulty?: string;
  growEnvironments?: unknown;
  floweringType?: string;
  floweringTime?: string;
  harvestTimeOutdoor?: string;
  yieldIndoor?: string;
  yieldOutdoor?: string;
  heightIndoor?: string;
  heightOutdoor?: string;
  source?: {
    provider?: string;
    updated_at?: string;
    attribution_url?: string;
  };
  // Additional fields
  THC?: string; // Alternative uppercase field
  CBD?: string; // Alternative uppercase field
};

/**
 * Parses flowering time string like "7-9 weeks" into structured data
 */
function parseFloweringTimeString(floweringTime?: string): FloweringTime {
  if (!floweringTime || typeof floweringTime !== 'string') {
    return { label: DEFAULT_FLOWERING_TIME };
  }

  // Try to parse "7-9 weeks" format
  const rangeMatch = floweringTime.match(/(\d+)\s*-\s*(\d+)\s*weeks?/i);
  if (rangeMatch) {
    return {
      min_weeks: parseInt(rangeMatch[1], 10),
      max_weeks: parseInt(rangeMatch[2], 10),
      label: floweringTime,
    };
  }

  // Try to parse single number "8 weeks"
  const singleMatch = floweringTime.match(/(\d+)\s*weeks?/i);
  if (singleMatch) {
    const weeks = parseInt(singleMatch[1], 10);
    return {
      min_weeks: weeks,
      max_weeks: weeks,
      label: floweringTime,
    };
  }

  return { label: floweringTime };
}

/**
 * Parses yield string like "Medium" or "700g/plant" into structured data
 */
function parseYieldString(yieldStr?: string): YieldInfo {
  if (!yieldStr || typeof yieldStr !== 'string') {
    return { label: DEFAULT_YIELD };
  }

  // Try to parse "700g/plant" or "500-700g" format
  const gramsMatch = yieldStr.match(/(\d+)(?:\s*-\s*(\d+))?\s*g/i);
  if (gramsMatch) {
    const minGrams = parseInt(gramsMatch[1], 10);
    const maxGrams = gramsMatch[2] ? parseInt(gramsMatch[2], 10) : minGrams;
    return {
      min_grams: minGrams,
      max_grams: maxGrams,
      label: yieldStr,
    };
  }

  // Qualitative values like "Medium", "High"
  return { label: yieldStr };
}

/**
 * Parses height string like "Medium" or "150cm" into structured data
 */
function parseHeightString(
  indoorHeight?: string,
  outdoorHeight?: string
): HeightInfo {
  const label = indoorHeight || outdoorHeight || DEFAULT_HEIGHT;

  // Try to extract numeric cm values
  let indoor_cm: number | undefined;
  let outdoor_cm: number | undefined;

  if (indoorHeight) {
    const match = indoorHeight.match(/(\d+)\s*cm/i);
    if (match) indoor_cm = parseInt(match[1], 10);
  }

  if (outdoorHeight) {
    const match = outdoorHeight.match(/(\d+)\s*cm/i);
    if (match) outdoor_cm = parseInt(match[1], 10);
  }

  return { indoor_cm, outdoor_cm, label };
}

/**
 * Extracts race from genetics string like "Indica (90-100%)"
 */
function extractRaceFromGenetics(genetics?: string | object): StrainRace {
  if (typeof genetics === 'string') {
    return normalizeRace(genetics);
  }
  return 'hybrid';
}

/**
 * Extracts parents from genetics string or parents field
 */
function extractParents(
  genetics?: string | { parents?: unknown; lineage?: string },
  parents?: unknown
): string[] {
  // Check direct parents field first
  if (typeof parents === 'string' && parents.trim()) {
    // Split by common delimiters
    return parents
      .split(/[,x×]/i)
      .map((p) => p.trim())
      .filter(Boolean);
  }

  if (Array.isArray(parents)) {
    return parents.filter(Boolean).map(String);
  }

  // Check genetics object
  if (genetics && typeof genetics === 'object' && 'parents' in genetics) {
    if (Array.isArray(genetics.parents)) {
      return genetics.parents.filter(Boolean).map(String);
    }
  }

  return [];
}

/**
 * Normalizes description from API response
 */
function normalizeDescription(description: unknown): string[] {
  if (Array.isArray(description)) {
    return description.filter(Boolean);
  }
  return description ? [String(description)] : [DEFAULT_DESCRIPTION];
}

/**
 * Normalizes synonyms from API response
 */
function normalizeSynonyms(synonyms: unknown): string[] {
  return Array.isArray(synonyms) ? synonyms.filter(Boolean).map(String) : [];
}

/**
 * Extracts genetics info from API response
 */
function extractGeneticsInfo(apiStrain: RawApiStrain): {
  geneticsStr?: string;
  geneticsObj?: { parents?: unknown; lineage?: string };
} {
  const geneticsStr =
    typeof apiStrain.genetics === 'string' ? apiStrain.genetics : undefined;
  const geneticsObj =
    typeof apiStrain.genetics === 'object' ? apiStrain.genetics : undefined;
  return { geneticsStr, geneticsObj };
}

/**
 * Builds grow characteristics from flat API fields
 */
function buildGrowFromFlatFields(apiStrain: RawApiStrain): GrowCharacteristics {
  return {
    difficulty: normalizeGrowDifficulty(apiStrain.growDifficulty),
    indoor_suitable: true,
    outdoor_suitable: true,
    flowering_time: parseFloweringTimeString(apiStrain.floweringTime),
    yield: {
      indoor: parseYieldString(apiStrain.yieldIndoor),
      outdoor: parseYieldString(apiStrain.yieldOutdoor),
    },
    height: parseHeightString(apiStrain.heightIndoor, apiStrain.heightOutdoor),
  };
}

/**
 * Normalizes complete strain data from API response
 *
 * @param apiStrain - Raw strain data from API
 * @param locale - Optional locale for formatting (defaults to 'en-US')
 * @returns Normalized Strain object
 */
export function normalizeStrain(
  apiStrain: RawApiStrain,
  locale = 'en-US'
): Strain {
  const thc = parsePercentageRange(apiStrain.thc ?? apiStrain.THC);
  const cbd = parsePercentageRange(apiStrain.cbd ?? apiStrain.CBD);
  const { geneticsStr, geneticsObj } = extractGeneticsInfo(apiStrain);

  const race =
    apiStrain.race || apiStrain.type
      ? normalizeRace(apiStrain.race || apiStrain.type)
      : extractRaceFromGenetics(apiStrain.genetics);

  const effects = normalizeEffects(apiStrain.effects || apiStrain.effect);
  const flavors = normalizeFlavors(
    apiStrain.flavors || apiStrain.smellAndFlavour
  );
  const grow = apiStrain.grow
    ? normalizeGrowCharacteristics(apiStrain.grow)
    : buildGrowFromFlatFields(apiStrain);

  return {
    id: String(apiStrain.id || generateId()),
    name: String(apiStrain.name || 'Unknown Strain'),
    slug: apiStrain.slug
      ? slugify(String(apiStrain.slug))
      : slugify(String(apiStrain.name || 'unknown')),
    synonyms: normalizeSynonyms(apiStrain.synonyms),
    link: String(apiStrain.link || ''),
    imageUrl: String(apiStrain.imageUrl || apiStrain.image_url || ''),
    description: normalizeDescription(apiStrain.description),
    genetics: {
      parents: extractParents(apiStrain.genetics, apiStrain.parents),
      lineage: String(
        geneticsObj?.lineage ?? apiStrain.lineage ?? geneticsStr ?? ''
      ),
    },
    race,
    thc,
    cbd,
    effects,
    flavors,
    terpenes: normalizeTerpenes(apiStrain.terpenes),
    grow,
    source: {
      provider: String(apiStrain.source?.provider || 'The Weed DB'),
      updated_at: String(
        apiStrain.source?.updated_at || new Date().toISOString()
      ),
      attribution_url: String(
        apiStrain.source?.attribution_url || 'https://www.theweedb.com'
      ),
    },
    thc_display: formatPercentageDisplay(thc, locale),
    cbd_display: formatPercentageDisplay(cbd, locale),
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

  if (weeks.min_weeks !== undefined && weeks.max_weeks !== undefined) {
    if (weeks.min_weeks === weeks.max_weeks) {
      return `${weeks.min_weeks} weeks`;
    }
    return `${weeks.min_weeks}-${weeks.max_weeks} weeks`;
  }

  if (weeks.min_weeks !== undefined) {
    return `${weeks.min_weeks}+ weeks`;
  }

  if (weeks.max_weeks !== undefined) {
    return `Up to ${weeks.max_weeks} weeks`;
  }

  return DEFAULT_FLOWERING_TIME;
}

/**
 * Formats yield information for display
 */
export function formatYield(
  yieldInfo?: {
    min_grams?: number;
    max_grams?: number;
    min_oz?: number;
    max_oz?: number;
    label?: string;
  },
  unit: 'grams' | 'oz' = 'grams'
): string {
  if (!yieldInfo) {
    return DEFAULT_YIELD;
  }

  if (yieldInfo.label) {
    return yieldInfo.label;
  }

  const unitLabel = unit === 'grams' ? 'g' : 'oz';
  const GRAMS_PER_OUNCE = 28.3495;

  // Normalize values to requested unit
  let minValue: number | undefined;
  let maxValue: number | undefined;

  if (unit === 'oz') {
    // Prefer oz values, otherwise convert from grams
    minValue =
      yieldInfo.min_oz !== undefined
        ? yieldInfo.min_oz
        : yieldInfo.min_grams !== undefined
          ? Math.round((yieldInfo.min_grams / GRAMS_PER_OUNCE) * 100) / 100
          : undefined;
    maxValue =
      yieldInfo.max_oz !== undefined
        ? yieldInfo.max_oz
        : yieldInfo.max_grams !== undefined
          ? Math.round((yieldInfo.max_grams / GRAMS_PER_OUNCE) * 100) / 100
          : undefined;
  } else {
    // Use grams directly
    minValue = yieldInfo.min_grams;
    maxValue = yieldInfo.max_grams;
  }

  // Check for no numeric values
  if (minValue === undefined && maxValue === undefined) {
    return DEFAULT_YIELD;
  }

  if (minValue !== undefined && maxValue !== undefined) {
    if (minValue === maxValue) {
      return `${minValue}${unitLabel}`;
    }
    return `${minValue}-${maxValue}${unitLabel}`;
  }

  if (minValue !== undefined) {
    return `${minValue}${unitLabel}+`;
  }

  if (maxValue !== undefined) {
    return `Up to ${maxValue}${unitLabel}`;
  }

  return DEFAULT_YIELD;
}
