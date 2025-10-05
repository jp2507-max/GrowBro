import {
  ErrorCode,
  InvalidTaskTimestampError,
  NotificationError,
  PlaybookOperationError,
  RRULEError,
  SyncError,
} from './types';

describe('Error Types', () => {
  describe('RRULEError', () => {
    test('creates error with code and message', () => {
      const error = new RRULEError(
        ErrorCode.RRULE_INVALID_FORMAT,
        'Invalid format',
        'FREQ=INVALID'
      );

      expect(error.code).toBe(ErrorCode.RRULE_INVALID_FORMAT);
      expect(error.message).toBe('Invalid format');
      expect(error.rrule).toBe('FREQ=INVALID');
      expect(error.name).toBe('RRULEError');
    });

    test('converts to analytics payload', () => {
      const error = new RRULEError(
        ErrorCode.RRULE_INVALID_FORMAT,
        'Invalid format',
        'FREQ=INVALID',
        { userId: 'user-123' }
      );

      const payload = error.toAnalyticsPayload();

      expect(payload).toEqual({
        error_code: ErrorCode.RRULE_INVALID_FORMAT,
        error_message: 'Invalid format',
        error_type: 'RRULEError',
        rrule: 'FREQ=INVALID',
        userId: 'user-123',
      });
    });
  });

  describe('NotificationError', () => {
    test('creates error with task and notification IDs', () => {
      const error = new NotificationError(
        ErrorCode.NOTIFICATION_SCHEDULE_FAILED,
        'Schedule failed',
        'task-123',
        'notif-456'
      );

      expect(error.code).toBe(ErrorCode.NOTIFICATION_SCHEDULE_FAILED);
      expect(error.message).toBe('Schedule failed');
      expect(error.taskId).toBe('task-123');
      expect(error.notificationId).toBe('notif-456');
      expect(error.name).toBe('NotificationError');
    });

    test('converts to analytics payload with IDs', () => {
      const error = new NotificationError(
        ErrorCode.NOTIFICATION_SCHEDULE_FAILED,
        'Schedule failed',
        'task-123',
        'notif-456'
      );

      const payload = error.toAnalyticsPayload();

      expect(payload).toEqual({
        error_code: ErrorCode.NOTIFICATION_SCHEDULE_FAILED,
        error_message: 'Schedule failed',
        error_type: 'NotificationError',
        task_id: 'task-123',
        notification_id: 'notif-456',
      });
    });
  });

  describe('SyncError', () => {
    test('creates retryable error', () => {
      const error = new SyncError(
        ErrorCode.SYNC_NETWORK_ERROR,
        'Network error',
        true,
        5000
      );

      expect(error.code).toBe(ErrorCode.SYNC_NETWORK_ERROR);
      expect(error.message).toBe('Network error');
      expect(error.retryable).toBe(true);
      expect(error.retryAfter).toBe(5000);
      expect(error.name).toBe('SyncError');
    });

    test('creates non-retryable error', () => {
      const error = new SyncError(
        ErrorCode.SYNC_AUTH_ERROR,
        'Auth error',
        false
      );

      expect(error.retryable).toBe(false);
      expect(error.retryAfter).toBeUndefined();
    });

    test('converts to analytics payload with retry info', () => {
      const error = new SyncError(
        ErrorCode.SYNC_NETWORK_ERROR,
        'Network error',
        true,
        5000
      );

      const payload = error.toAnalyticsPayload();

      expect(payload).toEqual({
        error_code: ErrorCode.SYNC_NETWORK_ERROR,
        error_message: 'Network error',
        error_type: 'SyncError',
        retryable: true,
        retry_after: 5000,
      });
    });
  });

  describe('InvalidTaskTimestampError', () => {
    test('creates error with task ID', () => {
      const error = new InvalidTaskTimestampError(
        'task-123',
        'Invalid ISO date'
      );

      expect(error.code).toBe(ErrorCode.TASK_INVALID_TIMESTAMP);
      expect(error.message).toBe(
        'Invalid timestamp for task task-123: Invalid ISO date'
      );
      expect(error.name).toBe('InvalidTaskTimestampError');
    });

    test('converts to analytics payload with task ID', () => {
      const error = new InvalidTaskTimestampError(
        'task-123',
        'Invalid ISO date'
      );

      const payload = error.toAnalyticsPayload();

      expect(payload).toEqual({
        error_code: ErrorCode.TASK_INVALID_TIMESTAMP,
        error_message: 'Invalid timestamp for task task-123: Invalid ISO date',
        error_type: 'InvalidTaskTimestampError',
        task_id: 'task-123',
      });
    });
  });

  describe('PlaybookOperationError', () => {
    test('creates error with playbook and plant IDs', () => {
      const error = new PlaybookOperationError(
        ErrorCode.PLAYBOOK_ALREADY_APPLIED,
        'Already applied',
        'playbook-123',
        'plant-456'
      );

      expect(error.code).toBe(ErrorCode.PLAYBOOK_ALREADY_APPLIED);
      expect(error.message).toBe('Already applied');
      expect(error.playbookId).toBe('playbook-123');
      expect(error.plantId).toBe('plant-456');
      expect(error.name).toBe('PlaybookOperationError');
    });

    test('converts to analytics payload with IDs', () => {
      const error = new PlaybookOperationError(
        ErrorCode.PLAYBOOK_ALREADY_APPLIED,
        'Already applied',
        'playbook-123',
        'plant-456'
      );

      const payload = error.toAnalyticsPayload();

      expect(payload).toEqual({
        error_code: ErrorCode.PLAYBOOK_ALREADY_APPLIED,
        error_message: 'Already applied',
        error_type: 'PlaybookOperationError',
        playbook_id: 'playbook-123',
        plant_id: 'plant-456',
      });
    });
  });
});
