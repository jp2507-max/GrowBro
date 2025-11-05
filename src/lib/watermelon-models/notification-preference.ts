import type { Database } from '@nozbe/watermelondb';
import { Model, Q } from '@nozbe/watermelondb';
import { date, field } from '@nozbe/watermelondb/decorators';

export class NotificationPreferenceModel extends Model {
  static table = 'notification_preferences';

  @field('user_id') userId!: string;
  @field('community_interactions') communityInteractions!: boolean;
  @field('community_likes') communityLikes!: boolean;
  @field('cultivation_reminders') cultivationReminders!: boolean;
  @field('system_updates') systemUpdates!: boolean;
  @field('task_reminders') taskReminders!: boolean;
  @field('task_reminder_timing') taskReminderTiming!: string;
  @field('custom_reminder_minutes') customReminderMinutes?: number;
  @field('harvest_alerts') harvestAlerts!: boolean;
  @field('community_activity') communityActivity!: boolean;
  @field('marketing') marketing!: boolean;
  @field('quiet_hours_enabled') quietHoursEnabled!: boolean;
  @field('quiet_hours_start') quietHoursStart?: string;
  @field('quiet_hours_end') quietHoursEnd?: string;
  @date('last_updated') lastUpdated!: Date;
  @field('device_id') deviceId!: string;

  /**
   * Finds an existing notification preference record for the given user_id,
   * or creates a new one if none exists. This ensures one-to-one mapping
   * between users and their notification preferences.
   *
   * @param database - The WatermelonDB database instance
   * @param userId - The user ID to find or create preferences for
   * @param defaults - Default values for the new record if created
   * @returns The existing or newly created notification preference record
   */
  static async findOrCreate(
    database: Database,
    userId: string,
    defaults: Partial<
      Omit<NotificationPreferenceModel, 'userId' | 'lastUpdated'>
    > = {}
  ): Promise<NotificationPreferenceModel> {
    return database.write(async () => {
      const collection = database.collections.get('notification_preferences');

      // Query for existing record by user_id
      const existingRecords = await collection
        .query(Q.where('user_id', userId))
        .fetch();

      if (existingRecords.length > 0) {
        return existingRecords[0] as NotificationPreferenceModel;
      }

      // Create new record if none exists
      const now = new Date();
      return collection.create((record: any) => {
        record.userId = userId;
        record.communityInteractions = defaults.communityInteractions ?? true;
        record.communityLikes = defaults.communityLikes ?? true;
        record.cultivationReminders = defaults.cultivationReminders ?? true;
        record.systemUpdates = defaults.systemUpdates ?? true;
        record.taskReminders = defaults.taskReminders ?? true;
        record.taskReminderTiming =
          defaults.taskReminderTiming ?? 'hour_before';
        record.customReminderMinutes = defaults.customReminderMinutes;
        record.harvestAlerts = defaults.harvestAlerts ?? true;
        record.communityActivity = defaults.communityActivity ?? true;
        record.marketing = defaults.marketing ?? false; // Default OFF per requirement 4.8
        record.quietHoursEnabled = defaults.quietHoursEnabled ?? false;
        record.quietHoursStart = defaults.quietHoursStart;
        record.quietHoursEnd = defaults.quietHoursEnd;
        record.lastUpdated = now;
        record.deviceId = defaults.deviceId ?? '';
      }) as Promise<NotificationPreferenceModel>;
    });
  }

  /**
   * Alias for findOrCreate for consistency with common upsert patterns
   */
  static async upsert(
    database: Database,
    userId: string,
    defaults: Partial<
      Omit<NotificationPreferenceModel, 'userId' | 'lastUpdated'>
    > = {}
  ): Promise<NotificationPreferenceModel> {
    return this.findOrCreate(database, userId, defaults);
  }
}
