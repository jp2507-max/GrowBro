import { getErrorMessage, getRecoveryAction, isRetryable } from './messages';
import { ErrorCode } from './types';

// Mock translation function
const mockT = ((key: string, options?: any) => {
  return options?.defaultValue || key;
}) as any;

describe('Error Messages', () => {
  describe('getErrorMessage', () => {
    test('returns localized message for RRULE errors', () => {
      const message = getErrorMessage(ErrorCode.RRULE_INVALID_FORMAT, mockT);
      expect(message).toBe('Invalid recurrence pattern format');
    });

    test('returns localized message for notification errors', () => {
      const message = getErrorMessage(
        ErrorCode.NOTIFICATION_PERMISSION_DENIED,
        mockT
      );
      expect(message).toBe(
        'Notification permission denied. Please enable notifications in settings.'
      );
    });

    test('returns localized message for sync errors', () => {
      const message = getErrorMessage(ErrorCode.SYNC_NETWORK_ERROR, mockT);
      expect(message).toBe(
        'Network connection error. Changes will sync when online.'
      );
    });

    test('returns localized message for playbook errors', () => {
      const message = getErrorMessage(
        ErrorCode.PLAYBOOK_ALREADY_APPLIED,
        mockT
      );
      expect(message).toBe('This playbook is already applied to this plant');
    });

    test('returns localized message for task errors', () => {
      const message = getErrorMessage(ErrorCode.TASK_INVALID_TIMESTAMP, mockT);
      expect(message).toBe('Invalid task date or time');
    });

    test('returns default message for unknown error code', () => {
      const message = getErrorMessage('UNKNOWN_CODE' as ErrorCode, mockT);
      expect(message).toBe('An unexpected error occurred');
    });
  });

  describe('getRecoveryAction', () => {
    test('returns recovery action for RRULE errors', () => {
      const action = getRecoveryAction(ErrorCode.RRULE_INVALID_FORMAT, mockT);
      expect(action).toBe('Use simple daily or weekly recurrence instead');
    });

    test('returns recovery action for notification permission error', () => {
      const action = getRecoveryAction(
        ErrorCode.NOTIFICATION_PERMISSION_DENIED,
        mockT
      );
      expect(action).toBe('Open Settings to enable notifications');
    });

    test('returns recovery action for sync network error', () => {
      const action = getRecoveryAction(ErrorCode.SYNC_NETWORK_ERROR, mockT);
      expect(action).toBe('Check your internet connection');
    });

    test('returns recovery action for auth error', () => {
      const action = getRecoveryAction(ErrorCode.SYNC_AUTH_ERROR, mockT);
      expect(action).toBe('Sign in again');
    });

    test('returns null for errors without recovery action', () => {
      const action = getRecoveryAction(ErrorCode.PLAYBOOK_NOT_FOUND, mockT);
      expect(action).toBeNull();
    });
  });

  describe('isRetryable', () => {
    test('returns true for retryable sync errors', () => {
      expect(isRetryable(ErrorCode.SYNC_NETWORK_ERROR)).toBe(true);
      expect(isRetryable(ErrorCode.SYNC_TIMEOUT)).toBe(true);
      expect(isRetryable(ErrorCode.SYNC_SERVER_ERROR)).toBe(true);
    });

    test('returns true for retryable notification errors', () => {
      expect(isRetryable(ErrorCode.NOTIFICATION_SCHEDULE_FAILED)).toBe(true);
      expect(isRetryable(ErrorCode.NOTIFICATION_CANCEL_FAILED)).toBe(true);
    });

    test('returns true for retryable playbook errors', () => {
      expect(isRetryable(ErrorCode.PLAYBOOK_GENERATION_FAILED)).toBe(true);
    });

    test('returns true for retryable task errors', () => {
      expect(isRetryable(ErrorCode.TASK_UPDATE_FAILED)).toBe(true);
    });

    test('returns false for non-retryable errors', () => {
      expect(isRetryable(ErrorCode.SYNC_AUTH_ERROR)).toBe(false);
      expect(isRetryable(ErrorCode.NOTIFICATION_PERMISSION_DENIED)).toBe(false);
      expect(isRetryable(ErrorCode.RRULE_INVALID_FORMAT)).toBe(false);
      expect(isRetryable(ErrorCode.PLAYBOOK_ALREADY_APPLIED)).toBe(false);
    });
  });
});
