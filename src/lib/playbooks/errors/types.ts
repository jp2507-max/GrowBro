/**
 * Stable error codes for analytics and user messaging
 * These codes are used as analytics event fields and should never change
 */
export enum ErrorCode {
  // RRULE Errors
  RRULE_INVALID_FORMAT = 'RRULE_INVALID_FORMAT',
  RRULE_MISSING_FREQ = 'RRULE_MISSING_FREQ',
  RRULE_INVALID_FREQ = 'RRULE_INVALID_FREQ',
  RRULE_INVALID_INTERVAL = 'RRULE_INVALID_INTERVAL',
  RRULE_INVALID_BYDAY = 'RRULE_INVALID_BYDAY',
  RRULE_INVALID_BYMONTHDAY = 'RRULE_INVALID_BYMONTHDAY',
  RRULE_COUNT_AND_UNTIL = 'RRULE_COUNT_AND_UNTIL',
  RRULE_BYDAY_AND_BYMONTHDAY = 'RRULE_BYDAY_AND_BYMONTHDAY',
  RRULE_PARSE_ERROR = 'RRULE_PARSE_ERROR',
  RRULE_TIMEZONE_ERROR = 'RRULE_TIMEZONE_ERROR',

  // Notification Errors
  NOTIFICATION_CHANNEL_MISSING = 'NOTIFICATION_CHANNEL_MISSING',
  NOTIFICATION_PERMISSION_DENIED = 'NOTIFICATION_PERMISSION_DENIED',
  NOTIFICATION_SCHEDULE_FAILED = 'NOTIFICATION_SCHEDULE_FAILED',
  NOTIFICATION_CANCEL_FAILED = 'NOTIFICATION_CANCEL_FAILED',
  NOTIFICATION_DELIVERY_FAILED = 'NOTIFICATION_DELIVERY_FAILED',
  NOTIFICATION_EXACT_ALARM_UNAVAILABLE = 'NOTIFICATION_EXACT_ALARM_UNAVAILABLE',
  NOTIFICATION_DOZE_MODE_ACTIVE = 'NOTIFICATION_DOZE_MODE_ACTIVE',
  NOTIFICATION_INVALID_TRIGGER = 'NOTIFICATION_INVALID_TRIGGER',

  // Sync Errors
  SYNC_NETWORK_ERROR = 'SYNC_NETWORK_ERROR',
  SYNC_CONFLICT_DETECTED = 'SYNC_CONFLICT_DETECTED',
  SYNC_AUTH_ERROR = 'SYNC_AUTH_ERROR',
  SYNC_SERVER_ERROR = 'SYNC_SERVER_ERROR',
  SYNC_TIMEOUT = 'SYNC_TIMEOUT',
  SYNC_INVALID_DATA = 'SYNC_INVALID_DATA',
  SYNC_QUOTA_EXCEEDED = 'SYNC_QUOTA_EXCEEDED',
  SYNC_VERSION_MISMATCH = 'SYNC_VERSION_MISMATCH',

  // Playbook Errors
  PLAYBOOK_ALREADY_APPLIED = 'PLAYBOOK_ALREADY_APPLIED',
  PLAYBOOK_NOT_FOUND = 'PLAYBOOK_NOT_FOUND',
  PLAYBOOK_INVALID_SCHEMA = 'PLAYBOOK_INVALID_SCHEMA',
  PLAYBOOK_GENERATION_FAILED = 'PLAYBOOK_GENERATION_FAILED',

  // Task Errors
  TASK_INVALID_TIMESTAMP = 'TASK_INVALID_TIMESTAMP',
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  TASK_UPDATE_FAILED = 'TASK_UPDATE_FAILED',
}

/**
 * Base error class with analytics support
 */
export abstract class PlaybookError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Convert error to analytics event payload
   */
  toAnalyticsPayload(): Record<string, unknown> {
    return {
      error_code: this.code,
      error_message: this.message,
      error_type: this.name,
      ...this.context,
    };
  }
}

/**
 * RRULE validation and parsing errors
 */
export class RRULEError extends PlaybookError {
  // eslint-disable-next-line max-params
  constructor(
    code: ErrorCode,
    message: string,
    public readonly rrule?: string,
    context?: Record<string, unknown>
  ) {
    super(code, message, { ...context, rrule });
  }
}

/**
 * Notification scheduling and delivery errors
 */
export class NotificationError extends PlaybookError {
  // eslint-disable-next-line max-params
  constructor(
    code: ErrorCode,
    message: string,
    public readonly taskId?: string,
    public readonly notificationId?: string,
    context?: Record<string, unknown>
  ) {
    super(code, message, {
      ...context,
      task_id: taskId,
      notification_id: notificationId,
    });
  }
}

/**
 * Sync operation errors with retry capability
 */
export class SyncError extends PlaybookError {
  // eslint-disable-next-line max-params
  constructor(
    code: ErrorCode,
    message: string,
    public readonly retryable: boolean = true,
    public readonly retryAfter?: number,
    context?: Record<string, unknown>
  ) {
    super(code, message, { ...context, retryable, retry_after: retryAfter });
  }
}

/**
 * Invalid task timestamp errors
 */
export class InvalidTaskTimestampError extends PlaybookError {
  constructor(taskId: string, message: string) {
    super(
      ErrorCode.TASK_INVALID_TIMESTAMP,
      `Invalid timestamp for task ${taskId}: ${message}`,
      { task_id: taskId }
    );
  }
}

/**
 * Playbook operation errors
 */
export class PlaybookOperationError extends PlaybookError {
  // eslint-disable-next-line max-params
  constructor(
    code: ErrorCode,
    message: string,
    public readonly playbookId?: string,
    public readonly plantId?: string,
    context?: Record<string, unknown>
  ) {
    super(code, message, {
      ...context,
      playbook_id: playbookId,
      plant_id: plantId,
    });
  }
}
