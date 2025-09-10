import { Model } from '@nozbe/watermelondb';
import { date, readonly, text } from '@nozbe/watermelondb/decorators';

export class SeriesModel extends Model {
  static table = 'series';

  @text('title') title!: string;
  @text('description') description?: string;
  @text('dtstart_local') dtstartLocal!: string;
  @text('dtstart_utc') dtstartUtc!: string;
  @text('timezone') timezone!: string;
  @text('rrule') rrule!: string;
  @text('until_utc') untilUtc?: string;
  @readonly count?: number;
  @text('plant_id') plantId?: string;
  @readonly serverRevision?: number;
  @readonly serverUpdatedAtMs?: number;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @date('deleted_at') deletedAt?: Date;
}
