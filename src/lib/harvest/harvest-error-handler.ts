/**
 * Harvest error handler service
 * Implements comprehensive error classification and handling
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5
 */

import { showMessage } from 'react-native-flash-message';

import type {
  BusinessLogicError,
  BusinessLogicErrorCode,
  ClassifiedError,
  ConsistencyError,
  ConsistencyErrorCode,
  ErrorHandlerResult,
  NetworkError,
  ServerErrorCode,
  SyncRejection,
  ValidationError,
} from './harvest-error-types';
import {
  BUSINESS_LOGIC_ERROR_CODES,
  BusinessLogicErrorClass,
  CONSISTENCY_ERROR_CODES,
  ConsistencyErrorClass,
  ERROR_CATEGORY,
  SERVER_ERROR_MAPPING,
} from './harvest-error-types';

/**
 * Classifies an unknown error into a category with metadata
 * Requirement 17.1, 17.2, 17.4: Error classification system
 */
export function classifyError(error: unknown): ClassifiedError {
  const timestamp = new Date();
  function createClassified(
    partial: Partial<ClassifiedError>
  ): ClassifiedError {
    return {
      category: partial.category ?? ERROR_CATEGORY.UNKNOWN,
      message: partial.message ?? extractErrorMessage(error),
      retryable: partial.retryable ?? false,
      originalError: error,
      timestamp,
      ...(partial.code ? { code: partial.code } : {}),
      ...(partial.action ? { action: partial.action } : {}),
    } as ClassifiedError;
  }

  // Network/HTTP errors (AxiosError-like)
  if (isNetworkError(error)) {
    const code = getErrorCode(error);
    const mapping = code ? SERVER_ERROR_MAPPING[code as ServerErrorCode] : null;

    if (mapping) {
      return createClassified({
        category: mapping.category,
        message: extractErrorMessage(error),
        retryable: mapping.retryable,
        action: mapping.action,
        code,
      });
    }

    return createClassified({
      category: ERROR_CATEGORY.NETWORK,
      retryable: isRetryableNetworkError(error),
      code,
    });
  }

  if (isValidationError(error))
    return createClassified({ category: ERROR_CATEGORY.VALIDATION });

  if (isBusinessLogicError(error))
    return createClassified({ category: ERROR_CATEGORY.BUSINESS_LOGIC });

  if (isConsistencyError(error))
    return createClassified({ category: ERROR_CATEGORY.CONSISTENCY });

  return createClassified({});
}

/**
 * Handles validation errors with inline messages
 * Requirement 17.1: Inline validation messages for form inputs
 */
export function handleValidationError(
  _error: ValidationError | ValidationError[]
): ErrorHandlerResult {
  return {
    shouldShowToast: false,
    shouldShowBanner: false,
    shouldShowInline: true,
  };
}

/**
 * Handles network/sync errors with toast notifications
 * Requirement 17.2: Toast notifications for transient sync errors
 */
export function handleNetworkError(
  error: NetworkError,
  t: (key: string, options?: Record<string, unknown>) => string
): ErrorHandlerResult {
  // Transient errors: show toast
  if (error.retryable) {
    showMessage({
      message: t('harvest.errors.sync.transient_title'),
      description: error.message,
      type: 'warning',
      duration: 3000,
    });

    return {
      shouldShowToast: true,
      shouldShowBanner: false,
      shouldShowInline: false,
      toastMessage: error.message,
    };
  }

  // Persistent errors: show banner with actions
  // Requirement 17.3: Persistent error banners with retry/details
  return {
    shouldShowToast: false,
    shouldShowBanner: true,
    shouldShowInline: false,
    bannerMessage: error.message,
    actions: getNetworkErrorActions(error, t),
  };
}

/**
 * Handles business logic errors with corrective actions
 */
export function handleBusinessLogicError(
  error: BusinessLogicError,
  t: (key: string, options?: Record<string, unknown>) => string
): ErrorHandlerResult {
  return {
    shouldShowToast: false,
    shouldShowBanner: true,
    shouldShowInline: false,
    bannerMessage: error.message,
    actions: getBusinessLogicActions(error, t),
  };
}

/**
 * Handles consistency/conflict errors
 */
export function handleConsistencyError(
  error: ConsistencyError,
  t: (key: string, options?: Record<string, unknown>) => string
): ErrorHandlerResult {
  return {
    shouldShowToast: false,
    shouldShowBanner: true,
    shouldShowInline: false,
    bannerMessage: t('harvest.errors.sync.conflict_detected'),
    actions: [
      {
        label: t('harvest.errors.actions.view_details'),
        action: 'view_details',
        onPress: () => {
          // Navigate to conflict resolution UI
          console.log('[Error] View conflict details', error);
        },
      },
    ],
  };
}

/**
 * Creates an audit note for server rejections
 * Requirement 17.5: Audit notes on server rejections
 */
export function createAuditNoteForRejection(rejection: SyncRejection): string {
  const { errorCode, errorMessage, timestamp, table, recordId } = rejection;
  return `Server rejection: [${errorCode}] ${errorMessage} | Table: ${table} | Record: ${recordId} | Time: ${timestamp.toISOString()}`;
}

/**
 * Type guards and helpers
 */

