import { Model } from '@nozbe/watermelondb';
import { date, json, readonly, text } from '@nozbe/watermelondb/decorators';

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
  @text('server_revision') serverRevision?: string;
  @readonly @date('server_updated_at_ms') serverUpdatedAtMs?: Date;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @date('deleted_at') deletedAt?: Date;
}
