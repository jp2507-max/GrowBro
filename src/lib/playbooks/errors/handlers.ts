import type { TFunction } from 'i18next';
import { showMessage } from 'react-native-flash-message';

import { getErrorMessage, getRecoveryAction, isRetryable } from './messages';
import {
  ErrorCode,
  InvalidTaskTimestampError,
  NotificationError,
  PlaybookError,
  RRULEError,
  SyncError,
} from './types';

// Analytics interface for error tracking
export interface Analytics {
  track(event: string, properties?: Record<string, unknown>): void;
}

/**
 * RRULE error handler with fallback options
 */
export class RRULEErrorHandler {
  constructor(
    private analytics: Analytics,
    private t: TFunction
  ) {}

  handleRRULEValidationError(error: RRULEError): {
    fallbackOptions: { label: string; value: string }[];
    message: string;
  } {
    // Log error for debugging (sanitized)
    console.error('[RRULEError]', {
      code: error.code,
      message: error.message,
      // Don't log the actual RRULE to avoid PII
    });

    // Emit analytics event
    this.analytics.track('rrule_invalid', error.toAnalyticsPayload());

    // Get localized message
    const message = getErrorMessage(error.code, this.t);

    // Provide fallback simple recurrence options
    const fallbackOptions = [
      {
        label: this.t('rrule.fallback.daily', { defaultValue: 'Every day' }),
        value: 'FREQ=DAILY;INTERVAL=1',
      },
      {
        label: this.t('rrule.fallback.every_2_days', {
          defaultValue: 'Every 2 days',
        }),
        value: 'FREQ=DAILY;INTERVAL=2',
      },
      {
        label: this.t('rrule.fallback.every_3_days', {
          defaultValue: 'Every 3 days',
        }),
        value: 'FREQ=DAILY;INTERVAL=3',
      },
      {
        label: this.t('rrule.fallback.weekly', { defaultValue: 'Once a week' }),
        value: 'FREQ=WEEKLY;INTERVAL=1',
      },
      {
        label: this.t('rrule.fallback.biweekly', {
          defaultValue: 'Every 2 weeks',
        }),
        value: 'FREQ=WEEKLY;INTERVAL=2',
      },
    ];

    return { fallbackOptions, message };
  }

  showRRULEError(error: RRULEError): void {
    const message = getErrorMessage(error.code, this.t);
    const action = getRecoveryAction(error.code, this.t);

    showMessage({
      message: this.t('errors.rrule.title', {
        defaultValue: 'Recurrence Error',
      }),
      description: action ? `${message}\n${action}` : message,
      type: 'warning',
      duration: 5000,
    });
  }
}

/**
 * Notification error handler with fallback strategies
 */
export class NotificationErrorHandler {
  constructor(
    private analytics: Analytics,
    private t: TFunction
  ) {}

  async handleNotificationFailure(error: NotificationError): Promise<void> {
    // Log error for debugging
    console.error('[NotificationError]', {
      code: error.code,
      taskId: error.taskId,
      notificationId: error.notificationId,
    });

    // Emit analytics event
    this.analytics.track('notif_missed', error.toAnalyticsPayload());

    // Handle specific error types
    switch (error.code) {
      case ErrorCode.NOTIFICATION_PERMISSION_DENIED:
        await this.handlePermissionDenied();
        break;

      case ErrorCode.NOTIFICATION_DOZE_MODE_ACTIVE:
        await this.handleDozeMode();
        break;

      case ErrorCode.NOTIFICATION_SCHEDULE_FAILED:
      case ErrorCode.NOTIFICATION_DELIVERY_FAILED:
        await this.createInAppReminder(error.taskId);
        break;

      default:
        this.showGenericNotificationError(error);
    }
  }

