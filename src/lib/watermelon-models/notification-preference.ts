import { Model } from '@nozbe/watermelondb';
import { date, field } from '@nozbe/watermelondb/decorators';

export class NotificationPreferenceModel extends Model {
  static table = 'notification_preferences';

  @field('user_id') userId!: string;
  @field('community_interactions') communityInteractions!: boolean;
  @field('community_likes') communityLikes!: boolean;
  @field('cultivation_reminders') cultivationReminders!: boolean;
  @field('system_updates') systemUpdates!: boolean;
  @field('quiet_hours_enabled') quietHoursEnabled!: boolean;
  @field('quiet_hours_start') quietHoursStart?: string;
  @field('quiet_hours_end') quietHoursEnd?: string;
  @date('updated_at') updatedAt!: Date;
}
