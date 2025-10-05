/**
 * Phase Transition Notifications
 *
 * Schedules and manages notifications for upcoming phase transitions
 * to alert users of care requirement changes.
 *
 * Requirements: 8.7
 */

import * as Notifications from 'expo-notifications';
import { DateTime } from 'luxon';

import { storage } from '@/lib/storage';
import type { GrowPhase } from '@/types/playbook';

const PHASE_NOTIFICATION_PREFIX = 'phase_transition_';
const DAYS_BEFORE_TRANSITION = 3; // Notify 3 days before phase change

export type PhaseTransitionNotification = {
  plantId: string;
  playbookId: string;
  currentPhase: GrowPhase;
  nextPhase: GrowPhase;
  transitionDate: string;
  notificationId: string;
};

export type SchedulePhaseNotificationOptions = {
  plantId: string;
  playbookId: string;
  currentPhase: GrowPhase;
  nextPhase: GrowPhase;
  transitionDate: string;
  timezone: string;
};

/**
 * Schedule a phase transition notification
 */
export async function schedulePhaseTransitionNotification(
  options: SchedulePhaseNotificationOptions
): Promise<string | null> {
  const {
    plantId,
    playbookId,
    currentPhase,
    nextPhase,
    transitionDate,
    timezone,
  } = options;
  try {
    const transitionDateTime = DateTime.fromISO(transitionDate, {
      zone: timezone,
    });
    const notificationDateTime = transitionDateTime.minus({
      days: DAYS_BEFORE_TRANSITION,
    });

    // Don't schedule if notification time is in the past
    if (notificationDateTime < DateTime.now()) {
      return null;
    }

    // Cancel any existing notification for this transition
    await cancelPhaseTransitionNotification(plantId, currentPhase);

    // Schedule notification
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Phase Transition Approaching',
        body: `Your plant will transition from ${formatPhaseName(currentPhase)} to ${formatPhaseName(nextPhase)} in ${DAYS_BEFORE_TRANSITION} days. Care requirements will change.`,
        data: {
          type: 'phase_transition',
          plantId,
          playbookId,
          currentPhase,
          nextPhase,
          transitionDate,
        },
        sound: true,
      },
      trigger: {
        type: 'date',
        date: notificationDateTime.toJSDate(),
      } as any,
    });

    // Store notification info
    const notificationInfo: PhaseTransitionNotification = {
      plantId,
      playbookId,
      currentPhase,
      nextPhase,
      transitionDate,
      notificationId,
    };

    const storageKey = `phase_notification_${plantId}_${currentPhase}`;
    storage.set(storageKey, JSON.stringify(notificationInfo));

    return notificationId;
  } catch (error) {
    console.error('Failed to schedule phase transition notification:', error);
    return null;
  }
}

/**
 * Cancel a phase transition notification
 */
export async function cancelPhaseTransitionNotification(
  plantId: string,
  phase: GrowPhase
): Promise<void> {
  try {
    const storageKey = `phase_notification_${plantId}_${phase}`;
    const stored = storage.getString(storageKey);

    if (stored) {
      const info: PhaseTransitionNotification = JSON.parse(stored);
      await Notifications.cancelScheduledNotificationAsync(info.notificationId);
      storage.delete(storageKey);
    }

    // Also try to cancel by identifier
    const identifier = `${PHASE_NOTIFICATION_PREFIX}${plantId}_${phase}`;
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const notification = scheduled.find((n) => n.identifier === identifier);
    if (notification) {
      await Notifications.cancelScheduledNotificationAsync(
        notification.identifier
      );
    }
  } catch (error) {
    console.error('Failed to cancel phase transition notification:', error);
  }
}

export type CheckTransitionsOptions = {
  plantId: string;
  playbookId: string;
  currentPhaseIndex: number;
  phaseOrder: GrowPhase[];
  phaseEndDate: string | null;
  timezone: string;
};

/**
 * Check for upcoming phase transitions and schedule notifications
 */
export async function checkUpcomingTransitions(
  options: CheckTransitionsOptions
): Promise<void> {
  const {
    plantId,
    playbookId,
    currentPhaseIndex,
    phaseOrder,
    phaseEndDate,
    timezone,
  } = options;
  if (!phaseEndDate || currentPhaseIndex >= phaseOrder.length - 1) {
    return; // No next phase or no end date
  }

  const currentPhase = phaseOrder[currentPhaseIndex];
  const nextPhase = phaseOrder[currentPhaseIndex + 1];

  const endDate = DateTime.fromISO(phaseEndDate, { zone: timezone });
  const now = DateTime.now().setZone(timezone);
  const daysUntilTransition = endDate.diff(now, 'days').days;

  // Schedule notification if transition is within notification window
  if (
    daysUntilTransition > 0 &&
    daysUntilTransition <= DAYS_BEFORE_TRANSITION + 1
  ) {
    await schedulePhaseTransitionNotification({
      plantId,
      playbookId,
      currentPhase,
      nextPhase,
      transitionDate: phaseEndDate,
      timezone,
    });
  }
}

/**
 * Rehydrate phase transition notifications on app start
 */
export async function rehydratePhaseNotifications(): Promise<void> {
  try {
    // Get all stored phase notifications
    const allKeys = storage.getAllKeys();
    const phaseNotificationKeys = allKeys.filter((key) =>
      key.startsWith('phase_notification_')
    );

    for (const key of phaseNotificationKeys) {
      const stored = storage.getString(key);
      if (!stored) continue;

      const info: PhaseTransitionNotification = JSON.parse(stored);
      const transitionDate = DateTime.fromISO(info.transitionDate);

      // Remove expired notifications
      if (transitionDate < DateTime.now()) {
        storage.delete(key);
        continue;
      }

      // Check if notification still exists
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      const exists = scheduled.some(
        (n) => n.identifier === info.notificationId
      );

      if (!exists) {
        // Reschedule if missing
        const plantTimezone = 'UTC'; // TODO: Get from plant record
        await schedulePhaseTransitionNotification({
          plantId: info.plantId,
          playbookId: info.playbookId,
          currentPhase: info.currentPhase,
          nextPhase: info.nextPhase,
          transitionDate: info.transitionDate,
          timezone: plantTimezone,
        });
      }
    }
  } catch (error) {
    console.error('Failed to rehydrate phase notifications:', error);
  }
}

/**
 * Format phase name for display
 */
function formatPhaseName(phase: GrowPhase): string {
  const names: Record<GrowPhase, string> = {
    seedling: 'Seedling',
    veg: 'Vegetative',
    flower: 'Flowering',
    harvest: 'Harvest',
  };
  return names[phase] || phase;
}
