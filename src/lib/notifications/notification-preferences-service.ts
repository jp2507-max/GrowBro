/**
 * Notification Preferences Service
 * Requirements: 4.1, 4.2, 4.5, 4.7, 4.8, 4.9, 4.11
 *
 * Handles notification preferences with multi-device sync, conflict resolution,
 * and quiet hours management.
 */

import type { Database } from '@nozbe/watermelondb';

import { getDeviceId } from '@/lib/device-id';
import { NotificationPreferenceModel } from '@/lib/watermelon-models/notification-preference';
import type {
  NotificationPreferences,
  TaskReminderTiming,
} from '@/types/settings';

export class NotificationPreferencesService {
  constructor(private database: Database) {}

  /**
   * Gets notification preferences for a user
   * Requirements: 4.1
   */
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const record = await NotificationPreferenceModel.findOrCreate(
      this.database,
      userId,
      {
        deviceId: await getDeviceId(),
      }
    );

    return this.modelToPreferences(record);
  }

  /**
   * Updates notification preferences
   * Requirements: 4.2, 4.7, 4.11
   */
  async updatePreferences(
    userId: string,
    updates: Partial<
      Omit<NotificationPreferences, 'userId' | 'lastUpdated' | 'deviceId'>
    >
  ): Promise<NotificationPreferences> {
    const record = await NotificationPreferenceModel.findOrCreate(
      this.database,
      userId
    );

    const deviceId = await getDeviceId();

    await this.database.write(async () => {
      await record.update((r: NotificationPreferenceModel) => {
        if (updates.taskReminders !== undefined) {
          r.taskReminders = updates.taskReminders;
        }
        if (updates.taskReminderTiming !== undefined) {
          r.taskReminderTiming = updates.taskReminderTiming;
        }
        if (updates.customReminderMinutes !== undefined) {
          r.customReminderMinutes = updates.customReminderMinutes;
        }
        if (updates.harvestAlerts !== undefined) {
          r.harvestAlerts = updates.harvestAlerts;
        }
        if (updates.communityActivity !== undefined) {
          r.communityActivity = updates.communityActivity;
        }
        if (updates.systemUpdates !== undefined) {
          r.systemUpdates = updates.systemUpdates;
        }
        if (updates.marketing !== undefined) {
          r.marketing = updates.marketing;
        }
        if (updates.quietHoursEnabled !== undefined) {
          r.quietHoursEnabled = updates.quietHoursEnabled;
        }
        if (updates.quietHoursStart !== undefined) {
          r.quietHoursStart = updates.quietHoursStart;
        }
        if (updates.quietHoursEnd !== undefined) {
          r.quietHoursEnd = updates.quietHoursEnd;
        }

        // Update metadata for sync
        r.lastUpdated = new Date();
        r.deviceId = deviceId;
      });
    });

    return this.modelToPreferences(record);
  }

  /**
   * Toggles a specific notification category
   * Requirements: 4.1, 4.2
   */
  async toggleCategory(
    userId: string,
    category:
      | 'taskReminders'
      | 'harvestAlerts'
      | 'communityActivity'
      | 'systemUpdates'
      | 'marketing',
    enabled: boolean
  ): Promise<NotificationPreferences> {
    return this.updatePreferences(userId, { [category]: enabled });
  }

  /**
   * Updates task reminder timing
   * Requirements: 4.5
   */
  async updateTaskReminderTiming(
    userId: string,
    timing: TaskReminderTiming,
    customMinutes?: number
  ): Promise<NotificationPreferences> {
    const updates: Partial<NotificationPreferences> = {
      taskReminderTiming: timing,
    };

    if (timing === 'custom') {
      // Validate custom minutes (1-1440 minutes, i.e., 1 minute to 24 hours)
      if (!customMinutes || customMinutes < 1 || customMinutes > 1440) {
        throw new Error(
          'Custom reminder minutes must be between 1 and 1440 (24 hours)'
        );
      }
      updates.customReminderMinutes = customMinutes;
    }

    return this.updatePreferences(userId, updates);
  }

  /**
   * Updates quiet hours configuration
   * Requirements: 4.9
   */
  async updateQuietHours(
    userId: string,
    config: { enabled: boolean; start?: string; end?: string }
  ): Promise<NotificationPreferences> {
    const { enabled, start, end } = config;
    const updates: Partial<NotificationPreferences> = {
      quietHoursEnabled: enabled,
    };

    if (enabled) {
      if (!start || !end) {
        throw new Error(
          'Quiet hours start and end times are required when enabled'
        );
      }

      // Validate time format (HH:mm)
      const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(start) || !timeRegex.test(end)) {
        throw new Error('Invalid time format. Use HH:mm (24-hour format)');
      }

      updates.quietHoursStart = start;
      updates.quietHoursEnd = end;
    }

    return this.updatePreferences(userId, updates);
  }

  /**
   * Checks if current time is within quiet hours
   * Requirements: 4.9
   */
  isInQuietHours(preferences: NotificationPreferences): boolean {
    if (
      !preferences.quietHoursEnabled ||
      !preferences.quietHoursStart ||
      !preferences.quietHoursEnd
    ) {
      return false;
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = preferences.quietHoursStart
      .split(':')
      .map(Number);
    const [endHour, endMin] = preferences.quietHoursEnd.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // Handle quiet hours that span midnight
    if (startMinutes <= endMinutes) {
      // Same day: e.g., 22:00 to 23:00
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      // Spans midnight: e.g., 22:00 to 06:00
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
  }

  /**
   * Checks if a notification should be suppressed during quiet hours
   * Requirements: 4.9
   */
  shouldSuppressNotification(
    preferences: NotificationPreferences,
    isCritical: boolean = false
  ): boolean {
    // Never suppress critical notifications (e.g., harvest alerts, time-sensitive tasks)
    if (isCritical) {
      return false;
    }

    return this.isInQuietHours(preferences);
  }

  /**
   * Merges preferences from multiple devices (conflict resolution)
   * Requirements: 4.7, 4.11
   * Uses last-write-wins strategy per key
   */
  mergePreferences(
    local: NotificationPreferences,
    remote: NotificationPreferences
  ): NotificationPreferences {
    const localTime = new Date(local.lastUpdated).getTime();
    const remoteTime = new Date(remote.lastUpdated).getTime();

    // If remote is newer, prefer remote
    if (remoteTime > localTime) {
      return remote;
    }

    // If local is newer or equal, prefer local
    return local;
  }

  /**
   * Converts WatermelonDB model to NotificationPreferences type
   */
  private modelToPreferences(
    model: NotificationPreferenceModel
  ): NotificationPreferences {
    return {
      userId: model.userId,
      taskReminders: model.taskReminders,
      taskReminderTiming: model.taskReminderTiming as TaskReminderTiming,
      customReminderMinutes: model.customReminderMinutes,
      harvestAlerts: model.harvestAlerts,
      communityActivity: model.communityActivity,
      systemUpdates: model.systemUpdates,
      marketing: model.marketing,
      quietHoursEnabled: model.quietHoursEnabled,
      quietHoursStart: model.quietHoursStart,
      quietHoursEnd: model.quietHoursEnd,
      lastUpdated: model.lastUpdated.toISOString(),
      deviceId: model.deviceId,
    };
  }
}
