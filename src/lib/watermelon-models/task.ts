import { Model } from '@nozbe/watermelondb';
import { date, field, json, text } from '@nozbe/watermelondb/decorators';

import type { TaskMetadata, TaskStatus } from '@/types';

export class TaskModel extends Model {
  static table = 'tasks';

  @text('series_id') seriesId?: string;
  @text('title') title!: string;
  @text('description') description?: string;
  @text('due_at_local') dueAtLocal!: string;
  @text('due_at_utc') dueAtUtc!: string;
  @text('timezone') timezone!: string;
  @text('reminder_at_local') reminderAtLocal?: string;
  @text('reminder_at_utc') reminderAtUtc?: string;
  @text('plant_id') plantId?: string;
  @text('status') status!: TaskStatus;
  @date('completed_at') completedAt?: Date;
  @json('metadata', (raw) => raw as TaskMetadata)
  metadata!: TaskMetadata;
  // @readonly removed so sync pipeline can write server-provided values
  // @readonly @field('server_revision') serverRevision?: number;
  @field('server_revision') serverRevision?: number;

  // @readonly removed so sync pipeline can write server-provided values
  // @readonly @field('server_updated_at_ms') serverUpdatedAtMs?: number;
  @field('server_updated_at_ms') serverUpdatedAtMs?: number;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @date('deleted_at') deletedAt?: Date;
}
