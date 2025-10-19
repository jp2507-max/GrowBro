/**
 * Harvest Notification Service
 *
 * Handles local notifications for harvest stage timing reminders.
 * Requirements: 14.1, 14.2, 14.3, 14.4, 5.1, 5.2
 *
 * Features:
 * - Schedule notifications on stage entry for target duration
 * - Send gentle reminders when max duration exceeded
 * - Rehydrate notifications on app start from database
 * - Fully local operation (no network required)
 */

import { Q } from '@nozbe/watermelondb';
import * as Notifications from 'expo-notifications';

import { translate } from '@/lib/i18n';
import { NotificationHandler } from '@/lib/permissions/notification-handler';
import { captureCategorizedErrorSync } from '@/lib/sentry-utils';
import { database } from '@/lib/watermelon';
import type { HarvestModel } from '@/lib/watermelon-models/harvest';
import type { HarvestStage, StageConfig } from '@/types/harvest';
import { HarvestStages } from '@/types/harvest';

import {
  recordRehydrationAttempt,
  recordScheduleAttempt,
  trackNotificationRehydration,
  trackNotificationSchedule,
} from './notification-monitoring';
import {
  calculateElapsedDays,
  exceedsMaxDuration,
  getStageConfig,
} from './stage-config';

/**
 * Result from scheduling a notification
 */
export type NotificationScheduleResult = {
  notificationId: string | null;
  scheduled: boolean;
  error?: string;
};

/**
 * Rehydration statistics
 */
export type RehydrationStats = {
  totalHarvests: number;
  notificationsScheduled: number;
  notificationsCancelled: number;
  errors: number;
};

/**
 * Check and request notification permissions
 */
async function ensureNotificationPermission(): Promise<boolean> {
  const hasPermission =
    await NotificationHandler.isNotificationPermissionGranted();
  if (!hasPermission) {
    return await NotificationHandler.requestPermissionWithPrimer();
  }
  return true;
}

/**
 * Calculate trigger date for notification
 */
function calculateTriggerDate(
  stageStartedAt: Date,
  durationDays: number
): Date | null {
  const triggerDate = new Date(
    stageStartedAt.getTime() + durationDays * 24 * 60 * 60 * 1000
  );
  // Don't schedule notifications in the past
  if (triggerDate <= new Date()) {
    return null;
  }
  return triggerDate;
}

/**
 * Update harvest record with notification ID
 */
async function updateHarvestNotificationId(
  harvestId: string,
  field: 'notificationId' | 'overdueNotificationId',
  notificationId: string
): Promise<void> {
  await database.write(async () => {
    const harvest = await database
      .get<HarvestModel>('harvests')
      .find(harvestId);
    await harvest.update((h) => {
      (h as any)[field] = notificationId;
    });
  });
}

/**
 * Create target notification content
 */
function createTargetNotificationContent(
  stage: HarvestStage,
  config: StageConfig,
  harvestId: string
): Notifications.NotificationContentInput {
  return {
    title: translate('harvest.notifications.target.title', {
      stage: config.name,
    }),
    body: translate('harvest.notifications.target.body', {
      stage: config.name,
      days: config.target_duration_days,
    }),
    data: { harvestId, stage, type: 'harvest_stage_target' },
    sound: 'default',
  };
}

/**
 * Create overdue notification content
 */
function createOverdueNotificationContent(
  stage: HarvestStage,
  config: StageConfig,
  harvestId: string
): Notifications.NotificationContentInput {
  return {
    title: translate('harvest.notifications.overdue.title', {
      stage: config.name,
    }),
    body: translate('harvest.notifications.overdue.body', {
      stage: config.name,
      days: config.max_duration_days,
    }),
    data: { harvestId, stage, type: 'harvest_stage_overdue' },
    sound: 'default',
  };
}

/**
 * Context for notification scheduling
 */
type NotificationScheduleContext = {
  harvestId: string;
  stage: HarvestStage;
  config: StageConfig;
  triggerDate: Date;
  notificationType: 'target' | 'overdue';
  notificationIdField: 'notificationId' | 'overdueNotificationId';
  contentCreator: (
    stage: HarvestStage,
    config: StageConfig,
    harvestId: string
  ) => Notifications.NotificationContentInput;
};

/**
 * Schedule notification with tracking
 */
