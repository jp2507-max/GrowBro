/**
 * Client-side filtering utilities for strains
 * Guarantees UI always matches selected filters, regardless of backend behavior
 */

import type { Strain, StrainFilters } from '@/api/strains/types';

type Range = { min?: number; max?: number };

/**
 * Normalize string for search comparison (lowercase, trim whitespace)
 */
function normalizeForSearch(str: string): string {
  return str.toLowerCase().trim();
}

/**
 * Check if a strain matches the search query
 * Primary match: strain name starts with or contains the search query
 * This provides intuitive "type-ahead" behavior for strain search
 */
function matchesSearchQuery(strain: Strain, query: string): boolean {
  if (!query || !query.trim()) return true;

  const normalizedQuery = normalizeForSearch(query);

  // If no valid search term, match everything
  if (normalizedQuery.length === 0) return true;

  // Primary search: match strain name (most intuitive for users)
  const normalizedName = normalizeForSearch(strain.name);
  if (normalizedName.includes(normalizedQuery)) {
    return true;
  }

  // Secondary search: check synonyms (alternative names)
  if (strain.synonyms?.length) {
    const matchesSynonym = strain.synonyms.some((synonym) =>
      normalizeForSearch(synonym).includes(normalizedQuery)
    );
    if (matchesSynonym) return true;
  }

  return false;
}

/**
 * Calculate search relevance score for sorting
 * Higher score = better match (name starts with query is best)
 */
function getSearchRelevanceScore(strain: Strain, query: string): number {
  if (!query || !query.trim()) return 0;

  const normalizedQuery = normalizeForSearch(query);
  const normalizedName = normalizeForSearch(strain.name);

  // Best: name starts with query (e.g., "Ta" matches "Tangie")
  if (normalizedName.startsWith(normalizedQuery)) {
    return 100;
  }

  // Good: name contains query as a word boundary (e.g., "blue" in "Blue Dream")
  // Escape any regex metacharacters in the user-derived query to avoid
  // catastrophic backtracking/DoS and ensure literal matching. Also cap
  // the query length to a reasonable maximum.
  const MAX_QUERY_LENGTH = 100;
  const escapedQuery = normalizeForSearch(
    normalizedQuery.slice(0, MAX_QUERY_LENGTH)
  ).replace(/[.*+?^${}()|[\]\\/]/g, (m) => `\\${m}`);
  const wordBoundaryRegex = new RegExp(`\\b${escapedQuery}`, 'i');
  if (wordBoundaryRegex.test(strain.name)) {
    return 75;
  }

  // Okay: name contains query anywhere
  if (normalizedName.includes(normalizedQuery)) {
    return 50;
  }

  // Lower: synonym matches
  if (strain.synonyms?.length) {
    for (const synonym of strain.synonyms) {
      const normalizedSynonym = normalizeForSearch(synonym);
      if (normalizedSynonym.startsWith(normalizedQuery)) return 40;
      if (normalizedSynonym.includes(normalizedQuery)) return 25;
    }
  }

  return 0;
}

/**
 * Check if two numeric ranges overlap
 * Returns true if there's any intersection between [a.min, a.max] and [b.min, b.max]
 */
function rangesOverlap(a: Range, b: Range): boolean {
  const { min: aMin, max: aMax } = a;
  const { min: bMin, max: bMax } = b;
  // If either range is completely undefined, consider it a match (no filter)
  if (aMin === undefined && aMax === undefined) return true;
  if (bMin === undefined && bMax === undefined) return true;

  // Normalize undefined bounds to -Infinity/+Infinity
  const a0 = aMin ?? -Infinity;
  const a1 = aMax ?? Infinity;
  const b0 = bMin ?? -Infinity;
  const b1 = bMax ?? Infinity;

  // Ranges overlap if one starts before the other ends
  return a0 <= b1 && b0 <= a1;
}

/**
 * Check if a strain's compound range (THC/CBD) matches the filter range.
 * Returns true if no filter is active or if ranges overlap.
 */
function matchesCompoundRange(
  filterMin: number | undefined,
  filterMax: number | undefined,
  strainRange: Range
): boolean {
  // No filter active
  if (filterMin === undefined && filterMax === undefined) return true;
  // Strain has no data for this compound
  if (strainRange.min === undefined && strainRange.max === undefined) {
    return false;
  }
  return rangesOverlap({ min: filterMin, max: filterMax }, strainRange);
}

