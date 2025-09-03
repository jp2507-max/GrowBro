import { Model } from '@nozbe/watermelondb';
import { date, text } from '@nozbe/watermelondb/decorators';

export class NotificationQueueModel extends Model {
  static table = 'notification_queue';

  @text('task_id') taskId!: string;
  @text('notification_id') notificationId!: string;
  @text('scheduled_for_local') scheduledForLocal!: string;
  @text('scheduled_for_utc') scheduledForUtc!: string;
  @text('timezone') timezone!: string;
  @text('status') status!: 'pending' | 'sent' | 'failed';
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}
