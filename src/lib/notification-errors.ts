/**
 * Custom error for invalid task timestamp scenarios
 */
export class InvalidTaskTimestampError extends Error {
  constructor(taskId: string, message: string) {
    super(`Invalid timestamp for task ${taskId}: ${message}`);
    this.name = 'InvalidTaskTimestampError';
  }
}

export const NotificationErrorCode = {
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  TOKEN_REFRESH_FAILED: 'TOKEN_REFRESH_FAILED',
  DELIVERY_FAILED: 'DELIVERY_FAILED',
  DEEP_LINK_INVALID: 'DEEP_LINK_INVALID',
  CHANNEL_CREATION_FAILED: 'CHANNEL_CREATION_FAILED',
  SCHEDULING_FAILED: 'SCHEDULING_FAILED',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const;

export type NotificationErrorType =
  (typeof NotificationErrorCode)[keyof typeof NotificationErrorCode];

export type NotificationError = {
  type: NotificationErrorType;
  message: string;
  context?: Record<string, unknown>;
};
