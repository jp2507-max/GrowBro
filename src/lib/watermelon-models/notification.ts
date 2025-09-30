import { Model } from '@nozbe/watermelondb';
import { date, field } from '@nozbe/watermelondb/decorators';

export class NotificationModel extends Model {
  static table = 'notifications';

  @field('type') type!: string;
  @field('title') title!: string;
  @field('body') body!: string;
  @field('data') data!: string;
  @field('deep_link') deepLink?: string;
  @date('read_at') readAt?: Date;
  @date('created_at') createdAt!: Date;
  @date('expires_at') expiresAt?: Date;
  @field('message_id') messageId?: string;
  @date('archived_at') archivedAt?: Date;
  @date('deleted_at') deletedAt?: Date;
}
