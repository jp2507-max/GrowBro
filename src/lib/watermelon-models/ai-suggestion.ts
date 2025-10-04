import { Model } from '@nozbe/watermelondb';
import { date, field, json, text } from '@nozbe/watermelondb/decorators';

import type { AISuggestion as AISuggestionType } from '@/types/playbook';

/**
 * AI Suggestion Model
 * Stores AI-generated schedule adjustment suggestions
 */
export class AISuggestionModel extends Model {
  static table = 'ai_suggestions';

  @text('plant_id') plantId!: string;

  @text('suggestion_type')
  suggestionType!:
    | 'schedule_adjustment'
    | 'phase_extension'
    | 'task_modification';

  @text('reasoning') reasoning!: string;

  @json('affected_tasks', (raw) => raw as AISuggestionType['affectedTasks'])
  affectedTasks!: AISuggestionType['affectedTasks'];

  @field('confidence') confidence!: number;
  @field('cooldown_until') cooldownUntil?: number;
  @field('expires_at') expiresAt!: number;

  @text('status') status!: 'pending' | 'accepted' | 'declined';

  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  /**
   * Check if this suggestion has expired
   */
  isExpired(): boolean {
    return Date.now() > this.expiresAt;
  }

  /**
   * Check if cooldown period is active
   */
  isInCooldown(): boolean {
    return this.cooldownUntil ? Date.now() < this.cooldownUntil : false;
  }

  /**
   * Convert model to plain object
   */
  toAISuggestion(): AISuggestionType {
    return {
      id: this.id,
      plantId: this.plantId,
      suggestionType: this.suggestionType,
      reasoning: this.reasoning,
      affectedTasks: this.affectedTasks,
      confidence: this.confidence,
      cooldownUntil: this.cooldownUntil,
      createdAt: this.createdAt.toISOString(),
      expiresAt: new Date(this.expiresAt).toISOString(),
    };
  }
}
