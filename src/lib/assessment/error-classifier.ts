/**
 * Error classification for assessment sync operations
 * Determines if errors are transient (retryable) or permanent
 */

export type ErrorCategory =
  | 'network'
  | 'auth'
  | 'validation'
  | 'server'
  | 'quota'
  | 'unknown';

export type ErrorClassification = {
  category: ErrorCategory;
  isTransient: boolean;
  shouldRetry: boolean;
  fallbackToCloud: boolean;
  userMessage: string;
};

/**
 * Classify an error to determine retry strategy
 */
export function classifyError(error: unknown): ErrorClassification {
  const errorMessage = getErrorMessage(error);
  const errorCode = getErrorCode(error);

  // Network errors - always transient and retryable
  if (isNetworkError(errorMessage, errorCode)) {
    return {
      category: 'network',
      isTransient: true,
      shouldRetry: true,
      fallbackToCloud: false,
      userMessage: 'Network connection issue. Will retry when online.',
    };
  }

  // Quota/rate limit errors - check before server errors (429 is both)
  if (isQuotaError(errorMessage, errorCode)) {
    return {
      category: 'quota',
      isTransient: true,
      shouldRetry: true,
      fallbackToCloud: false,
      userMessage: 'Service temporarily busy. Will retry shortly.',
    };
  }

  // Authentication errors - transient if token expired
  if (isAuthError(errorMessage, errorCode)) {
    return {
      category: 'auth',
      isTransient: true,
      shouldRetry: true,
      fallbackToCloud: false,
      userMessage: 'Authentication issue. Please sign in again.',
    };
  }

  // Validation errors - permanent, don't retry
  if (isValidationError(errorMessage, errorCode)) {
    return {
      category: 'validation',
      isTransient: false,
      shouldRetry: false,
      fallbackToCloud: false,
      userMessage: 'Invalid request data. Please try capturing again.',
    };
  }

  // Server errors - transient if 5xx, permanent if 4xx
  if (isServerError(errorMessage, errorCode)) {
    const is5xx = /5\d{2}/.test(errorCode);
    return {
      category: 'server',
      isTransient: is5xx,
      shouldRetry: is5xx,
      fallbackToCloud: false,
      userMessage: is5xx
        ? 'Server temporarily unavailable. Will retry shortly.'
        : 'Request failed. Please try again.',
    };
  }

  // Unknown errors - treat as transient with limited retries
  return {
    category: 'unknown',
    isTransient: true,
    shouldRetry: true,
    fallbackToCloud: false,
    userMessage: 'An error occurred. Will retry shortly.',
  };
}

/**
 * Check if error should trigger cloud fallback
 */
export function shouldFallbackToCloud(error: unknown): boolean {
  const errorMessage = getErrorMessage(error);

  // Device inference failures that should fallback to cloud
  const deviceFailurePatterns = [
    'out of memory',
    'oom',
    'model load failed',
    'inference timeout',
    'device inference failed',
    'execution provider failed',
  ];

  return deviceFailurePatterns.some((pattern) =>
    errorMessage.toLowerCase().includes(pattern)
  );
}

// Helper functions

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return String(error);
}

function getErrorCode(error: unknown): string {
  if (error && typeof error === 'object') {
    if ('code' in error) {
      return String(error.code);
    }
    if ('status' in error) {
      return String(error.status);
    }
    if ('statusCode' in error) {
      return String(error.statusCode);
    }
  }
  return '';
}

function isNetworkError(message: string, code: string): boolean {
  const networkPatterns = [
    'network',
    'timeout',
    'econnrefused',
    'enotfound',
    'offline',
    'no internet',
    'connection',
    'fetch failed',
  ];

  const networkCodes = [
    'ETIMEDOUT',
    'ECONNREFUSED',
    'ENOTFOUND',
    'ENETUNREACH',
  ];

  return (
    networkPatterns.some((pattern) =>
      message.toLowerCase().includes(pattern)
    ) || networkCodes.some((c) => code.toUpperCase().includes(c))
  );
}

function isAuthError(message: string, code: string): boolean {
  const authPatterns = [
    'unauthorized',
    'authentication',
    'token expired',
    'invalid token',
    'jwt',
  ];

  const authCodes = ['401', 'UNAUTHORIZED', 'AUTH_ERROR'];

  return (
    authPatterns.some((pattern) => message.toLowerCase().includes(pattern)) ||
    authCodes.some((c) => code.toUpperCase().includes(c))
  );
}

function isValidationError(message: string, code: string): boolean {
  const validationPatterns = [
    'validation',
    'invalid input',
    'bad request',
    'malformed',
    'missing required',
  ];

  const validationCodes = ['400', 'VALIDATION_ERROR', 'INVALID_INPUT'];

  return (
    validationPatterns.some((pattern) =>
      message.toLowerCase().includes(pattern)
    ) || validationCodes.some((c) => code.toUpperCase().includes(c))
  );
}

function isServerError(message: string, code: string): boolean {
  const serverPatterns = [
    'server error',
    'internal error',
    'service unavailable',
  ];

  // Match HTTP status codes 4xx and 5xx
  const statusCodeMatch = code.match(/^([45]\d{2})$/);

  return (
    serverPatterns.some((pattern) => message.toLowerCase().includes(pattern)) ||
    statusCodeMatch !== null
  );
}

function isQuotaError(message: string, code: string): boolean {
  const quotaPatterns = [
    'rate limit',
    'too many requests',
    'quota exceeded',
    'throttled',
  ];

  const quotaCodes = ['429', 'RATE_LIMIT', 'QUOTA_EXCEEDED'];

  return (
    quotaPatterns.some((pattern) => message.toLowerCase().includes(pattern)) ||
    quotaCodes.some((c) => code.toUpperCase().includes(c))
  );
}
