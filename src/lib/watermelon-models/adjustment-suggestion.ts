import { Model } from '@nozbe/watermelondb';
import { field, json, text } from '@nozbe/watermelondb/decorators';

import type {
  AdjustmentSuggestion,
  TaskAdjustment,
} from '@/types/ai-adjustments';

/**
 * Adjustment Suggestion Model
 * Stores AI-generated schedule adjustment suggestions for plants
 */
export class AdjustmentSuggestionModel extends Model {
  static table = 'adjustment_suggestions';

  @text('plant_id') plantId!: string;

  @text('playbook_id') playbookId?: string;

  @text('suggestion_type')
  suggestionType!: AdjustmentSuggestion['suggestionType'];

  @text('root_cause') rootCause!: AdjustmentSuggestion['rootCause'];

  @text('reasoning') reasoning!: string;

  @json('affected_tasks', (raw) => raw as TaskAdjustment[])
  affectedTasks!: TaskAdjustment[];

  @field('confidence') confidence!: number;

  @text('status') status!: AdjustmentSuggestion['status'];

  @json('accepted_tasks', (raw) => raw as string[] | null)
  acceptedTasks?: string[];

  @text('helpfulness_vote')
  helpfulnessVote?: AdjustmentSuggestion['helpfulnessVote'];

  @field('expires_at') expiresAt!: number;

  @field('created_at') createdAt!: number;

  @field('updated_at') updatedAt!: number;

  /**
   * Check if this suggestion has expired
   */
  isExpired(): boolean {
    return Date.now() > this.expiresAt;
  }

  /**
   * Convert model to plain object
   */
  toAdjustmentSuggestion(): AdjustmentSuggestion {
    return {
      id: this.id,
      plantId: this.plantId,
      playbookId: this.playbookId,
      suggestionType: this.suggestionType,
      rootCause: this.rootCause,
      reasoning: this.reasoning,
      affectedTasks: this.affectedTasks,
      confidence: this.confidence,
      status: this.status,
      acceptedTasks: this.acceptedTasks,
      helpfulnessVote: this.helpfulnessVote,
      expiresAt: this.expiresAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
