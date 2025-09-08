import { Model } from '@nozbe/watermelondb';
import { date, text } from '@nozbe/watermelondb/decorators';

import type { OccurrenceOverrideStatus } from '@/types/calendar';

export class OccurrenceOverrideModel extends Model {
  static table = 'occurrence_overrides';

  @text('series_id') seriesId!: string;
  @text('occurrence_local_date') occurrenceLocalDate!: string;
  @text('due_at_local') dueAtLocal?: string;
  @text('due_at_utc') dueAtUtc?: string;
  @text('reminder_at_local') reminderAtLocal?: string;
  @text('reminder_at_utc') reminderAtUtc?: string;
  @text('status') status?: OccurrenceOverrideStatus;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @date('deleted_at') deletedAt?: Date;
}
