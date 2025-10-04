import { Model } from '@nozbe/watermelondb';
import { date, field, json, text } from '@nozbe/watermelondb/decorators';

import type { TrichomeAssessment as TrichomeAssessmentType } from '@/types/playbook';

/**
 * Trichome Assessment Model
 * Stores user-logged trichome checks for harvest timing
 */
export class TrichomeAssessmentModel extends Model {
  static table = 'trichome_assessments';

  @text('plant_id') plantId!: string;
  @text('assessment_date') assessmentDate!: string;

  @field('clear_percent') clearPercent?: number;
  @field('milky_percent') milkyPercent?: number;
  @field('amber_percent') amberPercent?: number;

  @json('photos', (raw) => raw as string[] | undefined)
  photos?: string[];

  @text('notes') notes?: string;

  @json(
    'harvest_window_suggestion',
    (raw) => raw as TrichomeAssessmentType['harvestWindowSuggestion']
  )
  harvestWindowSuggestion?: TrichomeAssessmentType['harvestWindowSuggestion'];

  @date('created_at') createdAt!: Date;

  /**
   * Convert model to plain object
   */
  toTrichomeAssessment(): TrichomeAssessmentType {
    return {
      id: this.id,
      plantId: this.plantId,
      assessmentDate: this.assessmentDate,
      clearPercent: this.clearPercent,
      milkyPercent: this.milkyPercent,
      amberPercent: this.amberPercent,
      photos: this.photos,
      notes: this.notes,
      harvestWindowSuggestion: this.harvestWindowSuggestion,
      createdAt: this.createdAt.toISOString(),
    };
  }
}
