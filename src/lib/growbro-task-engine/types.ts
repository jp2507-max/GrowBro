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
  metadata?: Record<string, unknown>;
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

// Flowering stage: Stretch warning at week 3 (day 21) for sativa-dominant plants
export const STRETCH_WARNING_DAY = 21;

// Harvesting/Drying stage: Stem snap check duration
export const STEM_SNAP_CHECK_DAYS = 10;

// Curing stage: Daily burping period (weeks 1-2)
export const CURE_DAILY_BURP_DAYS = 14;

// Curing stage: Total cure monitoring period (4 weeks)
export const CURE_TOTAL_MONITORING_DAYS = 28;
