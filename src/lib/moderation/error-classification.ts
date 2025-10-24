/**
 * Error Classification System
 *
 * Centralized error classification for moderation system to determine:
 * - Permanent vs transient errors
 * - Retry eligibility
 * - Appropriate error handling strategies
 *
 * Requirements: 10.3, 10.4 (error handling and resilience)
 */

// ============================================================================
// Types
// ============================================================================

export type ErrorCategory =
  | 'permanent'
  | 'transient'
  | 'rate_limit'
  | 'timeout'
  | 'network'
  | 'validation'
  | 'authentication'
  | 'authorization'
  | 'not_found'
  | 'conflict'
  | 'server_error'
  | 'unknown';

export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface ClassifiedError {
  category: ErrorCategory;
  severity: ErrorSeverity;
  isRetryable: boolean;
  requiresManualIntervention: boolean;
  suggestedAction: string;
  originalError: Error;
  metadata?: Record<string, any>;
}

export interface ErrorContext {
  operation: string;
  attemptNumber?: number;
  maxAttempts?: number;
  userId?: string;
  contentId?: string;
  reportId?: string;
  [key: string]: any;
}

// ============================================================================
// Constants
// ============================================================================

const PERMANENT_HTTP_CODES = [400, 401, 403, 404, 409, 410, 422, 451];
const TRANSIENT_HTTP_CODES = [408, 429, 500, 502, 503, 504];
// const RATE_LIMIT_HTTP_CODES = [429]; // Reserved for future use

const PERMANENT_ERROR_PATTERNS = [
  /invalid.*data/i,
  /authentication.*failed/i,
  /insufficient.*permissions/i,
  /resource.*not.*found/i,
  /validation.*error/i,
  /malformed.*request/i,
  /invalid.*format/i,
  /schema.*violation/i,
];

const TRANSIENT_ERROR_PATTERNS = [
  /timeout/i,
  /connection.*refused/i,
  /network.*error/i,
  /temporary.*unavailable/i,
  /service.*unavailable/i,
  /too.*many.*requests/i,
  /rate.*limit/i,
];

// ============================================================================
// Error Classifier
// ============================================================================

export class ErrorClassifier {
  /**
   * Classify an error to determine handling strategy.
   */
  classify(error: Error, context?: ErrorContext): ClassifiedError {
    const httpStatus = this.extractHttpStatus(error);
    const errorMessage = error.message.toLowerCase();

    // Classify by HTTP status code
    if (httpStatus) {
      if (PERMANENT_HTTP_CODES.includes(httpStatus)) {
        return this.createClassification({
          error,
          category: this.classifyByHttpStatus(httpStatus),
          isRetryable: false,
          context,
        });
      }

      if (TRANSIENT_HTTP_CODES.includes(httpStatus)) {
        return this.createClassification({
          error,
          category: this.classifyByHttpStatus(httpStatus),
          isRetryable: true,
          context,
        });
      }
    }

    // Classify by error message patterns
    for (const pattern of PERMANENT_ERROR_PATTERNS) {
      if (pattern.test(errorMessage)) {
        return this.createClassification({
          error,
          category: this.classifyByPattern(pattern),
          isRetryable: false,
          context,
        });
      }
    }

    for (const pattern of TRANSIENT_ERROR_PATTERNS) {
      if (pattern.test(errorMessage)) {
        return this.createClassification({
          error,
          category: this.classifyByPattern(pattern),
          isRetryable: true,
          context,
        });
      }
    }

    // Default to transient for unknown errors (safer for retry)
    return this.createClassification({
      error,
      category: 'unknown',
      isRetryable: true,
      context,
    });
  }

  /**
   * Check if error is retryable.
   */
  isRetryable(error: Error): boolean {
    const classified = this.classify(error);
    return classified.isRetryable;
  }

  /**
   * Check if error is permanent.
   */
  isPermanent(error: Error): boolean {
    const classified = this.classify(error);
    return classified.category === 'permanent';
  }

  /**
   * Check if error requires manual intervention.
   */
  requiresManualIntervention(error: Error, context?: ErrorContext): boolean {
    const classified = this.classify(error, context);
    return classified.requiresManualIntervention;
  }

