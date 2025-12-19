import { Model } from '@nozbe/watermelondb';
import { date, field, text } from '@nozbe/watermelondb/decorators';

export class SeriesModel extends Model {
  static table = 'series';

  @text('title') title!: string;
  @text('description') description?: string;
  @text('dtstart_local') dtstartLocal!: string;
  @text('dtstart_utc') dtstartUtc!: string;
  @text('timezone') timezone!: string;
  @text('rrule') rrule!: string;
  @text('until_utc') untilUtc?: string;
  // @readonly removed so TaskEngine can write count for finite series
  @field('count') count?: number;
  @text('plant_id') plantId?: string;
  @text('origin') origin?: string;
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
