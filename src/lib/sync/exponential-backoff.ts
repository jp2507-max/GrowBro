/**
 * Exponential Backoff Utility
 * Calculates retry delays with exponential backoff and jitter
 */

type BackoffConfig = {
  baseDelayMs: number;
  maxDelayMs: number;
  jitterFactor?: number; // 0-1, adds randomness to prevent thundering herd
};

/**
 * Calculate exponential backoff delay for retry attempt
 *
 * @param attempt - Retry attempt number (0-indexed)
 * @param config - Backoff configuration
 * @returns Delay in milliseconds before next retry
 */
export function calculateBackoffDelay(
  attempt: number,
  config: BackoffConfig
): number {
  const { baseDelayMs, maxDelayMs, jitterFactor = 0.1 } = config;

  // Exponential: baseDelay * 2^attempt
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);

  // Cap at maxDelay
  const cappedDelay = Math.min(exponentialDelay, maxDelayMs);

  // Add jitter: ±jitterFactor
  const jitter = cappedDelay * jitterFactor * (Math.random() * 2 - 1);

  return Math.max(0, cappedDelay + jitter);
}

/**
 * Sleep for specified milliseconds
 *
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after delay
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 *
 * @param fn - Async function to retry
 * @param config - Backoff configuration with maxRetries
 * @param onRetry - Optional callback on each retry
 * @returns Result from successful function call
 * @throws Last error if all retries exhausted
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: BackoffConfig & { maxRetries: number },
  onRetry?: (attempt: number, error: Error) => void
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry after last attempt
      if (attempt === config.maxRetries) {
        break;
      }

      // Call retry callback if provided
      onRetry?.(attempt, lastError);

      // Wait before next retry
      const delay = calculateBackoffDelay(attempt, config);
      await sleep(delay);
    }
  }

  throw lastError!;
}
