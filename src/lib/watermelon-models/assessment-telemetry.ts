import { Model } from '@nozbe/watermelondb';
import {
  date,
  field,
  json,
  readonly,
  relation,
  text,
} from '@nozbe/watermelondb/decorators';

import type { AssessmentInferenceMode } from '@/types/assessment';

import type { AssessmentModel } from './assessment';

export type TelemetryEventType =
  | 'assessment_created'
  | 'assessment_completed'
  | 'feedback_submitted'
  | 'task_created'
  | 'playbook_adjustment'
  | 'community_cta_tapped'
  | 'community_cta_shown'
  | 'community_post_created'
  | 'retake_initiated'
  | 'diagnostic_checklist_shown'
  | 'inference_started'
  | 'inference_failed'
  | 'cloud_fallback';

function sanitizeMetadata(
  metadata: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }

  // Limit metadata size and depth to prevent bloat
  const sanitized: Record<string, unknown> = {};
  const keys = Object.keys(metadata).slice(0, 20); // max 20 keys

  for (const key of keys) {
    const value = metadata[key];
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * AssessmentTelemetry model
 * Stores privacy-safe telemetry events for AI assessments
 */
export class AssessmentTelemetryModel extends Model {
  static table = 'assessment_telemetry';

  static associations = {
    assessments: { type: 'belongs_to', key: 'assessment_id' },
  } as const;

  @text('assessment_id') assessmentId!: string;
  @text('event_type') eventType!: TelemetryEventType;
  @text('mode') mode?: AssessmentInferenceMode;
  @field('latency_ms') latencyMs?: number;
  @text('model_version') modelVersion?: string;
  @field('raw_confidence') rawConfidence?: number;
  @field('calibrated_confidence') calibratedConfidence?: number;
  @field('quality_score') qualityScore?: number;
  @text('predicted_class') predictedClass?: string;
  @text('execution_provider') executionProvider?: string;
  @text('error_code') errorCode?: string;
  @text('fallback_reason') fallbackReason?: string;

  @json('metadata', sanitizeMetadata)
  metadata!: Record<string, unknown>;

  @readonly @date('created_at') createdAt!: Date;

  @relation('assessments', 'assessment_id')
  assessment?: AssessmentModel;
}
