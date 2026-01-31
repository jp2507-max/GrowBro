import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

/**
 * Plant Adjustment Preference Model
 * Stores user preferences for AI adjustment suggestions per plant
 */
export class PlantAdjustmentPreferenceModel extends Model {
  static table = 'plant_adjustment_preferences';

  @text('plant_id') plantId!: string;

  @field('never_suggest') neverSuggest!: boolean;

  @field('created_at') createdAt!: number;

  @field('updated_at') updatedAt!: number;
}
