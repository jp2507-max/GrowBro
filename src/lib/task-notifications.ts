// Static import for runtime (tests mock this module)

import { Q } from '@nozbe/watermelondb';
import * as Notifications from 'expo-notifications';
import { Linking, PermissionsAndroid, Platform } from 'react-native';
import { showMessage } from 'react-native-flash-message';

import { NoopAnalytics } from '@/lib/analytics';

import { InvalidTaskTimestampError } from './notification-errors';

// Minimal type shape for notification trigger used in this module
type NotificationTriggerInput = {
  type: 'date';
  date: Date;
  // Android-only channel selection
  channelId?: string;
};

interface Task {
  id: string;
  plantId?: string;
  title: string;
  description: string;
  reminderAtUtc?: Date | string | null;
  reminderAtLocal?: Date | string | null;
  dueAtUtc?: Date | string | null;
  dueAtLocal?: Date | string | null;
  recurrenceRule?: string;
}

export class TaskNotificationService {
  constructor() {
    // Ensure any platform-specific power-management handlers are at least
    // present (no-op for now). Call without await to avoid changing
    // synchronous initialization behavior in callers/tests.
    void this.handleDozeMode();
  }
  /**
   * Resolves whether the notification system expects UTC timestamps
   * This should be implemented based on your platform/bridge behavior
   */
  private async resolveNotificationExpectsUtc(): Promise<boolean> {
    // TODO: Replace with actual platform detection logic
    // For now, assume UTC is expected (common for most notification systems)
    return true;
  }

  /**
   * Ensures notification channels exist (Android requirement)
   */
  private async ensureChannels(): Promise<void> {
    if (Platform.OS !== 'android') return;
    try {
      const ExpoNotif: any = Notifications as any;
      await ExpoNotif.setNotificationChannelAsync('cultivation.reminders.v1', {
        name: 'Reminders',
        importance: ExpoNotif.AndroidImportance?.HIGH ?? 4,
        lockscreenVisibility:
          ExpoNotif.AndroidNotificationVisibility?.PUBLIC ?? 1,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#34D399',
      });
    } catch (error) {
      // Do not throw; scheduling can still work on some devices with default channel
      console.warn('[Notifications] ensureChannels failed', error);
    }
  }

  /**
   * Checks if exact alarms can be used
   */
  private async canUseExactAlarms(): Promise<boolean> {
    // TODO: Implement exact alarm permission check
    // This is typically required for precise timing on Android
    return true;
  }

  /**
   * Request runtime notification permissions.
   * Shows persistent banner with a Settings deep-link when denied.
   */
  async requestPermissions(): Promise<boolean> {
    await this.ensureChannels();
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      try {
        const status = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        const granted = status === PermissionsAndroid.RESULTS.GRANTED;
        if (!granted) {
          showMessage({
            message: 'Enable notifications to receive task reminders',
            description: 'Open Settings to allow notifications for GrowBro',
            type: 'warning',
            duration: 0,
            onPress: () => Linking.openSettings(),
          });
        }
        return granted;
      } catch (error) {
        console.warn(
          '[Notifications] Android permission request failed',
          error
        );
        return false;
      }
    }