async function scheduleNotificationWithTracking(
  context: NotificationScheduleContext
): Promise<NotificationScheduleResult> {
  let notificationId: string | undefined;

  try {
    notificationId = await Notifications.scheduleNotificationAsync({
      content: context.contentCreator(
        context.stage,
        context.config,
        context.harvestId
      ),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(
          1,
          Math.floor((context.triggerDate.getTime() - Date.now()) / 1000)
        ),
      },
    });

    // Attempt to update the database with the notification ID
    await updateHarvestNotificationId(
      context.harvestId,
      context.notificationIdField,
      notificationId
    );
  } catch (error) {
    // If scheduling or DB update fails, cancel any scheduled notification
    if (notificationId !== undefined) {
      try {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
      } catch (cancelError) {
        console.warn(
          '[HarvestNotificationService] Failed to cancel orphaned notification:',
          cancelError
        );
      }
    }

    throw error;
  }

  // Only mark as successful after both scheduling and DB update succeed
  const result = { notificationId, scheduled: true };

  recordScheduleAttempt(true);
  await trackNotificationSchedule({
    type: context.notificationType,
    result,
    harvestId: context.harvestId,
    stage: context.stage,
  });

  return result;
}

/**
 * Context for notification scheduling errors
 */
type NotificationErrorContext = {
  harvestId: string;
  stage: HarvestStage;
  notificationType: 'target' | 'overdue';
  message: string;
};

/**
 * Handle notification scheduling error
 */
async function handleScheduleError(
  error: unknown,
  context: NotificationErrorContext
): Promise<NotificationScheduleResult> {
  captureCategorizedErrorSync(error, {
    category: 'notification',
    message: context.message,
    context: { harvestId: context.harvestId, stage: context.stage },
  });

  const result = {
    notificationId: null,
    scheduled: false,
    error: error instanceof Error ? error.message : 'unknown_error',
  };

  recordScheduleAttempt(false);
  await trackNotificationSchedule({
    type: context.notificationType,
    result,
    harvestId: context.harvestId,
    stage: context.stage,
  });

  return result;
}

/**
 * Schedule target duration notification for a harvest stage
 * Requirement 14.1: Schedule local notification for target duration
 */
export async function scheduleStageReminder(
  harvestId: string,
  stage: HarvestStage,
  stageStartedAt: Date
): Promise<NotificationScheduleResult> {
  try {
    const granted = await ensureNotificationPermission();
    if (!granted) {
      return {
        notificationId: null,
        scheduled: false,
        error: 'permission_denied',
      };
    }

    const config = getStageConfig(stage);

    if (config.target_duration_days === 0) {
      return {
        notificationId: null,
        scheduled: false,
        error: 'zero_duration',
      };
    }

    const triggerDate = calculateTriggerDate(
      stageStartedAt,
      config.target_duration_days
    );
    if (!triggerDate) {
      return {
        notificationId: null,
        scheduled: false,
        error: 'past_trigger_time',
      };
    }

    return await scheduleNotificationWithTracking({
      harvestId,
      stage,
      config,
      triggerDate,
      notificationType: 'target',
      notificationIdField: 'notificationId',
      contentCreator: createTargetNotificationContent,
    });
  } catch (error) {
    return await handleScheduleError(error, {
      harvestId,
      stage,
      notificationType: 'target',
      message: 'Failed to schedule harvest stage reminder',
    });
  }
}

/**
 * Schedule overdue reminder notification for exceeded max duration
 * Requirement 14.2: Send gentle reminder when duration exceeds recommendation
 * Requirement 5.2: Provide gentle notifications with guidance
 */
export async function scheduleOverdueReminder(
  harvestId: string,
  stage: HarvestStage,
  stageStartedAt: Date
): Promise<NotificationScheduleResult> {
  try {
    const granted = await ensureNotificationPermission();
    if (!granted) {
      return {
        notificationId: null,
        scheduled: false,
        error: 'permission_denied',
      };
    }

    const config = getStageConfig(stage);

    if (config.max_duration_days === 0) {
      return {
        notificationId: null,
        scheduled: false,
        error: 'zero_duration',
      };
    }

    const triggerDate = calculateTriggerDate(
      stageStartedAt,
      config.max_duration_days
    );
    if (!triggerDate) {
      return {
        notificationId: null,
        scheduled: false,
        error: 'past_trigger_time',
      };
    }

    return await scheduleNotificationWithTracking({
      harvestId,
      stage,
      config,
      triggerDate,
      notificationType: 'overdue',
      notificationIdField: 'overdueNotificationId',
      contentCreator: createOverdueNotificationContent,
    });
  } catch (error) {
    return await handleScheduleError(error, {
      harvestId,
      stage,
      notificationType: 'overdue',
      message: 'Failed to schedule harvest overdue reminder',
    });
  }
}

