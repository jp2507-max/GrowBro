import { Model } from '@nozbe/watermelondb';
import { date, field, json, text } from '@nozbe/watermelondb/decorators';

import type { UndoDescriptor as UndoDescriptorType } from '@/types/playbook';

/**
 * Undo Descriptor Model
 * Stores undo information for 30-second undo functionality
 */
export class UndoDescriptorModel extends Model {
  static table = 'undo_descriptors';

  @text('operation_type') operationType!: 'schedule_shift';

  @json('affected_task_ids', (raw) => raw as string[])
  affectedTaskIds!: string[];

  @json('prior_field_values', (raw) => raw as Record<string, unknown>)
  priorFieldValues!: Record<string, unknown>;

  @field('timestamp') timestamp!: number;
  @field('expires_at') expiresAt!: number;

  @date('created_at') createdAt!: Date;

  /**
   * Check if this undo descriptor has expired
   */
  isExpired(): boolean {
    return Date.now() > this.expiresAt;
  }

  /**
   * Convert model to plain object
   */
  toUndoDescriptor(): UndoDescriptorType {
    return {
      id: this.id,
      operationType: this.operationType,
      affectedTaskIds: this.affectedTaskIds,
      priorFieldValues: this.priorFieldValues,
      timestamp: this.timestamp,
      expiresAt: this.expiresAt,
    };
  }
}