  /**
   * Get suggested action for error.
   */
  getSuggestedAction(error: Error, context?: ErrorContext): string {
    const classified = this.classify(error, context);
    return classified.suggestedAction;
  }

  // Private helper methods

  private extractHttpStatus(error: any): number | null {
    return error.status || error.statusCode || error.response?.status || null;
  }

  private classifyByHttpStatus(status: number): ErrorCategory {
    if (status === 400) return 'validation';
    if (status === 401) return 'authentication';
    if (status === 403) return 'authorization';
    if (status === 404) return 'not_found';
    if (status === 408) return 'timeout';
    if (status === 409) return 'conflict';
    if (status === 429) return 'rate_limit';
    if (status >= 500) return 'server_error';
    return 'unknown';
  }

  private classifyByPattern(pattern: RegExp): ErrorCategory {
    const patternStr = pattern.toString().toLowerCase();

    if (patternStr.includes('timeout')) return 'timeout';
    if (patternStr.includes('network')) return 'network';
    if (patternStr.includes('rate')) return 'rate_limit';
    if (patternStr.includes('validation')) return 'validation';
    if (patternStr.includes('authentication')) return 'authentication';
    if (patternStr.includes('permission')) return 'authorization';

    return 'unknown';
  }

  private createClassification(params: {
    error: Error;
    category: ErrorCategory;
    isRetryable: boolean;
    context?: ErrorContext;
  }): ClassifiedError {
    const { error, category, isRetryable, context } = params;
    const severity = this.determineSeverity(category, context);
    const requiresManualIntervention = this.determineManualIntervention(
      category,
      severity,
      context
    );
    const suggestedAction = this.determineSuggestedAction(
      category,
      isRetryable,
      context
    );

    return {
      category,
      severity,
      isRetryable,
      requiresManualIntervention,
      suggestedAction,
      originalError: error,
      metadata: context,
    };
  }

  private determineSeverity(
    category: ErrorCategory,
    context?: ErrorContext
  ): ErrorSeverity {
    // Critical errors that affect SLA-critical operations
    if (
      context?.operation?.includes('sla_critical') ||
      context?.operation?.includes('illegal_content')
    ) {
      return 'critical';
    }

    // High severity for authentication/authorization issues
    if (category === 'authentication' || category === 'authorization') {
      return 'high';
    }

    // Medium severity for validation and not found errors
    if (category === 'validation' || category === 'not_found') {
      return 'medium';
    }

    // Low severity for transient errors
    if (category === 'transient' || category === 'rate_limit') {
      return 'low';
    }

    return 'medium';
  }

  private determineManualIntervention(
    category: ErrorCategory,
    severity: ErrorSeverity,
    context?: ErrorContext
  ): boolean {
    // Always require manual intervention for critical errors
    if (severity === 'critical') {
      return true;
    }

    // Require manual intervention if max attempts exceeded
    if (
      context?.attemptNumber &&
      context?.maxAttempts &&
      context.attemptNumber >= context.maxAttempts
    ) {
      return true;
    }

    // Require manual intervention for permanent errors
    if (category === 'permanent') {
      return true;
    }

    // Require manual intervention for authentication/authorization issues
    if (category === 'authentication' || category === 'authorization') {
      return true;
    }

    return false;
  }

  private determineSuggestedAction(
    category: ErrorCategory,
    isRetryable: boolean,
    context?: ErrorContext
  ): string {
    if (category === 'rate_limit') {
      return 'Wait for rate limit reset and retry with exponential backoff';
    }

    if (category === 'timeout') {
      return 'Retry with increased timeout or check network connectivity';
    }

    if (category === 'authentication') {
      return 'Verify credentials and re-authenticate';
    }

    if (category === 'authorization') {
      return 'Check user permissions and role assignments';
    }

    if (category === 'validation') {
      return 'Review input data and correct validation errors';
    }

    if (category === 'not_found') {
      return 'Verify resource exists and check identifiers';
    }

    if (isRetryable) {
      return 'Retry operation with exponential backoff';
    }

    if (context?.operation?.includes('sla_critical')) {
      return 'Escalate to manual fallback procedure immediately';
    }

    return 'Log error and notify operations team';
  }
}

// Export singleton instance
export const errorClassifier = new ErrorClassifier();