/**
 * Cancel all notifications for a harvest
 */
export async function cancelStageReminders(harvestId: string): Promise<void> {
  try {
    const harvest = await database
      .get<HarvestModel>('harvests')
      .find(harvestId);

    const notificationId = (harvest as any).notificationId as
      | string
      | undefined;
    const overdueNotificationId = (harvest as any).overdueNotificationId as
      | string
      | undefined;

    if (notificationId) {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    }

    if (overdueNotificationId) {
      await Notifications.cancelScheduledNotificationAsync(
        overdueNotificationId
      );
    }

    // Clear notification IDs from harvest record
    await database.write(async () => {
      await harvest.update((h) => {
        (h as any).notificationId = null;
        (h as any).overdueNotificationId = null;
      });
    });
  } catch (error) {
    captureCategorizedErrorSync(error, {
      category: 'notification',
      message: 'Failed to cancel harvest stage reminders',
      context: { harvestId },
    });
  }
}

/**
 * Cancel specific notification by ID
 */
export async function cancelNotificationById(
  notificationId: string
): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    captureCategorizedErrorSync(error, {
      category: 'notification',
      message: 'Failed to cancel notification',
      context: { notificationId },
    });
  }
}

/**
 * Rehydrate notifications on app start
 * Requirement 14.3: Rehydrate notifications from persisted state
 *
 * Strategy:
 * 1. Query all active harvests (stage !== 'inventory', deleted_at IS NULL)
 * 2. For each harvest, check if notification is still scheduled
 * 3. If missing, reschedule based on current elapsed time
 * 4. If already past target/max, skip scheduling
 */
