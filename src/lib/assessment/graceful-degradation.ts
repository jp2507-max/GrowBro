/**
 * Graceful Degradation Handlers
 *
 * Handles failure scenarios with intelligent fallbacks:
 * - Out of memory (OOM) → Cloud fallback
 * - Network errors → Offline queue with idempotency
 * - Model loading failures → Retry with backoff
 * - Timeout errors → Cloud fallback
 *
 * Requirements:
 * - 10.4: Gracefully degrade on low memory, handle network errors with idempotency
 * - 10.5: Release resources on app background
 */

import { calculateBackoffDelayWithJitter } from '@/lib/utils/backoff';
import type { InferenceError } from '@/types/assessment';

export type DegradationStrategy =
  | 'cloud-fallback'
  | 'offline-queue'
  | 'retry'
  | 'fail';

export type DegradationDecision = {
  strategy: DegradationStrategy;
  reason: string;
  userMessage: string;
  retryable: boolean;
  fallbackToCloud: boolean;
};

/**
 * Determine degradation strategy based on error type
 */
export function determineDegradationStrategy(
  error: InferenceError | Error
): DegradationDecision {
  // Handle InferenceError with category
  if ('category' in error && 'retryable' in error) {
    return handleInferenceError(error as InferenceError);
  }

  // Handle generic Error
  return handleGenericError(error);
}

function handleInferenceError(error: InferenceError): DegradationDecision {
  switch (error.category) {
    case 'memory':
      return {
        strategy: 'cloud-fallback',
        reason: 'Out of memory during device inference',
        userMessage:
          'Processing on server due to device memory constraints. This may take a few moments.',
        retryable: false,
        fallbackToCloud: true,
      };

    case 'timeout':
      return {
        strategy: 'cloud-fallback',
        reason: 'Device inference exceeded deadline',
        userMessage:
          'Device processing took too long. Switching to server processing.',
        retryable: false,
        fallbackToCloud: true,
      };

    case 'network':
      return {
        strategy: 'offline-queue',
        reason: 'Network unavailable',
        userMessage:
          'No internet connection. Your request will be processed when connectivity is restored.',
        retryable: true,
        fallbackToCloud: false,
      };

    case 'model':
      if (error.retryable) {
        return {
          strategy: 'retry',
          reason: 'Model loading failed, retrying',
          userMessage: 'Preparing model, please wait...',
          retryable: true,
          fallbackToCloud: false,
        };
      }
      return {
        strategy: 'cloud-fallback',
        reason: 'Model loading failed permanently',
        userMessage: 'Unable to load device model. Using server processing.',
        retryable: false,
        fallbackToCloud: true,
      };

    case 'validation':
      return {
        strategy: 'fail',
        reason: 'Validation error',
        userMessage:
          'Unable to process your request. Please check the images and try again.',
        retryable: false,
        fallbackToCloud: false,
      };

    default:
      return {
        strategy: 'cloud-fallback',
        reason: 'Unknown error',
        userMessage: 'An error occurred. Trying server processing.',
        retryable: false,
        fallbackToCloud: true,
      };
  }
}

function handleGenericError(error: Error): DegradationDecision {
  const message = error.message.toLowerCase();

  // Detect OOM errors
  if (
    message.includes('out of memory') ||
    message.includes('oom') ||
    message.includes('memory allocation')
  ) {
    return {
      strategy: 'cloud-fallback',
      reason: 'Out of memory error detected',
      userMessage:
        'Processing on server due to device memory constraints. This may take a few moments.',
      retryable: false,
      fallbackToCloud: true,
    };
  }

  // Detect network errors
  if (
    message.includes('network') ||
    message.includes('connection') ||
    message.includes('offline')
  ) {
    return {
      strategy: 'offline-queue',
      reason: 'Network error detected',
      userMessage:
        'No internet connection. Your request will be processed when connectivity is restored.',
      retryable: true,
      fallbackToCloud: false,
    };
  }

  // Detect timeout errors
  if (message.includes('timeout') || message.includes('deadline')) {
    return {
      strategy: 'cloud-fallback',
      reason: 'Timeout error detected',
      userMessage:
        'Device processing took too long. Switching to server processing.',
      retryable: false,
      fallbackToCloud: true,
    };
  }

  // Default to cloud fallback for unknown errors
  return {
    strategy: 'cloud-fallback',
    reason: `Unknown error: ${error.message}`,
    userMessage: 'An error occurred. Trying server processing.',
    retryable: false,
    fallbackToCloud: true,
  };
}

/**
 * Check if device has sufficient memory for inference
 */
export function checkMemoryAvailability(): {
  available: boolean;
  reason?: string;
} {
  // Platform-specific memory checks would go here
  // For now, this is a placeholder that always returns true

  // In production, this would check:
  // - Available RAM
  // - Memory pressure warnings from OS
  // - Previous OOM history

  return {
    available: true,
  };
}

/**
 * Estimate memory required for model inference
 */
export function estimateMemoryRequirement(modelSizeMB: number): number {
  // Rule of thumb: model size + 2x for inference buffers
  // EfficientNet-Lite0 (~5MB) needs ~15MB total
  // MobileNetV3-Small (~3MB) needs ~9MB total
  return modelSizeMB * 3;
}

/**
 * Check if device can handle inference given current memory state
 */
export function canHandleInference(modelSizeMB: number): {
  canHandle: boolean;
  reason?: string;
  estimatedMemoryMB: number;
} {
  const { available, reason } = checkMemoryAvailability();
  const estimatedMemoryMB = estimateMemoryRequirement(modelSizeMB);

  if (!available) {
    return {
      canHandle: false,
      reason: reason || 'Insufficient memory',
      estimatedMemoryMB,
    };
  }

  // Additional checks could include:
  // - Device tier (low-end devices get cloud fallback)
  // - Battery level (low battery → cloud to save power)
  // - Thermal state (overheating → cloud to reduce load)

  return {
    canHandle: true,
    estimatedMemoryMB,
  };
}

/**
 * Create a retryable error with exponential backoff metadata
 */
export function createRetryableError(
  originalError: Error,
  retryCount: number,
  maxRetries: number = 3
): InferenceError {
  const baseDelayMs = 1000;
  const nextRetryDelayMs = Math.min(
    baseDelayMs * Math.pow(2, retryCount),
    10000
  );

  return {
    code: 'RETRYABLE_ERROR',
    message: originalError.message,
    category: 'model',
    retryable: retryCount < maxRetries,
    details: {
      retryCount,
      maxRetries,
      nextRetryDelayMs,
      originalError: originalError.message,
    },
  };
}

/**
 * Apply exponential backoff with jitter (±25%)
 */
export function calculateBackoffDelay(
  retryCount: number,
  baseDelayMs: number = 1000,
  maxDelayMs: number = 10000
): number {
  return calculateBackoffDelayWithJitter(retryCount, {
    baseDelayMs,
    maxDelayMs,
    jitterFactor: 0.25,
  });
}

/**
 * Wait for specified delay (useful for retry logic)
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
