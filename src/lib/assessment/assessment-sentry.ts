import * as Sentry from '@sentry/react-native';

import type {
  AssessmentInferenceMode,
  AssessmentResult,
  ExecutionProvider,
  InferenceError,
} from '@/types/assessment';

/**
 * Assessment Sentry Integration
 * Adds breadcrumbs and captures errors for AI assessments (no PII)
 */

/**
 * Add breadcrumb for assessment creation
 */
export function addAssessmentCreatedBreadcrumb(options: {
  assessmentId: string;
  mode: AssessmentInferenceMode;
  photoCount: number;
}): void {
  Sentry.addBreadcrumb({
    category: 'assessment',
    message: 'Assessment created',
    level: 'info',
    data: {
      assessmentId: options.assessmentId,
      mode: options.mode,
      photoCount: options.photoCount,
    },
  });
}

/**
 * Add breadcrumb for successful inference
 */
export function addInferenceSuccessBreadcrumb(
  assessmentId: string,
  result: AssessmentResult
): void {
  Sentry.addBreadcrumb({
    category: 'inference',
    message: 'Inference completed',
    level: 'info',
    data: {
      assessmentId,
      mode: result.mode,
      latencyMs: result.processingTimeMs,
      modelVersion: result.modelVersion,
      provider: result.executionProvider,
      confidence: result.calibratedConfidence,
    },
  });
}

/**
 * Add breadcrumb and capture inference failure
 */
export function captureInferenceError(options: {
  assessmentId: string;
  error: InferenceError;
  mode: AssessmentInferenceMode;
  latencyMs?: number;
}): void {
  const { assessmentId, error, mode, latencyMs } = options;

  Sentry.addBreadcrumb({
    category: 'inference',
    message: 'Inference failed',
    level: 'error',
    data: {
      assessmentId,
      mode,
      errorCode: error.code,
      errorCategory: error.category,
      latencyMs,
    },
  });

  // Capture the error for tracking
  let exception: Error;
  if (error instanceof Error) {
    exception = error;
  } else {
    exception = new Error(`Inference failed: ${error.message || error.code}`, {
      cause: error,
    });
  }

  Sentry.captureException(exception, {
    level: 'error',
    tags: {
      assessment_id: assessmentId,
      error_code: error.code,
      error_category: error.category,
      inference_mode: mode,
    },
    extra: {
      errorMessage: error.message,
      retryable: error.retryable,
      fallbackToCloud: error.fallbackToCloud,
      latencyMs,
      originalError: error,
      ...(error instanceof Error && error.stack
        ? { originalStack: error.stack }
        : {}),
    },
  });
}

/**
 * Add breadcrumb for cloud fallback
 */
export function addCloudFallbackBreadcrumb(options: {
  assessmentId: string;
  reason: string;
  deviceLatencyMs: number;
}): void {
  Sentry.addBreadcrumb({
    category: 'inference',
    message: 'Fallback to cloud inference',
    level: 'warning',
    data: {
      assessmentId: options.assessmentId,
      reason: options.reason,
      deviceLatencyMs: options.deviceLatencyMs,
    },
  });
}

/**
 * Add breadcrumb for execution provider selection
 */
export function addExecutionProviderBreadcrumb(options: {
  assessmentId: string;
  provider: ExecutionProvider;
  availableProviders: ExecutionProvider[];
}): void {
  Sentry.addBreadcrumb({
    category: 'inference',
    message: 'Execution provider selected',
    level: 'info',
    data: {
      assessmentId: options.assessmentId,
      active: options.provider,
      available: options.availableProviders,
    },
  });
}

/**
 * Add breadcrumb for model loading
 */
export function addModelLoadBreadcrumb(options: {
  modelVersion: string;
  sizeBytes: number;
  durationMs: number;
}): void {
  Sentry.addBreadcrumb({
    category: 'model',
    message: 'Model loaded',
    level: 'info',
    data: {
      modelVersion: options.modelVersion,
      sizeMB: (options.sizeBytes / (1024 * 1024)).toFixed(2),
      durationMs: options.durationMs,
    },
  });
}

/**
 * Capture model checksum validation failure
 */
export function captureChecksumValidationError(options: {
  modelVersion: string;
  expectedChecksum: string;
  actualChecksum: string;
}): void {
  Sentry.captureMessage('Model checksum validation failed', {
    level: 'error',
    tags: {
      model_version: options.modelVersion,
    },
    extra: {
      expectedChecksum: options.expectedChecksum,
      actualChecksum: options.actualChecksum,
    },
  });
}

/**
 * Add breadcrumb for user action
 */
export function addUserActionBreadcrumb(options: {
  assessmentId: string;
  action: 'task_created' | 'playbook_adjustment' | 'community_cta_tapped';
}): void {
  Sentry.addBreadcrumb({
    category: 'user_action',
    message: `User action: ${options.action}`,
    level: 'info',
    data: {
      assessmentId: options.assessmentId,
      action: options.action,
    },
  });
}

/**
 * Add breadcrumb for feedback submission
 */
export function addFeedbackBreadcrumb(options: {
  assessmentId: string;
  helpful: boolean;
  issueResolved?: string;
}): void {
  Sentry.addBreadcrumb({
    category: 'feedback',
    message: 'Feedback submitted',
    level: 'info',
    data: {
      assessmentId: options.assessmentId,
      helpful: options.helpful,
      issueResolved: options.issueResolved,
    },
  });
}
