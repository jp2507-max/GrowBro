/**
 * Custom error for invalid task timestamp scenarios
 */
export class InvalidTaskTimestampError extends Error {
  constructor(taskId: string, message: string) {
    super(`Invalid timestamp for task ${taskId}: ${message}`);
    this.name = 'InvalidTaskTimestampError';
  }
}
