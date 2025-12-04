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
  const wordBoundaryRegex = new RegExp(`\\b${normalizedQuery}`, 'i');
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
  const hasActiveFilters =
    filters.race !== undefined ||
    filters.difficulty !== undefined ||
    (filters.effects && filters.effects.length > 0) ||
    (filters.flavors && filters.flavors.length > 0) ||
    filters.thcMin !== undefined ||
    filters.thcMax !== undefined ||
    filters.cbdMin !== undefined ||
    filters.cbdMax !== undefined;

  // Early return if no filters or search active
  if (!hasActiveFilters && !hasSearchQuery) {
    return strains;
  }

  // Filter strains based on all criteria
  const filtered = strains.filter((strain) => {
    // Search query filter (matches name or synonyms)
    if (hasSearchQuery && !matchesSearchQuery(strain, searchQuery)) {
      return false;
    }
    // Race filter (exact match on normalized race)
    if (filters.race && strain.race !== filters.race) return false;
    // Difficulty filter (exact match)
    if (filters.difficulty && strain.grow.difficulty !== filters.difficulty) {
      return false;
    }
    // Effects & flavors (AND semantics)
    if (!matchesEffects(filters, strain)) return false;
    if (!matchesFlavors(filters, strain)) return false;
    // THC/CBD range filters (overlap check)
    if (!matchesCompoundRange(filters.thcMin, filters.thcMax, strain.thc)) {
      return false;
    }
    if (!matchesCompoundRange(filters.cbdMin, filters.cbdMax, strain.cbd)) {
      return false;
    }
    return true;
  });

  // Sort by search relevance if search query is active
  // This ensures strains starting with the query appear first
  if (hasSearchQuery) {
    return filtered.sort((a, b) => {
      const scoreA = getSearchRelevanceScore(a, searchQuery!);
      const scoreB = getSearchRelevanceScore(b, searchQuery!);
      return scoreB - scoreA; // Higher score first
    });
  }

  return filtered;
}
