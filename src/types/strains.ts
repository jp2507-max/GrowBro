/**
 * Type definitions for cannabis strain data
 */

/**
 * Race/type classification for cannabis strains
 */
export type StrainRace = 'indica' | 'sativa' | 'hybrid';

/**
 * Grow difficulty levels
 */
export type GrowDifficulty = 'beginner' | 'intermediate' | 'advanced';

/**
 * Percentage range that can be numeric or qualitative
 */
export interface PercentageRange {
  min?: number;
  max?: number;
  label?: string;
}

/**
 * Genetics information for a strain
 */
export interface StrainGenetics {
  parents: string[];
  lineage: string;
}

/**
 * Effect with optional intensity
 */
export interface Effect {
  name: string;
  intensity?: 'low' | 'medium' | 'high';
}

/**
 * Flavor profile with optional category
 */
export interface Flavor {
  name: string;
  category?: string;
}

/**
 * Terpene information with optional percentage and aroma description
 */
export interface Terpene {
  name: string;
  percentage?: number;
  aroma_description?: string;
}

/**
 * Yield information for indoor/outdoor growing
 */
export interface YieldInfo {
  min_grams?: number;
  max_grams?: number;
  min_oz?: number;
  max_oz?: number;
  label?: string;
}

/**
 * Flowering time range
 */
export interface FloweringTime {
  min_weeks?: number;
  max_weeks?: number;
  label?: string;
}

/**
 * Height information
 */
export interface HeightInfo {
  indoor_cm?: number;
  outdoor_cm?: number;
  label?: string;
}

/**
 * Strain type classification for playbook customization
 */
export type StrainType = 'autoflower' | 'photoperiod';

/**
 * Sativa/Indica lean for strain characteristics
 */
export type StrainLean = 'sativa' | 'indica' | 'balanced';

/**
 * Breeder-provided flowering range
 */
export interface BreederFloweringRange {
  min_weeks: number;
  max_weeks: number;
  source?: string; // Breeder name or source
}

/**
 * Growing characteristics and requirements
 */
export interface GrowCharacteristics {
  difficulty: GrowDifficulty;
  indoor_suitable: boolean;
  outdoor_suitable: boolean;
  flowering_time: FloweringTime;
  yield: {
    indoor?: YieldInfo;
    outdoor?: YieldInfo;
  };
  height: HeightInfo;
  // New fields for playbook customization
  strain_type?: StrainType; // autoflower or photoperiod
  breeder_flowering_range?: BreederFloweringRange; // Breeder-specific timing
  strain_lean?: StrainLean; // sativa/indica/balanced
}

/**
 * Source provenance metadata
 */
export interface StrainSource {
  provider: string;
  updated_at: string;
  attribution_url: string;
}

/**
 * Complete strain data model
 */
export interface Strain {
  id: string;
  name: string;
  slug: string;
  synonyms: string[];
  link: string;
  imageUrl: string;
  description: string[];
  genetics: StrainGenetics;
  race: StrainRace;
  thc: PercentageRange;
  cbd: PercentageRange;
  effects: Effect[];
  flavors: Flavor[];
  terpenes?: Terpene[];
  grow: GrowCharacteristics;
  source: StrainSource;

  // Computed display fields
  thc_display: string;
  cbd_display: string;
}

/**
 * Snapshot of strain data for favorites persistence
 */
export interface FavoriteStrainSnapshot {
  id: string;
  name: string;
  slug: string;
  race: StrainRace;
  thc_display: string;
  imageUrl: string;
}

/**
 * Favorite strain with metadata
 */
export interface FavoriteStrain {
  id: string;
  addedAt: number;
  snapshot: FavoriteStrainSnapshot;
}

/**
 * Indexed collection of favorites for fast lookup
 */
export type FavoritesIndex = Record<string, FavoriteStrain>;

/**
 * Filter options for strain search
 */
export interface StrainFilters {
  race?: StrainRace[];
  effects?: string[];
  flavors?: string[];
  difficulty?: GrowDifficulty[];
  // Primary (snake_case) fields used across the codebase and persisted to
  // storage/backends.
  thc_min?: number;
  thc_max?: number;
  cbd_min?: number;
  cbd_max?: number;

  // CamelCase aliases accepted by some API modules and helpers (e.g. the
  // client-side normalizeFilters routine). Providing these aliases here makes
  // the type compatible with both conventions so callers can use either
  // snake_case or camelCase without TypeScript errors.
  thcMin?: number;
  thcMax?: number;
  cbdMin?: number;
  cbdMax?: number;
  indoor_suitable?: boolean;
  outdoor_suitable?: boolean;
}

/**
 * API response shape for strain list
 */
export interface StrainsResponse {
  data: Strain[];
  hasMore: boolean;
  nextCursor?: string;
}

/**
 * Parameters for fetching strains
 */
export interface GetStrainsParams {
  page?: number;
  pageSize?: number;
  searchQuery?: string;
  filters?: StrainFilters;
  sortBy?: 'name' | 'thc' | 'cbd' | 'popularity';
  sortDirection?: 'asc' | 'desc';
}