/** Check if strain has all required effects */
function matchesEffects(filters: StrainFilters, strain: Strain): boolean {
  if (!filters.effects || filters.effects.length === 0) return true;
  const strainEffectNames = new Set(
    strain.effects.map((e) => e.name.toLowerCase())
  );
  return filters.effects.every((effect) =>
    strainEffectNames.has(effect.toLowerCase())
  );
}

/** Check if strain has all required flavors */
function matchesFlavors(filters: StrainFilters, strain: Strain): boolean {
  if (!filters.flavors || filters.flavors.length === 0) return true;
  const strainFlavorNames = new Set(
    strain.flavors.map((f) => f.name.toLowerCase())
  );
  return filters.flavors.every((flavor) =>
    strainFlavorNames.has(flavor.toLowerCase())
  );
}

/** Filters with snake_case keys from API */
type FiltersWithSnakeCase = StrainFilters & {
  thc_min?: number;
  thc_max?: number;
  cbd_min?: number;
  cbd_max?: number;
};

/** Normalize filter keys: accept either camelCase or snake_case */
function normalizeFilters(filters: StrainFilters): StrainFilters {
  const f = filters as FiltersWithSnakeCase;
  return {
    ...filters,
    thcMin: f.thcMin ?? f.thc_min ?? undefined,
    thcMax: f.thcMax ?? f.thc_max ?? undefined,
    cbdMin: f.cbdMin ?? f.cbd_min ?? undefined,
    cbdMax: f.cbdMax ?? f.cbd_max ?? undefined,
  };
}

/** Check if strain matches race filter (single value or array) */
function matchesRace(
  raceFilter: string | string[] | undefined,
  strainRace: string
): boolean {
  if (!raceFilter) return true;
  if (Array.isArray(raceFilter)) {
    return raceFilter.length === 0 || raceFilter.includes(strainRace);
  }
  return strainRace === raceFilter;
}

/** Check if strain matches difficulty filter (single value or array) */
function matchesDifficulty(
  difficultyFilter: string | string[] | undefined,
  strainDifficulty: string
): boolean {
  if (!difficultyFilter) return true;
  if (Array.isArray(difficultyFilter)) {
    return (
      difficultyFilter.length === 0 ||
      difficultyFilter.includes(strainDifficulty)
    );
  }
  return strainDifficulty === difficultyFilter;
}

/**
 * Apply client-side filters to a list of normalized strains
 * This ensures the UI always reflects the selected filters, even if:
 * - The backend returns extra data
 * - We're using cached/offline data
 * - The API doesn't support certain filter combinations
 *
 * @param strains - Array of normalized Strain objects
 * @param filters - Current filter selections from the UI
 * @param searchQuery - Optional search query to filter by name/description
 * @returns Filtered array of strains matching all criteria
 */
export function applyStrainFilters(
  strains: Strain[],
  filters: StrainFilters,
  searchQuery?: string
): Strain[] {
  const hasSearchQuery = searchQuery && searchQuery.trim().length > 0;
  const nf = normalizeFilters(filters);

  const hasActiveFilters =
    nf.race !== undefined ||
    nf.difficulty !== undefined ||
    (nf.effects && nf.effects.length > 0) ||
    (nf.flavors && nf.flavors.length > 0) ||
    nf.thcMin !== undefined ||
    nf.thcMax !== undefined ||
    nf.cbdMin !== undefined ||
    nf.cbdMax !== undefined;

  if (!hasActiveFilters && !hasSearchQuery) return strains;

  const filtered = strains.filter((strain) => {
    if (hasSearchQuery && !matchesSearchQuery(strain, searchQuery))
      return false;
    if (!matchesRace(nf.race, strain.race)) return false;
    if (!matchesDifficulty(nf.difficulty, strain.grow.difficulty)) return false;
    if (!matchesEffects(nf, strain)) return false;
    if (!matchesFlavors(nf, strain)) return false;
    if (!matchesCompoundRange(nf.thcMin, nf.thcMax, strain.thc)) return false;
    if (!matchesCompoundRange(nf.cbdMin, nf.cbdMax, strain.cbd)) return false;
    return true;
  });

  if (hasSearchQuery) {
    return filtered.sort((a, b) => {
      const scoreA = getSearchRelevanceScore(a, searchQuery!);
      const scoreB = getSearchRelevanceScore(b, searchQuery!);
      return scoreB - scoreA;
    });
  }

  return filtered;
}
