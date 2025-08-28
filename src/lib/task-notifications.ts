// Static import for runtime (tests mock this module)
// eslint-disable-next-line import/no-unresolved
import * as Notifications from 'expo-notifications';

import { InvalidTaskTimestampError } from './notification-errors';

// Minimal type shape for notification trigger used in this module
type NotificationTriggerInput = {
  type: 'date';
  date: Date;
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
    // TODO: Implement channel creation logic
    // This is typically required for Android notifications
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
    };
  }

  /**
   * Schedules a task reminder with proper timestamp validation and fallback logic
   */
  async scheduleTaskReminder(task: Task): Promise<string> {
    // Ensure channels exist first
    await this.ensureChannels();

    // 1. Resolve expectsUtc as now
    const expectsUtc = await this.resolveNotificationExpectsUtc();

    // 2. Pick reminderTimestamp = expectsUtc ? task.reminderAtUtc : task.reminderAtLocal
    let reminderTimestamp = expectsUtc
      ? task.reminderAtUtc
      : task.reminderAtLocal;

    // 3. If that value is missing, deterministically fall back to the corresponding dueAtUtc/dueAtLocal
    if (!reminderTimestamp) {
      reminderTimestamp = expectsUtc ? task.dueAtUtc : task.dueAtLocal;
    }

    // 4. If both reminder and due timestamps are missing, throw a typed, descriptive error
    if (!reminderTimestamp) {
      throw new InvalidTaskTimestampError(
        task.id,
        `Both reminder timestamp (${expectsUtc ? 'reminderAtUtc' : 'reminderAtLocal'}) and fallback due timestamp (${expectsUtc ? 'dueAtUtc' : 'dueAtLocal'}) are missing or null`
      );
    }

    // Convert to Date if it's a string
    const timestamp =
      reminderTimestamp instanceof Date
        ? reminderTimestamp
        : new Date(reminderTimestamp);

    // Validate the timestamp is valid
    if (isNaN(timestamp.getTime())) {
      throw new InvalidTaskTimestampError(
        task.id,
        `Invalid date format: ${reminderTimestamp}`
      );
    }

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
        // Keep data payload fields unchanged (task.id, task.plantId)
        data: { taskId: task.id, plantId: task.plantId },
      },
      trigger,
    });

    // TODO: Emit analytics (call kept exactly as specified)

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
}