// eslint-disable-next-line max-lines-per-function
export async function rehydrateNotifications(): Promise<RehydrationStats> {
  const startTime = Date.now();
  const stats: RehydrationStats = {
    totalHarvests: 0,
    notificationsScheduled: 0,
    notificationsCancelled: 0,
    errors: 0,
  };

  try {
    // Check permission first
    const hasPermission =
      await NotificationHandler.isNotificationPermissionGranted();
    if (!hasPermission) {
      return stats;
    }

    // Get all scheduled notifications
    const scheduledNotifications =
      await Notifications.getAllScheduledNotificationsAsync();
    const scheduledIds = new Set(
      scheduledNotifications.map((n) => n.identifier)
    );

    // Query active harvests (not in inventory, not deleted)
    const harvests = await database
      .get<HarvestModel>('harvests')
      .query(
        Q.where('stage', Q.notEq(HarvestStages.INVENTORY)),
        Q.where('deleted_at', null)
      )
      .fetch();

    stats.totalHarvests = harvests.length;

    for (const harvest of harvests) {
      try {
        const notificationId = (harvest as any).notificationId as
          | string
          | undefined;
        const overdueNotificationId = (harvest as any).overdueNotificationId as
          | string
          | undefined;

        const currentTime = new Date();
        const elapsedDays = calculateElapsedDays(
          harvest.stageStartedAt,
          currentTime
        );
        const config = getStageConfig(harvest.stage as HarvestStage);

        // Check target duration notification
        if (notificationId && !scheduledIds.has(notificationId)) {
          // Notification missing, reschedule if not past target
          if (elapsedDays < config.target_duration_days) {
            const result = await scheduleStageReminder(
              harvest.id,
              harvest.stage as HarvestStage,
              harvest.stageStartedAt
            );
            if (result.scheduled) {
              stats.notificationsScheduled++;
            } else {
              stats.errors++;
            }
          }
        } else if (
          !notificationId &&
          elapsedDays < config.target_duration_days
        ) {
          // No notification ID stored but stage is active, schedule new
          const result = await scheduleStageReminder(
            harvest.id,
            harvest.stage as HarvestStage,
            harvest.stageStartedAt
          );
          if (result.scheduled) {
            stats.notificationsScheduled++;
          } else {
            stats.errors++;
          }
        }

        // Check overdue notification
        const isOverdue = exceedsMaxDuration(
          harvest.stage as HarvestStage,
          elapsedDays
        );
        if (overdueNotificationId && !scheduledIds.has(overdueNotificationId)) {
          // Overdue notification missing, reschedule if approaching max
          if (
            elapsedDays < config.max_duration_days &&
            elapsedDays >= config.target_duration_days
          ) {
            const result = await scheduleOverdueReminder(
              harvest.id,
              harvest.stage as HarvestStage,
              harvest.stageStartedAt
            );
            if (result.scheduled) {
              stats.notificationsScheduled++;
            } else {
              stats.errors++;
            }
          }
        } else if (
          !overdueNotificationId &&
          elapsedDays >= config.target_duration_days &&
          elapsedDays < config.max_duration_days
        ) {
          // No overdue notification but approaching max, schedule new
          const result = await scheduleOverdueReminder(
            harvest.id,
            harvest.stage as HarvestStage,
            harvest.stageStartedAt
          );
          if (result.scheduled) {
            stats.notificationsScheduled++;
          } else {
            stats.errors++;
          }
        }

        // Cancel orphaned notifications (harvest completed or stage changed)
        if (notificationId && scheduledIds.has(notificationId) && isOverdue) {
          await cancelNotificationById(notificationId);
          stats.notificationsCancelled++;
        }
      } catch (error) {
        captureCategorizedErrorSync(error, {
          category: 'notification',
          message: 'Error rehydrating notifications for harvest',
          context: { harvestId: harvest.id },
        });
        stats.errors++;
      }
    }

    // Track rehydration success
    const durationMs = Date.now() - startTime;
    recordRehydrationAttempt(stats, durationMs);
    await trackNotificationRehydration(stats, durationMs);

    return stats;
  } catch (error) {
    captureCategorizedErrorSync(error, {
      category: 'notification',
      message: 'Failed to rehydrate harvest notifications',
    });
    stats.errors++;

    // Track rehydration failure
    const durationMs = Date.now() - startTime;
    recordRehydrationAttempt(stats, durationMs);
    await trackNotificationRehydration(stats, durationMs);

    return stats;
  }
}

/**
 * Normalize trigger payload to extract timestamp
 * Checks in order: timestamp ?? value ?? date, coerces to Number
 * Returns Date if finite number, null otherwise
 */
function normalizeTriggerDate(trigger: any): Date | null {
  const timestamp = trigger?.timestamp ?? trigger?.value ?? trigger?.date;
  const numericValue = Number(timestamp);
  return Number.isFinite(numericValue) ? new Date(numericValue) : null;
}

/**
 * Get current notification status for a harvest
 */
export async function getNotificationStatus(harvestId: string): Promise<{
  hasTargetNotification: boolean;
  hasOverdueNotification: boolean;
  targetScheduledFor: Date | null;
  overdueScheduledFor: Date | null;
}> {
  try {
    const harvest = await database
      .get<HarvestModel>('harvests')
      .find(harvestId);
    const notificationId = (harvest as any).notificationId as
      | string
      | undefined;
    const overdueNotificationId = (harvest as any).overdueNotificationId as
      | string
      | undefined;

    const scheduledNotifications =
      await Notifications.getAllScheduledNotificationsAsync();

    const targetNotification = scheduledNotifications.find(
      (n) => n.identifier === notificationId
    );
    const overdueNotification = scheduledNotifications.find(
      (n) => n.identifier === overdueNotificationId
    );

    return {
      hasTargetNotification: !!targetNotification,
      hasOverdueNotification: !!overdueNotification,
      targetScheduledFor: targetNotification?.trigger
        ? normalizeTriggerDate(targetNotification.trigger)
        : null,
      overdueScheduledFor: overdueNotification?.trigger
        ? normalizeTriggerDate(overdueNotification.trigger)
        : null,
    };
  } catch {
    return {
      hasTargetNotification: false,
      hasOverdueNotification: false,
      targetScheduledFor: null,
      overdueScheduledFor: null,
    };
  }
}
