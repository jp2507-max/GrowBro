import type { AxiosError } from 'axios';

export type ErrorCategory =
  | 'network'
  | 'permission'
  | 'performance'
  | 'conflict'
  | 'unknown';

export type CategorizedError = {
  category: ErrorCategory;
  isRetryable: boolean;
  message: string;
  statusCode?: number;
};

function isAxiosError(error: unknown): error is AxiosError {
  return (
    !!error && typeof error === 'object' && (error as any).isAxiosError === true
  );
}

export function categorizeError(error: unknown): CategorizedError {
  // Network layer
  if (isAxiosError(error)) {
    const status = error.response?.status;
    const isNetwork = !error.response;
    if (isNetwork) {
      return {
        category: 'network',
        isRetryable: true,
        message: 'Network error',
      };
    }
    if (status === 401 || status === 403) {
      return {
        category: 'permission',
        isRetryable: false,
        message: 'Permission denied',
        statusCode: status,
      };
    }
    if (status === 409) {
      return {
        category: 'conflict',
        isRetryable: false,
        message: 'Conflict detected',
        statusCode: status,
      };
    }
    if (status && status >= 500) {
      return {
        category: 'network',
        isRetryable: true,
        message: `Server error (${status})`,
        statusCode: status,
      };
    }
    return {
      category: 'unknown',
      isRetryable: false,
      message: error.message ?? 'Request failed',
      statusCode: status,
    };
  }

  // Generic fallback
  const message = (error as any)?.message ?? 'Unknown error';
  return { category: 'unknown', isRetryable: false, message };
}

export function shouldRetry(error: unknown): boolean {
  const c = categorizeError(error);
  return c.isRetryable;
}
