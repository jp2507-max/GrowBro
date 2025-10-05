import type { TFunction } from 'i18next';

import { ErrorCode } from './types';

/**
 * Get RRULE error messages
 */
function getRRULEMessages(t: TFunction): Partial<Record<ErrorCode, string>> {
  return {
    [ErrorCode.RRULE_INVALID_FORMAT]: t('errors.rrule.invalid_format', {
      defaultValue: 'Invalid recurrence pattern format',
    }),
    [ErrorCode.RRULE_MISSING_FREQ]: t('errors.rrule.missing_freq', {
      defaultValue:
        'Recurrence pattern must specify frequency (daily, weekly, etc.)',
    }),
    [ErrorCode.RRULE_INVALID_FREQ]: t('errors.rrule.invalid_freq', {
      defaultValue: 'Invalid recurrence frequency',
    }),
    [ErrorCode.RRULE_INVALID_INTERVAL]: t('errors.rrule.invalid_interval', {
      defaultValue: 'Recurrence interval must be a positive number',
    }),
    [ErrorCode.RRULE_INVALID_BYDAY]: t('errors.rrule.invalid_byday', {
      defaultValue: 'Invalid day of week in recurrence pattern',
    }),
    [ErrorCode.RRULE_INVALID_BYMONTHDAY]: t('errors.rrule.invalid_bymonthday', {
      defaultValue: 'Invalid day of month in recurrence pattern',
    }),
    [ErrorCode.RRULE_COUNT_AND_UNTIL]: t('errors.rrule.count_and_until', {
      defaultValue: 'Recurrence pattern cannot have both count and end date',
    }),
    [ErrorCode.RRULE_BYDAY_AND_BYMONTHDAY]: t(
      'errors.rrule.byday_and_bymonthday',
      {
        defaultValue:
          'Recurrence pattern cannot specify both day of week and day of month',
      }
    ),
    [ErrorCode.RRULE_PARSE_ERROR]: t('errors.rrule.parse_error', {
      defaultValue: 'Could not parse recurrence pattern',
    }),
    [ErrorCode.RRULE_TIMEZONE_ERROR]: t('errors.rrule.timezone_error', {
      defaultValue: 'Invalid timezone for recurrence calculation',
    }),
  };
}

/**
 * Get notification error messages
 */
function getNotificationMessages(
  t: TFunction
): Partial<Record<ErrorCode, string>> {
  return {
    [ErrorCode.NOTIFICATION_CHANNEL_MISSING]: t(
      'errors.notification.channel_missing',
      {
        defaultValue: 'Notification channel not configured',
      }
    ),
    [ErrorCode.NOTIFICATION_PERMISSION_DENIED]: t(
      'errors.notification.permission_denied',
      {
        defaultValue:
          'Notification permission denied. Please enable notifications in settings.',
      }
    ),
    [ErrorCode.NOTIFICATION_SCHEDULE_FAILED]: t(
      'errors.notification.schedule_failed',
      {
        defaultValue: 'Failed to schedule reminder',
      }
    ),
    [ErrorCode.NOTIFICATION_CANCEL_FAILED]: t(
      'errors.notification.cancel_failed',
      {
        defaultValue: 'Failed to cancel reminder',
      }
    ),
    [ErrorCode.NOTIFICATION_DELIVERY_FAILED]: t(
      'errors.notification.delivery_failed',
      {
        defaultValue: 'Reminder was not delivered',
      }
    ),
    [ErrorCode.NOTIFICATION_EXACT_ALARM_UNAVAILABLE]: t(
      'errors.notification.exact_alarm_unavailable',
      { defaultValue: 'Exact alarm scheduling not available on this device' }
    ),
    [ErrorCode.NOTIFICATION_DOZE_MODE_ACTIVE]: t(
      'errors.notification.doze_mode_active',
      {
        defaultValue: 'Device battery optimization may delay reminders',
      }
    ),
    [ErrorCode.NOTIFICATION_INVALID_TRIGGER]: t(
      'errors.notification.invalid_trigger',
      {
        defaultValue: 'Invalid reminder time',
      }
    ),
  };
}

/**
 * Get sync error messages
 */
function getSyncMessages(t: TFunction): Partial<Record<ErrorCode, string>> {
  return {
    [ErrorCode.SYNC_NETWORK_ERROR]: t('errors.sync.network_error', {
      defaultValue: 'Network connection error. Changes will sync when online.',
    }),
    [ErrorCode.SYNC_CONFLICT_DETECTED]: t('errors.sync.conflict_detected', {
      defaultValue: 'Data was updated on another device',
    }),
    [ErrorCode.SYNC_AUTH_ERROR]: t('errors.sync.auth_error', {
      defaultValue: 'Authentication error. Please sign in again.',
    }),
    [ErrorCode.SYNC_SERVER_ERROR]: t('errors.sync.server_error', {
      defaultValue: 'Server error. Please try again later.',
    }),
    [ErrorCode.SYNC_TIMEOUT]: t('errors.sync.timeout', {
      defaultValue: 'Sync timed out. Please try again.',
    }),
    [ErrorCode.SYNC_INVALID_DATA]: t('errors.sync.invalid_data', {
      defaultValue: 'Invalid data received from server',
    }),
    [ErrorCode.SYNC_QUOTA_EXCEEDED]: t('errors.sync.quota_exceeded', {
      defaultValue: 'Storage quota exceeded',
    }),
    [ErrorCode.SYNC_VERSION_MISMATCH]: t('errors.sync.version_mismatch', {
      defaultValue: 'App version mismatch. Please update the app.',
    }),
  };
}

