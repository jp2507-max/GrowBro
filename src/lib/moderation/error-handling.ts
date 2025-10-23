/**
 * Error Handling and Resilience - Main Export
 *
 * Comprehensive error handling system for moderation platform:
 * - Error classification and categorization
 * - Retry strategies with exponential backoff
 * - Circuit breaker patterns
 * - Graceful degradation for non-critical functions
 * - Manual fallback procedures for SLA-critical operations
 *
 * Requirements: 10.3, 10.4, 10.6
 */

export {
  type ClassifiedError,
  type ErrorCategory,
  ErrorClassifier,
  errorClassifier,
  type ErrorContext,
  type ErrorSeverity,
} from './error-classification';
export {
  type DegradationStrategy,
  type FeatureFlag,
  GracefulDegradationManager,
  gracefulDegradationManager,
  type ServiceHealth,
  type ServiceStatus,
} from './graceful-degradation';
export {
  type EscalationContact,
  type FallbackContext,
  type FallbackProcedure,
  type FallbackResult,
  ManualFallbackManager,
  manualFallbackManager,
} from './manual-fallback-procedures';
export {
  CONSERVATIVE_RETRY_CONFIG,
  conservativeRetryStrategy,
  CRITICAL_RETRY_CONFIG,
  criticalRetryStrategy,
  type RetryConfig,
  type RetryContext,
  type RetryResult,
  RetryStrategy,
  STANDARD_RETRY_CONFIG,
  standardRetryStrategy,
} from './retry-strategy';
export {
  CircuitBreaker,
  type CircuitBreakerConfig,
  type CircuitBreakerStats,
  type CircuitState,
  dsaCircuitBreaker,
} from './sor-circuit-breaker';

// ============================================================================
// Unified Error Handling Interface
// ============================================================================

/**
 * Execute operation with comprehensive error handling.
 *
 * Combines retry logic, circuit breaker, graceful degradation, and manual fallback.
 */
export async function executeWithResilience<T>(params: {
  operation: () => Promise<T>;
  operationName: string;
  retryConfig?: 'critical' | 'standard' | 'conservative';
  feature?: FeatureFlag;
  fallbackContext?: Partial<FallbackContext>;
  enableCircuitBreaker?: boolean;
}): Promise<T> {
  const {
    operation,
    operationName,
    retryConfig = 'standard',
    feature,
    fallbackContext,
    enableCircuitBreaker = false,
  } = params;

  // Select retry strategy
  const retryStrategy =
    retryConfig === 'critical'
      ? criticalRetryStrategy
      : retryConfig === 'conservative'
        ? conservativeRetryStrategy
        : standardRetryStrategy;

  // Wrap with graceful degradation if feature specified
  const wrappedOperation = feature
    ? () =>
        gracefulDegradationManager.executeWithDegradation(feature, operation)
    : operation;

  // Wrap with circuit breaker if enabled
  const finalOperation = enableCircuitBreaker
    ? () => dsaCircuitBreaker.execute(wrappedOperation)
    : wrappedOperation;

  // Execute with retry
  const result = await retryStrategy.execute(finalOperation, {
    operation: operationName,
  });

  // Check if manual fallback is needed
  if (!result.success && result.error && fallbackContext) {
    const shouldFallback = manualFallbackManager.shouldTriggerFallback(
      result.error,
      {
        ...fallbackContext,
        procedure: fallbackContext.procedure || 'illegal_content_escalation',
        priority: fallbackContext.priority || 'normal',
        slaDeadline: fallbackContext.slaDeadline || new Date(),
        reason: fallbackContext.reason || 'Operation failed after retries',
        attemptedActions: [`Attempted ${result.attempts} times`],
      } as FallbackContext
    );

    if (shouldFallback) {
      await manualFallbackManager.executeFallback({
        ...fallbackContext,
        procedure: fallbackContext.procedure || 'illegal_content_escalation',
        priority: fallbackContext.priority || 'normal',
        slaDeadline: fallbackContext.slaDeadline || new Date(),
        reason: fallbackContext.reason || 'Operation failed after retries',
        attemptedActions: [`Attempted ${result.attempts} times`],
        originalError: result.error,
      } as FallbackContext);
    }

    throw result.error;
  }

  if (!result.success || !result.result) {
    throw result.error || new Error('Operation failed');
  }

  return result.result;
}
