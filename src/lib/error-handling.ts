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
    !!error &&
    typeof error === 'object' &&
    'isAxiosError' in error &&
    error.isAxiosError === true
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

type InventoryError = {
  code: string;
  message?: string;
};

function isInventoryError(error: unknown): error is InventoryError {
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
  );
}

function categorizeInventoryError(
  error: InventoryError
): CategorizedError | null {
  const { code, message } = error;

  if (code === 'INSUFFICIENT_STOCK') {
    return {
      category: 'insufficient_stock',
      isRetryable: false,
      message: message || 'Insufficient stock available',
    };
  }

  if (code === 'BATCH_EXPIRED') {
    return {
      category: 'batch_expired',
      isRetryable: false,
      message: message || 'Batch has expired',
    };
  }

  if (code === 'DUPLICATE_LOT') {
    return {
      category: 'duplicate_lot',
      isRetryable: false,
      message: message || 'Duplicate lot number',
    };
  }

  if (code === 'VALIDATION_ERROR') {
    return {
      category: 'validation',
      isRetryable: false,
      message: message || 'Validation failed',
    };
  }

  return null;
}

export function categorizeError(error: unknown): CategorizedError {
  // Network layer
  if (isAxiosError(error)) {
    return categorizeAxiosError(error);
  }

  // Check for inventory-specific error codes
  if (isInventoryError(error)) {
    const inventoryError = categorizeInventoryError(error);
    if (inventoryError) return inventoryError;
  }

  // Generic fallback
  const message =
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
      ? error.message
      : 'Unknown error';

  return { category: 'unknown', isRetryable: false, message };
}

export function shouldRetry(error: unknown): boolean {
  const c = categorizeError(error);
  return c.isRetryable;
}