/**
 * Get playbook and task error messages
 */
function getPlaybookTaskMessages(
  t: TFunction
): Partial<Record<ErrorCode, string>> {
  return {
    [ErrorCode.PLAYBOOK_ALREADY_APPLIED]: t('errors.playbook.already_applied', {
      defaultValue: 'This playbook is already applied to this plant',
    }),
    [ErrorCode.PLAYBOOK_NOT_FOUND]: t('errors.playbook.not_found', {
      defaultValue: 'Playbook not found',
    }),
    [ErrorCode.PLAYBOOK_INVALID_SCHEMA]: t('errors.playbook.invalid_schema', {
      defaultValue: 'Invalid playbook format',
    }),
    [ErrorCode.PLAYBOOK_GENERATION_FAILED]: t(
      'errors.playbook.generation_failed',
      {
        defaultValue: 'Failed to generate tasks from playbook',
      }
    ),
    [ErrorCode.TASK_INVALID_TIMESTAMP]: t('errors.task.invalid_timestamp', {
      defaultValue: 'Invalid task date or time',
    }),
    [ErrorCode.TASK_NOT_FOUND]: t('errors.task.not_found', {
      defaultValue: 'Task not found',
    }),
    [ErrorCode.TASK_UPDATE_FAILED]: t('errors.task.update_failed', {
      defaultValue: 'Failed to update task',
    }),
  };
}

/**
 * Get localized error message for an error code
 */
export function getErrorMessage(code: ErrorCode, t: TFunction): string {
  const messages: Record<ErrorCode, string> = {
    ...getRRULEMessages(t),
    ...getNotificationMessages(t),
    ...getSyncMessages(t),
    ...getPlaybookTaskMessages(t),
  } as Record<ErrorCode, string>;

  return (
    messages[code] ||
    t('errors.unknown', { defaultValue: 'An unexpected error occurred' })
  );
}

/**
 * Get user-friendly recovery action for an error code
 */
export function getRecoveryAction(
  code: ErrorCode,
  t: TFunction
): string | null {
  const actions: Partial<Record<ErrorCode, string>> = {
    [ErrorCode.RRULE_INVALID_FORMAT]: t('errors.recovery.rrule_fallback', {
      defaultValue: 'Use simple daily or weekly recurrence instead',
    }),
    [ErrorCode.RRULE_MISSING_FREQ]: t('errors.recovery.rrule_fallback', {
      defaultValue: 'Use simple daily or weekly recurrence instead',
    }),
    [ErrorCode.RRULE_PARSE_ERROR]: t('errors.recovery.rrule_fallback', {
      defaultValue: 'Use simple daily or weekly recurrence instead',
    }),
    [ErrorCode.NOTIFICATION_PERMISSION_DENIED]: t(
      'errors.recovery.enable_notifications',
      {
        defaultValue: 'Open Settings to enable notifications',
      }
    ),
    [ErrorCode.NOTIFICATION_DOZE_MODE_ACTIVE]: t(
      'errors.recovery.disable_battery_optimization',
      {
        defaultValue: 'Disable battery optimization for this app in Settings',
      }
    ),
    [ErrorCode.SYNC_NETWORK_ERROR]: t('errors.recovery.check_connection', {
      defaultValue: 'Check your internet connection',
    }),
    [ErrorCode.SYNC_AUTH_ERROR]: t('errors.recovery.sign_in_again', {
      defaultValue: 'Sign in again',
    }),
    [ErrorCode.SYNC_VERSION_MISMATCH]: t('errors.recovery.update_app', {
      defaultValue: 'Update the app from the store',
    }),
  };

  return actions[code] || null;
}

/**
 * Determine if error should show a retry button
 */
export function isRetryable(code: ErrorCode): boolean {
  const retryableCodes = new Set([
    ErrorCode.SYNC_NETWORK_ERROR,
    ErrorCode.SYNC_TIMEOUT,
    ErrorCode.SYNC_SERVER_ERROR,
    ErrorCode.NOTIFICATION_SCHEDULE_FAILED,
    ErrorCode.NOTIFICATION_CANCEL_FAILED,
    ErrorCode.PLAYBOOK_GENERATION_FAILED,
    ErrorCode.TASK_UPDATE_FAILED,
  ]);

  return retryableCodes.has(code);
}