function isNetworkError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const hasResponse = 'response' in error;
    const hasAxiosFlag = 'isAxiosError' in error && error.isAxiosError === true;
    const hasNumericCode =
      'code' in error &&
      typeof (error as Record<string, unknown>).code === 'number';
    const hasNetworkMessage =
      error instanceof Error &&
      (error.message.includes('network') ||
        error.message.includes('fetch') ||
        error.message.includes('timeout') ||
        error.message.includes('connection'));

    return hasResponse || hasAxiosFlag || hasNumericCode || hasNetworkMessage;
  }
  return false;
}

function isValidationError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    return (
      ('name' in error && error.name === 'ZodError') ||
      'issues' in error ||
      (error instanceof Error && error.message.includes('validation'))
    );
  }
  return false;
}

function isBusinessLogicError(error: unknown): boolean {
  // Check for custom error class
  if (error instanceof BusinessLogicErrorClass) {
    return true;
  }

  // Check for error.code property matching defined constants
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as Record<string, unknown>).code;
    return (
      typeof code === 'string' &&
      Object.values(BUSINESS_LOGIC_ERROR_CODES).includes(
        code as BusinessLogicErrorCode
      )
    );
  }

  return false;
}

function isConsistencyError(error: unknown): boolean {
  // Check for custom error class
  if (error instanceof ConsistencyErrorClass) {
    return true;
  }

  // Check for error.code property matching defined constants
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as Record<string, unknown>).code;
    return (
      typeof code === 'string' &&
      Object.values(CONSISTENCY_ERROR_CODES).includes(
        code as ConsistencyErrorCode
      )
    );
  }

  return false;
}

function isRetryableNetworkError(error: unknown): boolean {
  const code = getErrorCode(error);
  if (code && code in SERVER_ERROR_MAPPING) {
    return SERVER_ERROR_MAPPING[code as ServerErrorCode].retryable;
  }

  // Default heuristics for retryable errors
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = String(error.message).toLowerCase();
    return (
      msg.includes('timeout') ||
      msg.includes('network') ||
      msg.includes('connection') ||
      msg.includes('econnrefused')
    );
  }
  return false;
}

function getErrorCode(error: unknown): number | undefined {
  if (error && typeof error === 'object') {
    if (
      'response' in error &&
      error.response &&
      typeof error.response === 'object'
    ) {
      if (
        'status' in error.response &&
        typeof error.response.status === 'number'
      ) {
        return error.response.status;
      }
    }
    if ('status' in error && typeof error.status === 'number') {
      return error.status;
    }
    if ('code' in error && typeof error.code === 'number') {
      return error.code;
    }
  }
  return undefined;
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object') {
    if ('message' in error && typeof error.message === 'string') {
      return error.message;
    }
    if (
      'response' in error &&
      error.response &&
      typeof error.response === 'object' &&
      'data' in error.response
    ) {
      const data = error.response.data;
      if (typeof data === 'string') return data;
      if (data && typeof data === 'object' && 'message' in data) {
        return String(data.message);
      }
    }
  }
  return 'An unknown error occurred';
}

/**
 * Get error actions based on error type
 * Requirement 17.3, 17.4: Retry and corrective actions
 */
function getNetworkErrorActions(
  error: NetworkError,
  t: (key: string) => string
): ErrorHandlerResult['actions'] {
  const actions: ErrorHandlerResult['actions'] = [];

  // Retry action for retryable errors
  if (error.retryable) {
    actions.push({
      label: t('harvest.errors.actions.retry_now'),
      action: 'retry',
      onPress: async () => {
        console.log('[Error] Retry action triggered');
      },
    });
  }

  // Re-auth action for 401
  if (error.code === 401) {
    actions.push({
      label: t('harvest.errors.actions.sign_in_again'),
      action: 're_auth',
      onPress: () => {
        console.log('[Error] Re-auth action triggered');
      },
    });
  }

  // View details action
  actions.push({
    label: t('harvest.errors.actions.view_details'),
    action: 'view_details',
    onPress: () => {
      console.log('[Error] View details', error);
    },
  });

  return actions;
}

function getBusinessLogicActions(
  error: BusinessLogicError,
  t: (key: string) => string
): ErrorHandlerResult['actions'] {
  const actions: ErrorHandlerResult['actions'] = [];

  // Missing dry weight
  if (error.message.includes('dry weight')) {
    actions.push({
      label: t('harvest.inventory.missing_dry_weight_cta'),
      action: 'update_weight',
      onPress: () => {
        console.log('[Error] Update weight action triggered');
      },
    });
  }

  // Generic dismiss
  actions.push({
    label: t('harvest.errors.actions.dismiss'),
    action: 'dismiss',
    onPress: () => {
      console.log('[Error] Dismiss action triggered');
    },
  });

  return actions;
}

/**
 * Main error handler that routes to specific handlers
 */
export function handleHarvestError(
  error: unknown,
  t: (key: string, options?: Record<string, unknown>) => string
): ErrorHandlerResult {
  const classified = classifyError(error);

  switch (classified.category) {
    case ERROR_CATEGORY.VALIDATION:
      return handleValidationError({
        field: 'general',
        message: classified.message,
      });

    case ERROR_CATEGORY.NETWORK:
      return handleNetworkError(classified as NetworkError, t);

    case ERROR_CATEGORY.BUSINESS_LOGIC:
      return handleBusinessLogicError(classified as BusinessLogicError, t);

    case ERROR_CATEGORY.CONSISTENCY:
      return handleConsistencyError(classified as ConsistencyError, t);

    default:
      return {
        shouldShowToast: true,
        shouldShowBanner: false,
        shouldShowInline: false,
        toastMessage: classified.message,
      };
  }
}