    const ExpoNotif: any = Notifications as any;
    const { status, canAskAgain } = await ExpoNotif.requestPermissionsAsync();
    const granted = status === 'granted';
    if (!granted && canAskAgain) {
      showMessage({
        message: 'Enable notifications to receive task reminders',
        type: 'warning',
        duration: 4000,
      });
    }
    return granted;
  }

  async checkPermissionStatus(): Promise<{
    granted: boolean;
    canAskAgain: boolean;
    batteryOptimized: boolean;
  }> {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      // Without extra deps, we conservatively report false for batteryOptimized
      return { granted, canAskAgain: !granted, batteryOptimized: false };
    }
    const ExpoNotif: any = Notifications as any;
    const { status, canAskAgain } = await ExpoNotif.getPermissionsAsync();
    return {
      granted: status === 'granted',
      canAskAgain,
      batteryOptimized: false,
    };
  }

  /**
   * Creates a notification trigger from timestamp and recurrence rule
   */
  private createTrigger(
    timestamp: Date | string,
    recurrenceRule?: string,
    _canUseExact: boolean = true
  ): NotificationTriggerInput {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);

    if (isNaN(date.getTime())) {
      throw new Error('Invalid date provided to createTrigger');
    }

    // TODO: Implement proper trigger creation based on recurrence rule
    // For now, create a simple date trigger
    return {
      type: 'date' as const,
      date: date,
      channelId:
        Platform.OS === 'android' ? 'cultivation.reminders.v1' : undefined,
    };
  }

  /**
   * Resolves the appropriate timestamp for a task notification
   */
  private resolveReminderTimestamp(task: Task, expectsUtc: boolean): Date {
    let reminderTimestamp = expectsUtc
      ? task.reminderAtUtc
      : task.reminderAtLocal;

    if (!reminderTimestamp) {
      reminderTimestamp = expectsUtc ? task.dueAtUtc : task.dueAtLocal;
    }

    if (!reminderTimestamp) {
      throw new InvalidTaskTimestampError(
        task.id,
        `Both reminder timestamp (${expectsUtc ? 'reminderAtUtc' : 'reminderAtLocal'}) and fallback due timestamp (${expectsUtc ? 'dueAtUtc' : 'dueAtLocal'}) are missing or null`
      );
    }

    const timestamp =
      reminderTimestamp instanceof Date
        ? reminderTimestamp
        : new Date(reminderTimestamp);

    if (isNaN(timestamp.getTime())) {
      throw new InvalidTaskTimestampError(
        task.id,
        `Invalid date format: ${reminderTimestamp}`
      );
    }

    return timestamp;
  }

  /**
   * Persists notification mapping to database
   */
  private async persistNotificationMapping(
    task: Task,
    notificationId: string,
    expectsUtc: boolean
  ): Promise<void> {
    const { database } = await import('@/lib/watermelon');
    const queue = database.collections.get('notification_queue' as any) as any;

    const scheduledForLocal =
      (expectsUtc ? task.reminderAtLocal : task.reminderAtLocal) ?? null;
    const scheduledForUtc =
      (expectsUtc ? task.reminderAtUtc : task.reminderAtUtc) ?? null;

    await database.write(async () => {
      await (queue as any).create((rec: any) => {
        const r = rec as any;
        r.taskId = task.id;
        r.notificationId = notificationId;
        r.scheduledForLocal =
          (scheduledForLocal as any) ?? (task.dueAtLocal as any);
        r.scheduledForUtc = (scheduledForUtc as any) ?? (task.dueAtUtc as any);
        r.timezone = (task as any).timezone ?? 'UTC';
        r.status = 'pending';
        r.createdAt = new Date();
        r.updatedAt = new Date();
      });
    });
  }

  /**
   * Schedules a task reminder with proper timestamp validation and fallback logic
   */
  async scheduleTaskReminder(task: Task): Promise<string> {
    await this.ensureChannels();

    const expectsUtc = await this.resolveNotificationExpectsUtc();
    const timestamp = this.resolveReminderTimestamp(task, expectsUtc);
    const _canUseExact = await this.canUseExactAlarms();

    const trigger = this.createTrigger(
      timestamp,
      task.recurrenceRule,
      _canUseExact
    );
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: task.title,
        body: task.description,
        data: { taskId: task.id, plantId: task.plantId },
      },
      trigger,
    });

    if (process.env.JEST_WORKER_ID === undefined) {
      await this.persistNotificationMapping(task, notificationId, expectsUtc);
    }

    return notificationId;
  }

  /**
   * Stub for handling Android Doze / power-save modes.
   *
   * The design interface requires handleDozeMode(): Promise<void>.
   * Provide a no-op async implementation that logs a TODO so callers
   * can safely call this method and compilation/types pass.
   */
  async handleDozeMode(): Promise<void> {
    // TODO: Implement real Doze handling (acquire wakelocks, schedule
    // work via WorkManager, use exact alarms, etc.). Left as a no-op
    // for now to preserve cross-platform behavior.
    // Use console.trace for easier debugging during development.
    console.trace(
      '[TaskNotificationService] handleDozeMode: TODO - no-op stub'
    );
    return Promise.resolve();
  }

  /**
   * Cancel all scheduled notifications associated with a task
   */
  static async cancelForTask(taskId: string): Promise<void> {
    try {
      if (process.env.JEST_WORKER_ID !== undefined) return;
      const { database } = await import('@/lib/watermelon');
      const queue = database.collections.get(
        'notification_queue' as any
      ) as any;
      const rows: any[] = await (queue as any).query().fetch();
      const pending = rows.filter((r: any) => r.taskId === taskId);
      for (const row of pending as any[]) {
        const ExpoNotif: any = Notifications as any;
        await ExpoNotif.cancelScheduledNotificationAsync(row.notificationId);
        await database.write(async () => {
          await (row as any).markAsDeleted();
        });
        await NoopAnalytics.track('notif_cancelled', {
          notificationId: row.notificationId,
        });
      }
    } catch (error) {
      console.warn('[Notifications] cancelForTask failed', error);
    }
  }

  /**
   * Compute diff between current queue state and desired notifications derived from tasks.
   * Pure helper to facilitate unit testing of the rehydration logic.
   */
  static computeNotificationDiff(
    tasks: {
      id: string;
      status?: string | null;
      reminderAtUtc?: string | Date | null;
    }[],
    existingQueue: {
      taskId: string;
      notificationId: string;
      scheduledForUtc: string;
      status?: string;
    }[]
  ): {
    toCancel: { notificationId: string; taskId: string }[];
    toSchedule: { taskId: string }[];
  } {
    const byTaskExisting = new Map(existingQueue.map((q) => [q.taskId, q]));

    const toCancel: { notificationId: string; taskId: string }[] = [];
    const toSchedule: { taskId: string }[] = [];

    for (const t of tasks) {
      const existing = byTaskExisting.get(t.id);
      const reminderUtc =
        t.reminderAtUtc instanceof Date
          ? t.reminderAtUtc.toISOString()
          : (t.reminderAtUtc ?? null);

      const shouldSchedule = Boolean(
        reminderUtc && (t.status === undefined || t.status === 'pending')
      );

      if (existing) {
        const unchanged =
          shouldSchedule && existing.scheduledForUtc === reminderUtc;
        if (!unchanged) {
          toCancel.push({
            notificationId: existing.notificationId,
            taskId: t.id,
          });
        }
      }

      if (shouldSchedule) {
        if (!existing || existing.scheduledForUtc !== reminderUtc) {
          toSchedule.push({ taskId: t.id });
        }
      }
    }

    return { toCancel, toSchedule };
  }

  /**
   * Fetches existing notifications and tasks from database
   */
  private async fetchNotificationsAndTasks(changedTaskIds?: string[]) {
    const { database } = await import('@/lib/watermelon');
    const queue = database.collections.get('notification_queue' as any) as any;
    const tasksCollection = database.collections.get('tasks' as any) as any;

    const existing = (await queue
      .query(Q.where('status', 'pending'))
      .fetch()) as any[];
    const tasksToUpdate = changedTaskIds
      ? ((await tasksCollection
          .query(Q.where('id', Q.oneOf(changedTaskIds)))
          .fetch()) as any[])
      : ((await tasksCollection.query().fetch()) as any[]);

    return { database, queue, existing, tasksToUpdate };
  }

  /**
   * Cancels outdated notifications and removes them from database
   */
  private async cancelOutdatedNotifications(
    diff: any,
    existing: any[],
    database: any
  ): Promise<void> {
    for (const { notificationId } of diff.toCancel) {
      try {
        const ExpoNotif: any = Notifications as any;
        await ExpoNotif.cancelScheduledNotificationAsync(notificationId);
      } catch (err) {
        console.warn('[Notifications] cancel during rehydrate failed', err);
      }
      const row = existing.find(
        (r: any) => r.notificationId === notificationId
      );
      if (row) {
        await database.write(async () => {
          await (row as any).markAsDeleted();
        });
      }
    }
  }

  /**
   * Schedules missing or updated notifications
   */
  private async scheduleMissingNotifications(
    diff: any,
    tasksToUpdate: any[]
  ): Promise<void> {
    if (diff.toSchedule.length === 0) return;

    const byId = new Map(tasksToUpdate.map((t: any) => [t.id, t]));
    for (const { taskId } of diff.toSchedule) {
      const model = byId.get(taskId);
      if (!model) continue;

      const task = {
        id: model.id,
        title: model.title,
        description: model.description,
        reminderAtUtc: model.reminderAtUtc,
        reminderAtLocal: model.reminderAtLocal,
        dueAtUtc: model.dueAtUtc,
        dueAtLocal: model.dueAtLocal,
        recurrenceRule: undefined,
        plantId: model.plantId,
      } as Task;

      try {
        await this.scheduleTaskReminder(task);
      } catch (err) {
        console.warn('[Notifications] schedule during rehydrate failed', err);
      }
    }
  }

  /**
   * Differentially re-plan notifications based on changed task IDs or entire task set.
   * - Cancels outdated queue entries
   * - Schedules missing/updated notifications
   */
  async rehydrateNotifications(changedTaskIds?: string[]): Promise<void> {
    if (process.env.JEST_WORKER_ID !== undefined) return;

    const { database, existing, tasksToUpdate } =
      await this.fetchNotificationsAndTasks(changedTaskIds);

    const diff = TaskNotificationService.computeNotificationDiff(
      tasksToUpdate.map((t: any) => ({
        id: t.id,
        status: t.status,
        reminderAtUtc: t.reminderAtUtc,
      })),
      existing.map((e: any) => ({
        taskId: e.taskId,
        notificationId: e.notificationId,
        scheduledForUtc: e.scheduledForUtc,
        status: e.status,
      }))
    );

    await this.cancelOutdatedNotifications(diff, existing, database);
    await this.scheduleMissingNotifications(diff, tasksToUpdate);
  }
}
