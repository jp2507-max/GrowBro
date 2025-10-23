/**
 * Retry Strategy with Exponential Backoff
 *
 * Implements configurable retry mechanisms with:
 * - Exponential backoff with jitter
 * - Maximum retry attempts
 * - Timeout handling
 * - Error classification integration
 *
 * Requirements: 10.3, 10.4 (retry mechanisms with exponential backoff)
 */

import { errorClassifier, type ErrorContext } from './error-classification';

// ============================================================================
// Types
// ============================================================================

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  timeoutMs?: number;
  jitterFactor: number; // 0-1, amount of randomness to add
  backoffMultiplier: number;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalDurationMs: number;
}

export interface RetryContext extends ErrorContext {
  startTime: number;
  lastAttemptTime: number;
  delays: number[];
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  timeoutMs: 60000,
  jitterFactor: 0.1,
  backoffMultiplier: 2,
};

// ============================================================================
// Retry Strategy
// ============================================================================

export class RetryStrategy {
  private config: RetryConfig;

  constructor(config?: Partial<RetryConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Execute operation with retry logic.
   *
   * @param operation - Async operation to execute
   * @param context - Context for error classification
   * @returns Result with success status and data or error
   */
  async execute<T>(
    operation: () => Promise<T>,
    context?: ErrorContext
  ): Promise<RetryResult<T>> {
    const retryContext: RetryContext = {
      ...context,
      startTime: Date.now(),
      lastAttemptTime: Date.now(),
      delays: [],
      operation: context?.operation || 'unknown',
    };

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.config.maxAttempts; attempt++) {
      try {
        // Add timeout wrapper if configured
        const result = this.config.timeoutMs
          ? await this.withTimeout(operation(), this.config.timeoutMs)
          : await operation();

        return {
          success: true,
          result,
          attempts: attempt,
          totalDurationMs: Date.now() - retryContext.startTime,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Classify error to determine if retry is appropriate
        const classified = errorClassifier.classify(lastError, {
          ...retryContext,
          attemptNumber: attempt,
          maxAttempts: this.config.maxAttempts,
        });

        // Don't retry if error is not retryable
        if (!classified.isRetryable) {
          return {
            success: false,
            error: lastError,
            attempts: attempt,
            totalDurationMs: Date.now() - retryContext.startTime,
          };
        }

        // Don't retry if this was the last attempt
        if (attempt === this.config.maxAttempts) {
          return {
            success: false,
            error: lastError,
            attempts: attempt,
            totalDurationMs: Date.now() - retryContext.startTime,
          };
        }

        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt, classified.category);
        retryContext.delays.push(delay);

        // Log retry attempt
        console.warn(
          `Retry attempt ${attempt}/${this.config.maxAttempts} after ${delay}ms delay. Error: ${lastError.message}`
        );

        // Wait before next attempt
        await this.sleep(delay);
        retryContext.lastAttemptTime = Date.now();
      }
    }

    // All attempts exhausted
    return {
      success: false,
      error: lastError,
      attempts: this.config.maxAttempts,
      totalDurationMs: Date.now() - retryContext.startTime,
    };
  }

  /**
   * Calculate delay for next retry attempt with exponential backoff and jitter.
   */
  private calculateDelay(attempt: number, errorCategory?: string): number {
    // Base exponential backoff
    let delay =
      this.config.baseDelayMs *
      Math.pow(this.config.backoffMultiplier, attempt - 1);

    // Apply category-specific adjustments
    if (errorCategory === 'rate_limit') {
      // Longer delays for rate limiting
      delay *= 2;
    } else if (errorCategory === 'timeout') {
      // Shorter delays for timeouts
      delay *= 0.5;
    }

    // Cap at maximum delay
    delay = Math.min(delay, this.config.maxDelayMs);

    // Add jitter to prevent thundering herd
    const jitter = delay * this.config.jitterFactor * (Math.random() - 0.5);
    delay += jitter;

    return Math.floor(delay);
  }

  /**
   * Wrap operation with timeout.
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Operation timed out after ${timeoutMs}ms`)),
          timeoutMs
        )
      ),
    ]);
  }

  /**
   * Sleep for specified milliseconds.
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get current configuration.
   */
  getConfig(): RetryConfig {
    return { ...this.config };
  }

  /**
   * Update configuration.
   */
  updateConfig(config: Partial<RetryConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

// ============================================================================
// Preset Configurations
// ============================================================================

/**
 * Aggressive retry for critical operations (SLA-bound).
 */
export const CRITICAL_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  baseDelayMs: 500,
  maxDelayMs: 10000,
  timeoutMs: 30000,
  jitterFactor: 0.1,
  backoffMultiplier: 1.5,
};

/**
 * Standard retry for normal operations.
 */
export const STANDARD_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  timeoutMs: 60000,
  jitterFactor: 0.1,
  backoffMultiplier: 2,
};

/**
 * Conservative retry for non-critical operations.
 */
export const CONSERVATIVE_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 2,
  baseDelayMs: 2000,
  maxDelayMs: 60000,
  timeoutMs: 120000,
  jitterFactor: 0.2,
  backoffMultiplier: 3,
};

// Export singleton instances
export const criticalRetryStrategy = new RetryStrategy(CRITICAL_RETRY_CONFIG);
export const standardRetryStrategy = new RetryStrategy(STANDARD_RETRY_CONFIG);
export const conservativeRetryStrategy = new RetryStrategy(
  CONSERVATIVE_RETRY_CONFIG
);
