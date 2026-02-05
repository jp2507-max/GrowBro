import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

import type { AdjustmentRootCause } from '@/types/ai-adjustments';

/**
 * Adjustment Cooldown Model
 * Manages cooldown periods for AI adjustment suggestions
 */
export class AdjustmentCooldownModel extends Model {
  static table = 'adjustment_cooldowns';

  @text('plant_id') plantId!: string;

  @text('root_cause') rootCause!: AdjustmentRootCause;

  @field('cooldown_until') cooldownUntil!: number;

  @field('created_at') createdAt!: number;

  /**
   * Check if cooldown is still active
   */
  isActive(): boolean {
    return Date.now() < this.cooldownUntil;
  }
}
