import type {
  AssessmentResult,
  AssessmentTelemetryEvent,
  ExecutionProvider,
  InferenceError,
} from '@/types/assessment';

/**
 * Inference Telemetry
 * Logs privacy-safe metrics for ML inference performance monitoring
 */

/**
 * Log successful inference event
 */
export function logInferenceSuccess(
  assessmentId: string,
  result: AssessmentResult
): void {
  const event: AssessmentTelemetryEvent = {
    assessmentId,
    inferenceMode: result.mode,
    latencyMs: result.processingTimeMs,
    modelVersion: result.modelVersion,
    calibratedConfidence: result.calibratedConfidence,
    rawConfidence: result.rawConfidence,
    provider: result.executionProvider,
    timestamp: Date.now(),
  };

  // Log to console for now
  // TODO: Send to analytics service (respecting user privacy preferences)
  console.log('[InferenceTelemetry] Success:', {
    assessmentId: event.assessmentId,
    mode: event.inferenceMode,
    latencyMs: event.latencyMs,
    provider: event.provider,
    confidence: event.calibratedConfidence,
  });

  // TODO: Add Sentry breadcrumb (no PII)
  // Sentry.addBreadcrumb({
  //   category: 'inference',
  //   message: 'Inference completed',
  //   level: 'info',
  //   data: {
  //     assessmentId: event.assessmentId,
  //     mode: event.inferenceMode,
  //     latencyMs: event.latencyMs,
  //     provider: event.provider,
  //   },
  // });
}

/**
 * Log inference failure event
 */
export function logInferenceFailure(options: {
  assessmentId: string;
  error: InferenceError;
  mode: 'device' | 'cloud';
  latencyMs?: number;
}): void {
  const { assessmentId, error, mode, latencyMs } = options;

  const event: AssessmentTelemetryEvent = {
    assessmentId,
    inferenceMode: mode,
    latencyMs,
    modelVersion: 'unknown',
    timestamp: Date.now(),
    errors: [error.code],
  };

  console.error('[InferenceTelemetry] Failure:', {
    assessmentId: event.assessmentId,
    mode: event.inferenceMode,
    latencyMs: event.latencyMs,
    errorCode: error.code,
    errorCategory: error.category,
  });

  // TODO: Add Sentry breadcrumb and capture exception
  // Sentry.addBreadcrumb({
  //   category: 'inference',
  //   message: 'Inference failed',
  //   level: 'error',
  //   data: {
  //     assessmentId: event.assessmentId,
  //     mode: event.inferenceMode,
  //     errorCode: error.code,
  //     errorCategory: error.category,
  //   },
  // });
  // Sentry.captureException(error);
}

/**
 * Log cloud fallback event
 */
export function logCloudFallback(
  assessmentId: string,
  reason: string,
  deviceLatencyMs: number
): void {
  console.log('[InferenceTelemetry] Cloud fallback:', {
    assessmentId,
    reason,
    deviceLatencyMs,
  });

  // TODO: Add Sentry breadcrumb
  // Sentry.addBreadcrumb({
  //   category: 'inference',
  //   message: 'Fallback to cloud inference',
  //   level: 'warning',
  //   data: {
  //     assessmentId,
  //     reason,
  //     deviceLatencyMs,
  //   },
  // });
}

/**
 * Log execution provider selection
 */
export function logExecutionProvider(
  assessmentId: string,
  provider: ExecutionProvider,
  availableProviders: ExecutionProvider[]
): void {
  console.log('[InferenceTelemetry] Execution provider:', {
    assessmentId,
    active: provider,
    available: availableProviders,
  });

  // TODO: Add to analytics
}

/**
 * Log model warm-up event
 */
export function logModelWarmup(
  modelVersion: string,
  durationMs: number,
  iterations: number
): void {
  console.log('[InferenceTelemetry] Model warmup:', {
    modelVersion,
    durationMs,
    iterations,
  });
}

/**
 * Log model loading event
 */
export function logModelLoad(
  modelVersion: string,
  sizeBytes: number,
  durationMs: number
): void {
  console.log('[InferenceTelemetry] Model loaded:', {
    modelVersion,
    sizeMB: (sizeBytes / (1024 * 1024)).toFixed(2),
    durationMs,
  });
}

/**
 * Log model checksum validation
 */
export function logChecksumValidation(options: {
  modelVersion: string;
  valid: boolean;
  expectedChecksum?: string;
  actualChecksum?: string;
}): void {
  const { modelVersion, valid, expectedChecksum, actualChecksum } = options;

  if (valid) {
    console.log('[InferenceTelemetry] Checksum validation passed:', {
      modelVersion,
    });
  } else {
    console.error('[InferenceTelemetry] Checksum validation failed:', {
      modelVersion,
      expected: expectedChecksum,
      actual: actualChecksum,
    });

    // TODO: Alert on checksum mismatch - potential security issue
    // Sentry.captureMessage('Model checksum validation failed', {
    //   level: 'error',
    //   extra: { modelVersion, expectedChecksum, actualChecksum },
    // });
  }
}

/**
 * Log cloud inference request event
 */
export function logCloudInferenceRequest(options: {
  assessmentId: string;
  photoCount: number;
  idempotencyKey: string;
}): void {
  const { assessmentId, photoCount, idempotencyKey } = options;

  console.log('[InferenceTelemetry] Cloud inference request:', {
    assessmentId,
    photoCount,
    idempotencyKey,
  });
}

/**
 * Log image upload event
 */
export function logImageUpload(options: {
  assessmentId: string;
  photoId: string;
  sizeBytes: number;
  durationMs: number;
  success: boolean;
}): void {
  const { assessmentId, photoId, sizeBytes, durationMs, success } = options;

  if (success) {
    console.log('[InferenceTelemetry] Image uploaded:', {
      assessmentId,
      photoId,
      sizeMB: (sizeBytes / (1024 * 1024)).toFixed(2),
      durationMs,
    });
  } else {
    console.error('[InferenceTelemetry] Image upload failed:', {
      assessmentId,
      photoId,
      durationMs,
    });
  }
}

/**
 * Log idempotency cache hit
 */
export function logIdempotencyCacheHit(options: {
  assessmentId: string;
  idempotencyKey: string;
}): void {
  const { assessmentId, idempotencyKey } = options;

  console.log('[InferenceTelemetry] Idempotency cache hit:', {
    assessmentId,
    idempotencyKey,
  });
}

/**
 * Log cloud inference timeout
 */
export function logCloudInferenceTimeout(options: {
  assessmentId: string;
  timeoutMs: number;
}): void {
  const { assessmentId, timeoutMs } = options;

  console.error('[InferenceTelemetry] Cloud inference timeout:', {
    assessmentId,
    timeoutMs,
  });
}

/**
 * Get telemetry summary for assessment
 */
export function getTelemetrySummary(result: AssessmentResult): {
  mode: string;
  latencyMs: number;
  provider?: string;
  confidence: number;
  photosProcessed: number;
} {
  return {
    mode: result.mode,
    latencyMs: result.processingTimeMs,
    provider: result.executionProvider,
    confidence: result.calibratedConfidence,
    photosProcessed: result.perImage.length,
  };
}
