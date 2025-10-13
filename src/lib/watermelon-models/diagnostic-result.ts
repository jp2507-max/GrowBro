import { Model } from '@nozbe/watermelondb';
import { date, field, json, text } from '@nozbe/watermelondb/decorators';

import { type DiagnosticAiMetadata } from '@/lib/nutrient-engine/types';

/**
 * WatermelonDB model for nutrient diagnostic results.
 *
 * Stores rule-driven and AI-assisted nutrient issue classifications along with
 * rationale, recommendations, and feedback metadata for continuous learning.
 *
 * Requirements: 3.1, 3.2, 3.5, 3.7, 3.8
 */
export class DiagnosticResultModel extends Model {
  static table = 'diagnostic_results_v2';

  @text('plant_id') plantId!: string;

  @text('reservoir_id') reservoirId?: string;

  @text('water_profile_id') waterProfileId?: string;

  @text('issue_type') issueType!: string;

  @text('issue_severity') issueSeverity!: string;

  @text('nutrient_code') nutrientCode?: string;

  @field('confidence') confidence!: number;

  @text('confidence_source') confidenceSource!: string;

  @field('rules_confidence') rulesConfidence?: number;

  @field('ai_confidence') aiConfidence?: number;

  @field('confidence_threshold') confidenceThreshold?: number;

  @field('rules_based') rulesBased!: boolean;

  @field('ai_override') aiOverride!: boolean;

  @field('needs_second_opinion') needsSecondOpinion!: boolean;

  @json('symptoms_json', (raw) => (raw as string[]) || [])
  symptomCodes!: string[];

  @json('rationale_json', (raw) => (raw as string[]) || [])
  rationale!: string[];

  @json('recommendations_json', (raw) => (raw as string[]) || [])
  recommendationMessages!: string[];

  @json('recommendation_codes_json', (raw) => (raw as string[]) || [])
  recommendationCodes!: string[];

  @json('disclaimer_keys_json', (raw) => (raw as string[]) || [])
  disclaimerKeys!: string[];

  @json('input_reading_ids_json', (raw) => (raw as string[]) || [])
  inputReadingIds!: string[];

  @text('ai_hypothesis_id') aiHypothesisId?: string;

  @json('ai_metadata_json', (raw) => raw || null)
  aiMetadata?: Record<string, unknown> | null;

  @field('feedback_helpful_count') feedbackHelpfulCount?: number;

  @field('feedback_not_helpful_count') feedbackNotHelpfulCount?: number;

  @json('confidence_flags_json', (raw) => (raw as string[]) || [])
  confidenceFlags!: string[];

  @text('resolution_notes') resolutionNotes?: string;

  @field('resolved_at') resolvedAt?: number;

  @text('user_id') userId?: string;

  @field('server_revision') serverRevision?: number;

  @field('server_updated_at_ms') serverUpdatedAtMs?: number;

  @date('created_at') createdAt!: Date;

  @date('updated_at') updatedAt!: Date;

  @date('deleted_at') deletedAt?: Date;

  async markResolved(notes?: string): Promise<void> {
    const resolvedAt = Date.now();
    await this.update(() => {
      this.resolutionNotes = notes ?? undefined;
      this.resolvedAt = resolvedAt;
      this.updatedAt = new Date(resolvedAt);
    });
  }

  async recordFeedback(
    isHelpful: boolean,
    submittedAt: number,
    notes?: string
  ): Promise<void> {
    const timestamp = Number.isFinite(submittedAt) ? submittedAt : Date.now();
    const trimmedNotes = typeof notes === 'string' ? notes.trim() : undefined;
    await this.update(() => {
      if (isHelpful) {
        const current = this.feedbackHelpfulCount ?? 0;
        this.feedbackHelpfulCount = current + 1;
      } else {
        const current = this.feedbackNotHelpfulCount ?? 0;
        this.feedbackNotHelpfulCount = current + 1;
      }

      const existingMetadata =
        (this.aiMetadata as DiagnosticAiMetadata | null) ?? undefined;
      const nextMetadata: DiagnosticAiMetadata = {
        ...existingMetadata,
        feedback: {
          ...(existingMetadata?.feedback ?? {}),
          lastSubmittedAt: timestamp,
          ...(trimmedNotes ? { lastNotes: trimmedNotes } : {}),
        },
      };

      this.aiMetadata = nextMetadata as Record<string, unknown>;
      this.updatedAt = new Date(timestamp);
    });
  }
}
