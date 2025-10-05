/**
 * Types for AI-driven schedule adjustment system
 */

export type AdjustmentSuggestionType =
  | 'watering'
  | 'feeding'
  | 'lighting'
  | 'environment'
  | 'schedule_shift';

export type AdjustmentRootCause =
  | 'skipped_tasks'
  | 'low_confidence_assessment'
  | 'environmental_stress'
  | 'nutrient_deficiency'
  | 'overwatering'
  | 'underwatering';

export type AdjustmentStatus = 'pending' | 'accepted' | 'declined' | 'expired';

export type HelpfulnessVote = 'helpful' | 'not_helpful';

export interface TaskAdjustment {
  taskId: string;
  currentDueDate: string;
  proposedDueDate: string;
  reason: string;
  phase?: string;
}

export interface AdjustmentSuggestion {
  id: string;
  plantId: string;
  playbookId?: string;
  suggestionType: AdjustmentSuggestionType;
  rootCause: AdjustmentRootCause;
  reasoning: string;
  affectedTasks: TaskAdjustment[];
  confidence: number;
  status: AdjustmentStatus;
  acceptedTasks?: string[];
  helpfulnessVote?: HelpfulnessVote;
  expiresAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface AdjustmentCooldown {
  id: string;
  plantId: string;
  rootCause: AdjustmentRootCause;
  cooldownUntil: number;
  createdAt: number;
}

export interface PlantAdjustmentPreference {
  id: string;
  plantId: string;
  neverSuggest: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AdjustmentContext {
  plantId: string;
  playbookId?: string;
  skippedTaskCount?: number;
  assessmentConfidence?: number;
  recentIssues?: string[];
}

export interface AdjustmentThresholds {
  minSkippedTasks: number;
  minConfidence: number;
  cooldownDays: number;
}