  private async handlePermissionDenied(): Promise<void> {
    showMessage({
      message: this.t('errors.notification.permission_title', {
        defaultValue: 'Notifications Disabled',
      }),
      description: getErrorMessage(
        ErrorCode.NOTIFICATION_PERMISSION_DENIED,
        this.t
      ),
      type: 'warning',
      duration: 6000,
      onPress: () => {
        // Open app settings
        // This would be implemented with Linking.openSettings()
      },
    });
  }

  private async handleDozeMode(): Promise<void> {
    showMessage({
      message: this.t('errors.notification.battery_optimization_title', {
        defaultValue: 'Battery Optimization Active',
      }),
      description: getErrorMessage(
        ErrorCode.NOTIFICATION_DOZE_MODE_ACTIVE,
        this.t
      ),
      type: 'info',
      duration: 6000,
    });
  }

  private async createInAppReminder(taskId?: string): Promise<void> {
    if (!taskId) return;

    // Create in-app reminder as fallback
    // This would store a flag in the task to show an in-app reminder
    console.log(
      '[NotificationFallback] Creating in-app reminder for task:',
      taskId
    );

    showMessage({
      message: this.t('errors.notification.fallback_title', {
        defaultValue: 'Reminder Created',
      }),
      description: this.t('errors.notification.fallback_description', {
        defaultValue: "We'll show you a reminder when you open the app",
      }),
      type: 'info',
      duration: 4000,
    });
  }

  private showGenericNotificationError(error: NotificationError): void {
    const message = getErrorMessage(error.code, this.t);
    const action = getRecoveryAction(error.code, this.t);

    showMessage({
      message: this.t('errors.notification.title', {
        defaultValue: 'Reminder Error',
      }),
      description: action ? `${message}\n${action}` : message,
      type: 'danger',
      duration: 5000,
    });
  }
}

/**
 * Sync error handler with exponential backoff retry
 */
export class SyncErrorHandler {
  private retryAttempts = new Map<string, number>();
  private readonly maxRetries = 5;
  private readonly baseDelay = 1000; // 1 second

  constructor(
    private analytics: Analytics,
    private t: TFunction
  ) {}

  async handleSyncFailure(
    error: SyncError,
    operationId: string
  ): Promise<void> {
    // Log error for debugging
    console.error('[SyncError]', {
      code: error.code,
      retryable: error.retryable,
      operationId,
    });

    // Emit analytics event
    this.analytics.track('sync_fail_rate', {
      ...error.toAnalyticsPayload(),
      operation_id: operationId,
    });

    // Handle non-retryable errors
    if (!error.retryable) {
      this.showPermanentError(error);
      return;
    }

    // Handle retryable errors with exponential backoff
    const attempts = this.retryAttempts.get(operationId) || 0;

    if (attempts >= this.maxRetries) {
      this.showMaxRetriesError(error);
      this.retryAttempts.delete(operationId);
      return;
    }

    // Calculate backoff delay with jitter
    const delay = this.calculateBackoffDelay(attempts);
    this.retryAttempts.set(operationId, attempts + 1);

    // Show retry notification
    this.showRetryNotification(error, attempts + 1, delay);

    // Schedule retry
    await this.scheduleRetry(operationId, delay);
  }

  private calculateBackoffDelay(attempt: number): number {
    // Exponential backoff: baseDelay * 2^attempt + jitter
    const exponentialDelay = this.baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 1000; // 0-1 second jitter
    return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
  }

  private async scheduleRetry(
    operationId: string,
    delay: number
  ): Promise<void> {
    // This would be implemented to actually retry the sync operation
    console.log(
      `[SyncRetry] Scheduling retry for ${operationId} in ${delay}ms`
    );
  }

  private showRetryNotification(
    error: SyncError,
    attempt: number,
    delay: number
  ): void {
    const message = getErrorMessage(error.code, this.t);

    showMessage({
      message: this.t('errors.sync.retrying_title', {
        defaultValue: 'Syncing...',
      }),
      description: this.t('errors.sync.retrying_description', {
        defaultValue: `${message} Retrying in ${Math.round(delay / 1000)}s (attempt ${attempt})`,
        delay: Math.round(delay / 1000),
        attempt,
      }),
      type: 'info',
      duration: 3000,
    });
  }

