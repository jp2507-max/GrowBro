import type { AxiosError } from 'axios';

export type ErrorCategory =
  | 'network'
  | 'permission'
  | 'performance'
  | 'conflict'
  | 'rate_limit'
  | 'validation'
  | 'insufficient_stock'
  | 'batch_expired'
  | 'duplicate_lot'
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

function categorizeAxiosError(error: AxiosError): CategorizedError {
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

  if (status === 429) {
    return {
      category: 'rate_limit',
      isRetryable: true,
      message: 'Rate limit exceeded',
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

function categorizeInventoryError(error: object): CategorizedError | null {
  const code = (error as any).code;

  if (code === 'INSUFFICIENT_STOCK') {
    return {
      category: 'insufficient_stock',
      isRetryable: false,
      message: (error as any).message || 'Insufficient stock available',
    };
  }

  if (code === 'BATCH_EXPIRED') {
    return {
      category: 'batch_expired',
      isRetryable: false,
      message: (error as any).message || 'Batch has expired',
    };
  }

  if (code === 'DUPLICATE_LOT') {
    return {
      category: 'duplicate_lot',
      isRetryable: false,
      message: (error as any).message || 'Duplicate lot number',
    };
  }

  if (code === 'VALIDATION_ERROR') {
    return {
      category: 'validation',
      isRetryable: false,
      message: (error as any).message || 'Validation failed',
    };
  }

  return null;
}

export function categorizeError(error: unknown): CategorizedError {
  // Network layer
  if (isAxiosError(error)) {
    return categorizeAxiosError(error);
  }

  // Generic fallback
  const message = (error as any)?.message ?? 'Unknown error';

  // Check for inventory-specific error codes
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as any).code === 'string'
  ) {
    const inventoryError = categorizeInventoryError(error);
    if (inventoryError) return inventoryError;
  }

  return { category: 'unknown', isRetryable: false, message };
}

export function shouldRetry(error: unknown): boolean {
  const c = categorizeError(error);
  return c.isRetryable;
}
