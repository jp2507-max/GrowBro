import type {
  GeneticLean,
  PhotoperiodType,
  PlantEnvironment,
  PlantMetadata,
  PlantStage,
} from '@/api/plants/types';

export type GrowMedium = NonNullable<PlantMetadata['medium']>;

export type PlantSettings = {
  plantId: string;
  stage: PlantStage;
  medium: GrowMedium;
  potSizeLiters: number;
  environment: PlantEnvironment;
  photoperiodType: PhotoperiodType;
  geneticLean: GeneticLean;
  plantedAt: Date;
  floweringDays: number;
  timezone: string;
  /** Date when the current stage was entered (for flush/harvest calculations) */
  stageEnteredAt?: Date;
};

export type SeriesSpec = {
  title: string;
  description?: string;
  rrule: string;
  dtstartLocal: string;
  dtstartUtc: string;
  timezone: string;
  untilUtc?: string;
  count?: number;
};

export type StageChangeEvent = {
  plantId: string;
  fromStage: PlantStage | null;
  toStage: PlantStage;
};

export const ORIGIN_GROWBRO = 'growbro' as const;

// Default flowering durations (in days)
export const DEFAULT_FLOWERING_DAYS_AUTOFLOWER = 49;
export const DEFAULT_FLOWERING_DAYS_PHOTOPERIOD = 56;

// Flush period in days before harvest
export const FLUSH_DAYS = 14;

// Autoflower nudge starts at day 28
export const AUTOFLOWER_NUDGE_START_DAY = 28;
