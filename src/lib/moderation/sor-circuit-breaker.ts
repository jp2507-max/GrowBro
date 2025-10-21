/**
 * Circuit Breaker for DSA Transparency Database Submissions
 *
 * Implements three-state circuit breaker pattern to prevent cascading failures:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failure threshold exceeded, requests fail fast
 * - HALF_OPEN: Testing if service recovered, limited requests allowed
 *
 * Requirements: 3.4, 6.4 (graceful degradation for DSA submissions)
 */

// ============================================================================
// Types
// ============================================================================

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening circuit
  successThreshold: number; // Number of successes in HALF_OPEN before closing
  timeout: number; // Milliseconds to wait before attempting HALF_OPEN
  resetTimeout: number; // Milliseconds to wait in OPEN state before HALF_OPEN
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: Date | null;
  lastStateChange: Date;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000, // 1 minute
  resetTimeout: 60000, // 1 minute
};

// ============================================================================
// Circuit Breaker Implementation
// ============================================================================

export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: Date | null = null;
  private lastStateChange: Date = new Date();
  private totalRequests: number = 0;
  private totalFailures: number = 0;
  private totalSuccesses: number = 0;
  private config: CircuitBreakerConfig;
  private stateChangeListeners: ((state: CircuitState) => void)[] = [];

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Execute operation with circuit breaker protection.
   *
   * @param operation - Async operation to execute
   * @returns Result of operation
   * @throws Error if circuit is OPEN or operation fails
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    // Check if circuit is open
    if (this.state === 'OPEN') {
      // Check if timeout has elapsed to attempt HALF_OPEN
      if (this.shouldAttemptReset()) {
        this.transitionTo('HALF_OPEN');
      } else {
        throw new Error(
          `Circuit breaker is OPEN. Service unavailable. Retry after ${this.getTimeUntilReset()}ms`
        );
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Record successful operation.
   */
  private onSuccess(): void {
    this.totalSuccesses++;
    this.failureCount = 0;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;

      // Check if we've had enough successes to close circuit
      if (this.successCount >= this.config.successThreshold) {
        this.transitionTo('CLOSED');
      }
    }
  }

  /**
   * Record failed operation.
   */
  private onFailure(): void {
    this.totalFailures++;
    this.failureCount++;
    this.lastFailureTime = new Date();

    if (this.state === 'HALF_OPEN') {
      // Any failure in HALF_OPEN immediately reopens circuit
      this.transitionTo('OPEN');
    } else if (this.state === 'CLOSED') {
      // Check if we've exceeded failure threshold
      if (this.failureCount >= this.config.failureThreshold) {
        this.transitionTo('OPEN');
      }
    }
  }

  /**
   * Transition to new circuit state.
   */
  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;
    this.lastStateChange = new Date();

    // Reset counters on state transition
    if (newState === 'CLOSED') {
      this.failureCount = 0;
      this.successCount = 0;
    } else if (newState === 'HALF_OPEN') {
      this.successCount = 0;
    }

    // Notify listeners
    this.notifyStateChange(newState);

    console.log(
      `Circuit breaker transition: ${oldState} -> ${newState} at ${this.lastStateChange.toISOString()}`
    );
  }

  /**
   * Check if enough time has passed to attempt reset.
   */
  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) {
      return true;
    }

    const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
    return timeSinceLastFailure >= this.config.resetTimeout;
  }

  /**
   * Get milliseconds until circuit can attempt reset.
   */
  private getTimeUntilReset(): number {
    if (!this.lastFailureTime) {
      return 0;
    }

    const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
    const remaining = this.config.resetTimeout - timeSinceLastFailure;

    return Math.max(0, remaining);
  }

  /**
   * Get current circuit breaker statistics.
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastStateChange: this.lastStateChange,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses,
    };
  }

  /**
   * Get current circuit state.
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Check if circuit is healthy (CLOSED).
   */
  isHealthy(): boolean {
    return this.state === 'CLOSED';
  }

  /**
   * Check if circuit is open (failing).
   */
  isOpen(): boolean {
    return this.state === 'OPEN';
  }

  /**
   * Manually reset circuit to CLOSED state.
   * Use with caution - only for administrative/testing purposes.
   */
  reset(): void {
    this.transitionTo('CLOSED');
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
  }

  /**
   * Manually open circuit.
   * Use for maintenance or forced degradation.
   */
  open(): void {
    this.transitionTo('OPEN');
  }

  /**
   * Register listener for state changes.
   */
  onStateChange(listener: (state: CircuitState) => void): void {
    this.stateChangeListeners.push(listener);
  }

  /**
   * Notify all listeners of state change.
   */
  private notifyStateChange(state: CircuitState): void {
    this.stateChangeListeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        console.error('Error in circuit breaker state change listener:', error);
      }
    });
  }

  /**
   * Get circuit breaker configuration.
   */
  getConfig(): CircuitBreakerConfig {
    return { ...this.config };
  }

  /**
   * Update circuit breaker configuration.
   */
  updateConfig(config: Partial<CircuitBreakerConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }
}

// Export singleton instance for DSA submissions
export const dsaCircuitBreaker = new CircuitBreaker();
