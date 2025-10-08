/**
 * Error classification and types for harvest workflow
 * Implements Requirement 17: Comprehensive error handling with classification
 */

/**
 * Error categories for classification
 */
export const ERROR_CATEGORY = {
  VALIDATION: 'validation',
  NETWORK: 'network',
  BUSINESS_LOGIC: 'business_logic',
  CONSISTENCY: 'consistency',
  UNKNOWN: 'unknown',
} as const;

export type ErrorCategory =
  (typeof ERROR_CATEGORY)[keyof typeof ERROR_CATEGORY];

/**
 * Server error code mapping for standardized handling
 * Requirement 17.4: Map server error codes to actions
 */
export const SERVER_ERROR_MAPPING = {
  401: {
    action: 'RE_AUTH',
    category: ERROR_CATEGORY.NETWORK,
    retryable: false,
  },
  403: {
    action: 'PERMISSION_DENIED',
    category: ERROR_CATEGORY.BUSINESS_LOGIC,
    retryable: false,
  },
  413: {
    action: 'SPLIT_UPLOAD',
    category: ERROR_CATEGORY.NETWORK,
    retryable: true,
  },
  422: {
    action: 'VALIDATION_ERROR',
    category: ERROR_CATEGORY.VALIDATION,
    retryable: false,
  },
  500: { action: 'RETRY', category: ERROR_CATEGORY.NETWORK, retryable: true },
  503: { action: 'RETRY', category: ERROR_CATEGORY.NETWORK, retryable: true },
} as const;

export type ServerErrorCode = keyof typeof SERVER_ERROR_MAPPING;

/**
 * Classified error with metadata for handling
 */
export type ClassifiedError = {
  category: ErrorCategory;
  message: string;
  retryable: boolean;
  action?: string;
  code?: number | string;
  originalError?: unknown;
  timestamp: Date;
};

/**
 * Validation error for form inputs
 * Requirement 17.1: Inline validation messages
 */
export type ValidationError = {
  field: string;
  message: string;
  code?: string;
};

/**
 * Network/sync error with retry metadata
 * Requirement 17.2: Toast notifications for transient errors
 */
export type NetworkError = ClassifiedError & {
  category: typeof ERROR_CATEGORY.NETWORK;
  retryCount?: number;
  nextRetryAt?: Date;
};

/**
 * Business logic error with corrective actions
 */
export type BusinessLogicError = ClassifiedError & {
  category: typeof ERROR_CATEGORY.BUSINESS_LOGIC;
  correctiveActions?: string[];
};

/**
 * Data consistency error (conflicts)
 */
export type ConsistencyError = ClassifiedError & {
  category: typeof ERROR_CATEGORY.CONSISTENCY;
  conflictingFields?: string[];
  localValue?: unknown;
  remoteValue?: unknown;
};

/**
 * Error handler result with UI instructions
 */
export type ErrorHandlerResult = {
  shouldShowToast: boolean;
  shouldShowBanner: boolean;
  shouldShowInline: boolean;
  toastMessage?: string;
  bannerMessage?: string;
  actions?: ErrorAction[];
  auditNote?: string;
};

/**
 * Error action for user interaction
 * Requirement 17.3: Retry now and View details actions
 */
export type ErrorAction = {
  label: string;
  action: 'retry' | 'view_details' | 're_auth' | 'dismiss' | 'update_weight';
  onPress: () => void | Promise<void>;
};

/**
 * Sync error with audit trail support
 * Requirement 17.5: Audit notes on server rejections
 */
export type SyncRejection = {
  recordId: string;
  table: string;
  errorCode: number | string;
  errorMessage: string;
  timestamp: Date;
  serverResponse?: unknown;
};
