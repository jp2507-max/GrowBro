import type {
  GeneticLean,
  PhotoperiodType,
  PlantEnvironment,
  PlantStage,
} from '@/api/plants/types';
import type { DiagnosticResult } from '@/lib/nutrient-engine/types';
import type { TrichomeAssessment } from '@/types/playbook';

import type { PlantEventKindValue } from '../plants/plant-event-kinds';
import type { PlantEvent } from '../plants/plant-events';

export type PlantProfile = {
  plantId: string;
  stage: PlantStage;
  stageEnteredAt: Date;
  plantedAt: Date;
  environment: PlantEnvironment;
  photoperiodType: PhotoperiodType;
  geneticLean: GeneticLean;
  medium: 'soil' | 'coco' | 'hydro' | 'living_soil' | 'other';
  potSizeLiters: number;
  floweringDays: number;
  timezone: string;
  heightCm?: number;
  lastWateredAt?: Date;
  lastFedAt?: Date;
};

export type TwinSignals = {
  events: PlantEvent[];
  latestTrichomeAssessment?: TrichomeAssessment | null;
  latestDiagnostic?: DiagnosticResult | null;
};

export type TwinTransition = {
  nextStage: PlantStage;
  reason: string;
  triggeredBy?: PlantEventKindValue | 'time' | 'trichomes';
};

export type TwinState = {
  profile: PlantProfile;
  stage: PlantStage;
  stageEnteredAt: Date;
  dayInStage: number;
  dayFromPlanting: number;
  transition?: TwinTransition | null;
  signals: TwinSignals;
};

export type TaskIntent = {
  engineKey: string;
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