  private showPermanentError(error: SyncError): void {
    const message = getErrorMessage(error.code, this.t);
    const action = getRecoveryAction(error.code, this.t);

    showMessage({
      message: this.t('errors.sync.permanent_title', {
        defaultValue: 'Sync Error',
      }),
      description: action ? `${message}\n${action}` : message,
      type: 'danger',
      duration: 6000,
    });
  }

  private showMaxRetriesError(error: SyncError): void {
    const message = getErrorMessage(error.code, this.t);

    showMessage({
      message: this.t('errors.sync.max_retries_title', {
        defaultValue: 'Sync Failed',
      }),
      description: this.t('errors.sync.max_retries_description', {
        defaultValue: `${message} Please try again later.`,
      }),
      type: 'danger',
      duration: 6000,
    });
  }

  clearRetryAttempts(operationId: string): void {
    this.retryAttempts.delete(operationId);
  }
}

/**
 * Offline error handler for general error management
 */
export class OfflineErrorHandler {
  // eslint-disable-next-line max-params
  constructor(
    private rruleHandler: RRULEErrorHandler,
    private notificationHandler: NotificationErrorHandler,
    private syncHandler: SyncErrorHandler,
    private analytics: Analytics,
    private t: TFunction
  ) {}

  async handleError(
    error: unknown,
    context?: Record<string, unknown>
  ): Promise<void> {
    // Handle typed errors
    if (error instanceof RRULEError) {
      this.rruleHandler.showRRULEError(error);
      return;
    }

    if (error instanceof NotificationError) {
      await this.notificationHandler.handleNotificationFailure(error);
      return;
    }

    if (error instanceof SyncError) {
      const operationId = (context?.operationId as string) || 'unknown';
      await this.syncHandler.handleSyncFailure(error, operationId);
      return;
    }

    if (error instanceof InvalidTaskTimestampError) {
      this.handleTaskTimestampError(error);
      return;
    }

    if (error instanceof PlaybookError) {
      this.handlePlaybookError(error);
      return;
    }

    // Handle unknown errors
    this.handleUnknownError(error, context);
  }

  private handleTaskTimestampError(error: InvalidTaskTimestampError): void {
    console.error('[TaskTimestampError]', error.message);

    this.analytics.track('task_timestamp_error', error.toAnalyticsPayload());

    showMessage({
      message: this.t('errors.task.timestamp_title', {
        defaultValue: 'Invalid Date',
      }),
      description: getErrorMessage(error.code, this.t),
      type: 'danger',
      duration: 4000,
    });
  }

  private handlePlaybookError(error: PlaybookError): void {
    console.error('[PlaybookError]', {
      code: error.code,
      message: error.message,
    });

    this.analytics.track('playbook_error', error.toAnalyticsPayload());

    const message = getErrorMessage(error.code, this.t);
    const action = getRecoveryAction(error.code, this.t);
    const retry = isRetryable(error.code);

    showMessage({
      message: this.t('errors.playbook.title', {
        defaultValue: 'Playbook Error',
      }),
      description: action ? `${message}\n${action}` : message,
      type: 'danger',
      duration: retry ? 6000 : 4000,
    });
  }

  private handleUnknownError(
    error: unknown,
    context?: Record<string, unknown>
  ): void {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error('[UnknownError]', errorMessage, context);

    this.analytics.track('unknown_error', {
      error_message: errorMessage,
      error_type:
        error instanceof Error ? error.constructor.name : typeof error,
      ...context,
    });

    showMessage({
      message: this.t('errors.unknown_title', { defaultValue: 'Error' }),
      description: this.t('errors.unknown_description', {
        defaultValue: 'An unexpected error occurred. Please try again.',
      }),
      type: 'danger',
      duration: 4000,
    });
  }
}
