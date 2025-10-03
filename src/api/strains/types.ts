export type Race = 'indica' | 'sativa' | 'hybrid';

export type PercentageRange = {
  min?: number;
  max?: number;
  label?: string;
};

export type Effect = {
  name: string;
  intensity?: 'low' | 'medium' | 'high';
};

export type Flavor = {
  name: string;
  category?: string;
};

export type Terpene = {
  name: string;
  percentage?: number;
  aroma_description?: string;
};

export type GrowDifficulty = 'beginner' | 'intermediate' | 'advanced';

export type GrowCharacteristics = {
  difficulty: GrowDifficulty;
  indoor_suitable: boolean;
  outdoor_suitable: boolean;
  flowering_time: {
    min_weeks?: number;
    max_weeks?: number;
    label?: string;
  };
  yield: {
    indoor?: {
      min_grams?: number;
      max_grams?: number;
      min_oz?: number;
      max_oz?: number;
      label?: string;
    };
    outdoor?: {
      min_grams?: number;
      max_grams?: number;
      min_oz?: number;
      max_oz?: number;
      label?: string;
    };
  };
  height: {
    indoor_cm?: number;
    outdoor_cm?: number;
    label?: string;
  };
};

export type Strain = {
  id: string;
  name: string;
  slug: string;
  synonyms: string[];
  link: string;
  imageUrl: string;
  description: string[];
  genetics: {
    parents: string[];
    lineage: string;
  };
  race: Race;
  thc: PercentageRange;
  cbd: PercentageRange;
  effects: Effect[];
  flavors: Flavor[];
  terpenes?: Terpene[];
  grow: GrowCharacteristics;
  source: {
    provider: string;
    updated_at: string;
    attribution_url: string;
  };
  // Computed display fields
  thc_display: string;
  cbd_display: string;
};

export type StrainFilters = {
  race?: Race;
  effects?: string[];
  flavors?: string[];
  difficulty?: GrowDifficulty;
  thcMin?: number;
  thcMax?: number;
  cbdMin?: number;
  cbdMax?: number;
};

export type SortBy = 'name' | 'thc' | 'cbd' | 'popularity';
export type SortDirection = 'asc' | 'desc';

export type GetStrainsParams = {
  page?: number;
  pageSize?: number;
  cursor?: string;
  searchQuery?: string;
  filters?: StrainFilters;
  sortBy?: SortBy;
  sortDirection?: SortDirection;
  signal?: AbortSignal;
};

export type StrainsResponse = {
  data: Strain[];
  hasMore: boolean;
  nextCursor?: string;
};
