/**
 * Example usage of the error handling system
 *
 * This file demonstrates how to use the typed errors, handlers, and analytics
 * in various scenarios throughout the playbook feature.
 *
 * NOTE: This is example code for documentation purposes only.
 * In real usage, these functions would be React components or hooks.
 */

/* eslint-disable react-hooks/rules-of-hooks */

import { useTranslation } from 'react-i18next';

import type { AnalyticsClient } from '@/lib/analytics';

import {
  ErrorCode,
  InvalidTaskTimestampError,
  NotificationError,
  NotificationErrorHandler,
  OfflineErrorHandler,
  PlaybookOperationError,
  RRULEError,
  RRULEErrorHandler,
  SyncError,
  SyncErrorHandler,
} from './index';

/**
 * Example: RRule validation with recovery
 */
export function exampleRRULEValidation(analytics: AnalyticsClient) {
  const { t } = useTranslation();
  const rruleHandler = new RRULEErrorHandler(analytics, t);

  try {
    // Attempt to parse an invalid RRULE
    const rrule = 'FREQ=INVALID;INTERVAL=abc';
    // ... validation logic ...
    throw new RRULEError(
      ErrorCode.RRULE_INVALID_FORMAT,
      'Invalid RRULE format',
      rrule
    );
  } catch (error) {
    if (error instanceof RRULEError) {
      // Get fallback options and show error to user
      const { fallbackOptions, message } =
        rruleHandler.handleRRULEValidationError(error);

      console.log('Error message:', message);
      console.log('Fallback options:', fallbackOptions);

      // Show error notification
      rruleHandler.showRRULEError(error);
    }
  }
}

// Example 2: Notification Scheduling Error
export async function exampleNotificationError(analytics: AnalyticsClient) {
  const { t } = useTranslation();
  const notificationHandler = new NotificationErrorHandler(analytics, t);

  try {
    // Attempt to schedule a notification
    // ... scheduling logic ...
    throw new NotificationError(
      ErrorCode.NOTIFICATION_SCHEDULE_FAILED,
      'Failed to schedule notification',
      'task-123',
      'notif-456'
    );
  } catch (error) {
    if (error instanceof NotificationError) {
      // Handle the error with fallback strategies
      await notificationHandler.handleNotificationFailure(error);
    }
  }
}

// Example 3: Sync Error with Retry
export async function exampleSyncError(analytics: AnalyticsClient) {
  const { t } = useTranslation();
  const syncHandler = new SyncErrorHandler(analytics, t);

  try {
    // Attempt to sync data
    // ... sync logic ...
    throw new SyncError(
      ErrorCode.SYNC_NETWORK_ERROR,
      'Network connection failed',
      true, // retryable
      5000 // retry after 5 seconds
    );
  } catch (error) {
    if (error instanceof SyncError) {
      // Handle with exponential backoff retry
      await syncHandler.handleSyncFailure(error, 'sync-operation-123');
    }
  }
}

// Example 4: Task Timestamp Error
export function exampleTaskTimestampError() {
  try {
    // Validate task timestamp
    const taskId = 'task-123';
    const timestamp = 'invalid-date';

    if (!isValidTimestamp(timestamp)) {
      throw new InvalidTaskTimestampError(
        taskId,
        'Timestamp is not a valid ISO date'
      );
    }
  } catch (error) {
    if (error instanceof InvalidTaskTimestampError) {
      console.error('Task timestamp error:', error.message);
      console.log('Analytics payload:', error.toAnalyticsPayload());
    }
  }
}

// Example 5: Playbook Operation Error
export function examplePlaybookError() {
  try {
    // Attempt to apply playbook
    const playbookId = 'playbook-123';
    const plantId = 'plant-456';

    // Check if already applied
    const isAlreadyApplied = true; // ... check logic ...

    if (isAlreadyApplied) {
      throw new PlaybookOperationError(
        ErrorCode.PLAYBOOK_ALREADY_APPLIED,
        'Playbook is already applied to this plant',
        playbookId,
        plantId
      );
    }
  } catch (error) {
    if (error instanceof PlaybookOperationError) {
      console.error('Playbook error:', error.message);
      console.log('Playbook ID:', error.playbookId);
      console.log('Plant ID:', error.plantId);
    }
  }
}

// Example 6: Unified Error Handler
export async function exampleUnifiedErrorHandler(analytics: AnalyticsClient) {
  const { t } = useTranslation();

  // Create individual handlers
  const rruleHandler = new RRULEErrorHandler(analytics, t);
  const notificationHandler = new NotificationErrorHandler(analytics, t);
  const syncHandler = new SyncErrorHandler(analytics, t);

  // Create unified handler
  const errorHandler = new OfflineErrorHandler(
    rruleHandler,
    notificationHandler,
    syncHandler,
    analytics,
    t
  );

  try {
    // Some operation that might fail
    throw new SyncError(ErrorCode.SYNC_NETWORK_ERROR, 'Network error', true);
  } catch (error) {
    // Handle any type of error
    await errorHandler.handleError(error, {
      operationId: 'my-operation-123',
      userId: 'user-456',
    });
  }
}

// Example 7: Analytics Event Tracking
export function exampleAnalyticsTracking(_analytics: AnalyticsClient) {
  const error = new RRULEError(
    ErrorCode.RRULE_INVALID_FORMAT,
    'Invalid RRULE format',
    'FREQ=INVALID'
  );

  // Track error event with structured payload
  // Example analytics call - in real code, use a proper analytics event type
  // analytics.track('rrule_invalid', error.toAnalyticsPayload());
  console.log('Error tracking:', error.toAnalyticsPayload());

  // The payload will include:
  // {
  //   error_code: 'RRULE_INVALID_FORMAT',
  //   error_message: 'Invalid RRULE format',
  //   error_type: 'RRULEError',
  //   rrule: 'FREQ=INVALID'
  // }
}

// Helper function for timestamp validation
function isValidTimestamp(timestamp: string): boolean {
  const date = new Date(timestamp);
  return !isNaN(date.getTime());
}
