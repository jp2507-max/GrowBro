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

export type BackoffOptions = {
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterFactor?: number;
};

/**
 * Calculate exponential backoff delay with jitter for retry logic
 * Jitter helps prevent thundering herd problem when multiple clients retry simultaneously
 *
 * @param retryCount - The current retry count (0-based)
 * @param options - Backoff configuration options
 * @returns The calculated delay with jitter in milliseconds
 *
 * Examples with jitter:
 * - retryCount = 0: ~1000ms ± 20% = 800-1200ms
 * - retryCount = 1: ~2000ms ± 20% = 1600-2400ms
 * - retryCount = 2: ~4000ms ± 20% = 3200-4800ms
 * - etc., up to maxDelayMs
 */
export function calculateBackoffDelayWithJitter(
  retryCount: number,
  options: BackoffOptions = {}
): number {
  if (!Number.isFinite(retryCount) || retryCount < 0) retryCount = 0;

  const {
    baseDelayMs = 1000, // align with calculateBackoffDelay
    maxDelayMs = 32000, // align with calculateBackoffDelay
    jitterFactor = 0.2,
  } = options;

  const exponentialDelay = Math.min(
    baseDelayMs * Math.pow(2, retryCount),
    maxDelayMs
  );

  // Apply jitter: delay ± (delay * jitterFactor)
  // Random value between -jitterFactor and +jitterFactor
  const jitterRange = exponentialDelay * jitterFactor;
  const jitter = (Math.random() * 2 - 1) * jitterRange;

  // Ensure result is positive and within bounds, round to avoid fractional delays
  const value = Math.max(0, Math.min(exponentialDelay + jitter, maxDelayMs));
  return Math.round(value);
}
