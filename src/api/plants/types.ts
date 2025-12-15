export type { Race } from '@/api/strains/types';

export type PlantStage =
  | 'seedling'
  | 'vegetative'
  | 'flowering'
  | 'harvesting'
  | 'curing'
  | 'ready';

export type PlantHealth = 'excellent' | 'good' | 'fair' | 'poor';

export type PlantEnvironment = 'indoor' | 'outdoor' | 'greenhouse';

export type PhotoperiodType = 'photoperiod' | 'autoflower';

export type GeneticLean =
  | 'indica_dominant'
  | 'sativa_dominant'
  | 'balanced'
  | 'unknown';

export type PlantMetadata = {
  photoperiodType?: PhotoperiodType;
  environment?: PlantEnvironment;
  geneticLean?: GeneticLean;
  medium?: 'soil' | 'coco' | 'hydro' | 'living_soil' | 'other';
  potSize?: string;
  lightSchedule?: string;
  lightHours?: number;
  locationName?: string;
  isDirectSun?: boolean;
  notes?: string;
  /**
   * Optional linkage back to a strain entry (from API or custom).
   */
  strainId?: string;
  strainSlug?: string;
  strainSource?: 'api' | 'custom';
  strainRace?: import('@/api/strains/types').Race;
};

export type Plant = {
  id: string;
  name: string;
  stage?: PlantStage;
  strain?: string;
  plantedAt?: string;
  expectedHarvestAt?: string;
  lastWateredAt?: string;
  lastFedAt?: string;
  health?: PlantHealth;
  notes?: string;
  imageUrl?: string;
  metadata?: PlantMetadata;
  environment?: PlantEnvironment;
  photoperiodType?: PhotoperiodType;
  geneticLean?: GeneticLean;
};
