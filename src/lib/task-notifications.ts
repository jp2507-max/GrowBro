// Static import for runtime (tests mock this module)

import { Q } from '@nozbe/watermelondb';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { AppState, PermissionsAndroid, Platform } from 'react-native';

import { NoopAnalytics } from '@/lib/analytics';
import i18n from '@/lib/i18n';
import {
  IOS_PENDING_LIMIT,
  LocalNotificationService,
} from '@/lib/notifications/local-service';
import { NotificationHandler } from '@/lib/permissions/notification-handler';

import { InvalidTaskTimestampError } from './notification-errors';
import { AndroidExactAlarmCoordinator } from './notifications/android-exact-alarm-service';

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
  private pendingDozeTasks = new Map<string, Task>();
  private isDozeRestricted = false;
  private appStateListener?: { remove(): void };
  private iosAppStateListener?: { remove(): void };

  constructor() {
    // Ensure any platform-specific power-management handlers are at least
    // present (no-op for now). Call without await to avoid changing
    // synchronous initialization behavior in callers/tests.
    void this.handleDozeMode();
    this.setupIosForegroundRefresh();
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
    // Do not create channels until permission is granted
    await NotificationHandler.createChannelsAfterGrant();
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
    return NotificationHandler.requestPermissionWithPrimer();
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
    const anyNotifications: any = Notifications;
    const { status, canAskAgain } =
      await anyNotifications.getPermissionsAsync();
    return {
      granted: status === 'granted',
      canAskAgain,
      batteryOptimized: false,
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
    notificationId: string
  ): Promise<void> {
    const { database } = await import('@/lib/watermelon');
    const queue = database.collections.get('notification_queue' as any) as any;

    const scheduledForLocal = task.reminderAtLocal ?? task.dueAtLocal ?? null;
    const scheduledForUtc = task.reminderAtUtc ?? task.dueAtUtc ?? null;

    await database.write(async () => {
      await (queue as any).create((rec: any) => {
        const r = rec as any;
        r.taskId = task.id;
        r.notificationId = notificationId;
        r.scheduledForLocal = scheduledForLocal;
        r.scheduledForUtc = scheduledForUtc;
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
    // Enforce zero notifications before grant (Android 13+)
    // Return early instead of throwing to avoid blocking task operations
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const granted =
        await NotificationHandler.isNotificationPermissionGranted();
      if (!granted) {
        NotificationHandler.suppressNotifications();
        // Skip scheduling instead of failing the operation
        return '';
      }
    }

    await this.ensureChannels();

    const expectsUtc = await this.resolveNotificationExpectsUtc();
    const timestamp = this.resolveReminderTimestamp(task, expectsUtc);

    if (await this.shouldDeferForDoze(timestamp)) {
      this.pendingDozeTasks.set(task.id, task);
      return 'deferred-doze';
    }

    await this.ensureExactAlarms(task, timestamp);

    const notificationId =
      await LocalNotificationService.scheduleExactNotification({
        idTag: `task:${task.id}`,
        title: task.title,
        body: task.description,
        data: {
          taskId: task.id,
          plantId: task.plantId,
          deepLink: buildCalendarDeepLink(task.id),
        },
        triggerDate: timestamp,
        androidChannelKey: 'cultivation.reminders',
        threadId: `cultivation.task.${task.id}`,
      });

    if (process.env.JEST_WORKER_ID === undefined) {
      await this.persistNotificationMapping(task, notificationId);
    }

    try {
      await NoopAnalytics.track('notif_scheduled', { taskId: task.id });
    } catch {}

    return notificationId;
  }

  private async ensureExactAlarms(task: Task, when: Date): Promise<void> {
    if (Platform.OS !== 'android') return;
    await AndroidExactAlarmCoordinator.ensurePermission({
      taskId: task.id,
      triggerAt: when,
    });
  }

  private async shouldDeferForDoze(when: Date): Promise<boolean> {
    if (Platform.OS !== 'android' || Platform.Version < 23) return false;
    if (!this.isDozeRestricted) return false;
    const millisUntil = when.getTime() - Date.now();
    if (millisUntil <= 0) return false;
    const deferThresholdMs = 2 * 60 * 60 * 1000;
    return millisUntil <= deferThresholdMs;
  }

  private async flushPendingDozeTasks(): Promise<void> {
    if (this.pendingDozeTasks.size === 0) return;
    const tasks = Array.from(this.pendingDozeTasks.values());
    this.pendingDozeTasks.clear();
    for (const task of tasks) {
      try {
        await this.scheduleTaskReminder(task);
      } catch (error) {
        console.warn('[Notifications] deferred schedule failed', error);
      }
    }
  }

  /**
   * Stub for handling Android Doze / power-save modes.
   *
   * The design interface requires handleDozeMode(): Promise<void>.
   * Provide a no-op async implementation that logs a TODO so callers
   * can safely call this method and compilation/types pass.
   */
  async handleDozeMode(): Promise<void> {
    if (Platform.OS !== 'android' || Platform.Version < 23) return;
    this.isDozeRestricted = AppState.currentState !== 'active';
    this.appStateListener?.remove?.();
    this.appStateListener = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        this.isDozeRestricted = false;
        void this.flushPendingDozeTasks();
      } else if (state === 'inactive' || state === 'background') {
        this.isDozeRestricted = true;
      }
    }) as unknown as { remove(): void };
  }

  async refreshAfterBackgroundTask(): Promise<void> {
    await this.rehydrateNotifications();
  }

  private setupIosForegroundRefresh(): void {
    if (Platform.OS !== 'ios') return;
    this.iosAppStateListener?.remove?.();
    this.iosAppStateListener = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void this.rehydrateNotifications();
      }
    }) as unknown as { remove(): void };
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
        await LocalNotificationService.cancelScheduledNotification(
          row.notificationId
        );
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
   *
   * Uses the same fallback logic as resolveReminderTimestamp:
   * - Uses reminderAtUtc if present
   * - Falls back to dueAtUtc if reminderAtUtc is null
   */
  static computeNotificationDiff(
    tasks: {
      id: string;
      status?: string | null;
      reminderAtUtc?: string | Date | null;
      dueAtUtc?: string | Date | null;
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

      // Resolve timestamp using same fallback logic as resolveReminderTimestamp
      // First try reminderAtUtc, then fall back to dueAtUtc
      let resolvedTimestamp: string | null = null;
      if (t.reminderAtUtc) {
        resolvedTimestamp =
          t.reminderAtUtc instanceof Date
            ? t.reminderAtUtc.toISOString()
            : t.reminderAtUtc;
      } else if (t.dueAtUtc) {
        resolvedTimestamp =
          t.dueAtUtc instanceof Date ? t.dueAtUtc.toISOString() : t.dueAtUtc;
      }

      const shouldSchedule = Boolean(
        resolvedTimestamp && (t.status === undefined || t.status === 'pending')
      );

      if (existing) {
        const unchanged =
          shouldSchedule && existing.scheduledForUtc === resolvedTimestamp;
        if (!unchanged) {
          toCancel.push({
            notificationId: existing.notificationId,
            taskId: t.id,
          });
        }
      }

      if (shouldSchedule) {
        if (!existing || existing.scheduledForUtc !== resolvedTimestamp) {
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

  private selectSchedulableTasks(tasks: any[]): any[] {
    if (Platform.OS !== 'ios') {
      return tasks;
    }

    const annotated = tasks
      .map((task: Task) => ({
        task,
        timestamp: this.getTaskOrderingTimestamp(task),
      }))
      .filter((entry) => entry.timestamp !== null);

    if (annotated.length <= IOS_PENDING_LIMIT) {
      return annotated.map((entry) => entry.task);
    }

    annotated.sort((a, b) => a.timestamp! - b.timestamp!);

    const limited = annotated.slice(0, IOS_PENDING_LIMIT);
    const selectedIds = new Set(limited.map((entry) => entry.task.id));

    return tasks.filter((task: Task) => selectedIds.has(task.id));
  }

  private getTaskOrderingTimestamp(task: Task): number | null {
    const candidates: (Date | string | null | undefined)[] = [
      task.reminderAtLocal,
      task.reminderAtUtc,
      task.dueAtLocal,
      task.dueAtUtc,
    ];

    let earliest: number | null = null;
    for (const value of candidates) {
      if (!value) continue;
      const date = value instanceof Date ? value : new Date(value);
      const time = date.getTime();
      if (Number.isNaN(time)) continue;
      if (earliest === null || time < earliest) {
        earliest = time;
      }
    }

    return earliest;
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
        await LocalNotificationService.cancelScheduledNotification(
          notificationId
        );
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
   * Merge base diff with orphan deletions when tasks were removed or when doing full rehydrate.
   */
  private mergeDiffWithOrphans(context: {
    diff: any;
    existing: any[];
    tasksToUpdate: any[];
    changedTaskIds?: string[];
  }): {
    toCancel: { notificationId: string; taskId: string }[];
    toSchedule: { taskId: string }[];
  } {
    const { diff, existing, tasksToUpdate, changedTaskIds } = context;
    let mergedDiff = diff;

    if (changedTaskIds && changedTaskIds.length > 0) {
      const presentIds = new Set<string>(tasksToUpdate.map((t: any) => t.id));
      const deletedIds = changedTaskIds.filter((id) => !presentIds.has(id));
      if (deletedIds.length > 0) {
        const orphanRows = existing.filter((e: any) =>
          deletedIds.includes(e.taskId)
        );
        if (orphanRows.length > 0) {
          const orphanCancels = orphanRows.map((e: any) => ({
            notificationId: e.notificationId,
            taskId: e.taskId,
          }));
          const seen = new Set<string>();
          const mergedCancels = [...diff.toCancel, ...orphanCancels].filter(
            (c) => {
              const key = `${c.taskId}:${c.notificationId}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            }
          );
          mergedDiff = { toCancel: mergedCancels, toSchedule: diff.toSchedule };
        }
      }
    } else {
      const presentIds = new Set<string>(tasksToUpdate.map((t: any) => t.id));
      const orphanRows = existing.filter((e: any) => !presentIds.has(e.taskId));
      if (orphanRows.length > 0) {
        const orphanCancels = orphanRows.map((e: any) => ({
          notificationId: e.notificationId,
          taskId: e.taskId,
        }));
        const seen = new Set<string>();
        const mergedCancels = [...diff.toCancel, ...orphanCancels].filter(
          (c) => {
            const key = `${c.taskId}:${c.notificationId}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          }
        );
        mergedDiff = { toCancel: mergedCancels, toSchedule: diff.toSchedule };
      }
    }

    return mergedDiff;
  }

  /**
   * Track analytics for rehydrate operations (best-effort, non-blocking).
   */
  private async trackRehydrateAnalytics(mergedDiff: {
    toCancel: { notificationId: string; taskId: string }[];
    toSchedule: { taskId: string }[];
  }): Promise<void> {
    try {
      for (const c of mergedDiff.toCancel) {
        await NoopAnalytics.track('notif_rehydrate_cancelled', {
          notificationId: c.notificationId,
          taskId: c.taskId,
        });
      }
      for (const s of mergedDiff.toSchedule) {
        await NoopAnalytics.track('notif_rehydrate_scheduled', {
          taskId: s.taskId,
        });
      }
    } catch {}
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

    const schedulingCandidates = this.selectSchedulableTasks(tasksToUpdate);

    const diff = TaskNotificationService.computeNotificationDiff(
      schedulingCandidates.map((t: any) => ({
        id: t.id,
        status: t.status,
        reminderAtUtc: t.reminderAtUtc,
        dueAtUtc: t.dueAtUtc,
      })),
      existing.map((e: any) => ({
        taskId: e.taskId,
        notificationId: e.notificationId,
        scheduledForUtc: e.scheduledForUtc,
        status: e.status,
      }))
    );

    const mergedDiff = this.mergeDiffWithOrphans({
      diff,
      existing,
      tasksToUpdate: schedulingCandidates,
      changedTaskIds,
    });

    await this.cancelOutdatedNotifications(mergedDiff, existing, database);
    await this.scheduleMissingNotifications(mergedDiff, schedulingCandidates);
    await this.scheduleOverdueDigest(tasksToUpdate as Task[]);
    await this.trackRehydrateAnalytics(mergedDiff);
  }

  private async scheduleOverdueDigest(tasks: Task[]): Promise<void> {
    const now = new Date();
    const overdue = tasks.filter((task) => this.isTaskOverdue(task, now));

    if (overdue.length === 0) {
      await this.cancelOverdueDigestIfScheduled();
      return;
    }

    const todayKey = now.toISOString().slice(0, 10);
    const record = await this.getOverdueDigestRecord();
    if (record?.dateKey === todayKey) return;

    const triggerDate = computeDigestTrigger(now);
    const title = i18n.t('notifications.overdue.title');
    const body = i18n.t('notifications.overdue.body', {
      count: overdue.length,
    });

    const notificationId =
      await LocalNotificationService.scheduleExactNotification({
        idTag: 'overdue-digest',
        title,
        body,
        data: {
          deepLink: buildCalendarOverdueDeepLink(),
          overdueTaskIds: overdue.map((task) => task.id),
        },
        triggerDate,
        androidChannelKey: 'cultivation.reminders',
        threadId: 'cultivation.overdue.digest',
      });

    await AsyncStorage.setItem(
      OVERDUE_DIGEST_STORAGE_KEY,
      JSON.stringify({ dateKey: todayKey, notificationId })
    );
  }

  private async cancelOverdueDigestIfScheduled(): Promise<void> {
    const record = await this.getOverdueDigestRecord();
    if (!record?.notificationId) return;
    await LocalNotificationService.cancelScheduledNotification(
      record.notificationId
    );
    await AsyncStorage.removeItem(OVERDUE_DIGEST_STORAGE_KEY);
  }

  private async getOverdueDigestRecord(): Promise<{
    dateKey: string;
    notificationId: string;
  } | null> {
    try {
      const raw = await AsyncStorage.getItem(OVERDUE_DIGEST_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private isTaskOverdue(task: Task, reference: Date): boolean {
    const source = task.dueAtUtc ?? task.reminderAtUtc;
    if (!source) return false;
    const dueDate = source instanceof Date ? source : new Date(source);
    if (Number.isNaN(dueDate.getTime())) return false;
    return dueDate.getTime() < reference.getTime();
  }
}

function computeDigestTrigger(now: Date): Date {
  const trigger = new Date(now);
  trigger.setHours(9, 0, 0, 0);
  if (trigger.getTime() <= now.getTime()) {
    trigger.setDate(trigger.getDate() + 1);
  }
  return trigger;
}

function buildCalendarDeepLink(taskId: string): string {
  return `growbro://calendar?taskId=${encodeURIComponent(taskId)}`;
}

function buildCalendarOverdueDeepLink(): string {
  return 'growbro://calendar?filter=overdue';
}

const OVERDUE_DIGEST_STORAGE_KEY = '@growbro/notifications/overdue-digest';
