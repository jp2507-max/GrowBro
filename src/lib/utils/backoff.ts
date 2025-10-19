/**
 * Calculate exponential backoff delay for retry logic
 * @param retryCount - The current retry count (0-based)
 * @param baseDelayMs - Base delay in milliseconds (default: 1000ms = 1s)
 * @param maxDelayMs - Maximum delay in milliseconds (default: 32000ms = 32s)
 * @returns The calculated delay in milliseconds
 *
 * Examples:
 * - retryCount = 0: baseDelayMs * 2^0 = 1000ms (1s)
 * - retryCount = 1: baseDelayMs * 2^1 = 2000ms (2s)
 * - retryCount = 2: baseDelayMs * 2^2 = 4000ms (4s)
 * - etc., up to maxDelayMs
 */
export function calculateBackoffDelay(
  retryCount: number,
  baseDelayMs: number = 1000,
  maxDelayMs: number = 32000
): number {
  return Math.min(baseDelayMs * Math.pow(2, retryCount), maxDelayMs);
}
