import { Model } from '@nozbe/watermelondb';
import { date, field, json, text } from '@nozbe/watermelondb/decorators';

export interface UndoDescriptorData {
  operationType: string;
  affectedTaskIds: string[];
  priorFieldValues: Record<string, unknown>;
  timestamp: number;
  expiresAt: number;
}

export class UndoDescriptorModel extends Model {
  static table = 'undo_descriptors';

  @text('operation_type') operationType!: string;
  @json('affected_task_ids', (raw) => raw as string[])
  affectedTaskIds!: string[];
  @json('prior_field_values', (raw) => raw as Record<string, unknown>)
  priorFieldValues!: Record<string, unknown>;
  @field('timestamp') timestamp!: number;
  @field('expires_at') expiresAt!: number;
  @date('created_at') createdAt!: Date;

  toData(): UndoDescriptorData {
    return {
      operationType: this.operationType,
      affectedTaskIds: this.affectedTaskIds,
      priorFieldValues: this.priorFieldValues,
      timestamp: this.timestamp,
      expiresAt: this.expiresAt,
    };
  }
}
