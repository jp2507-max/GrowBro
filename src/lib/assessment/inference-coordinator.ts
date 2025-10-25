import type {
  AssessmentPlantContext,
  AssessmentResult,
  CapturedPhoto,
  InferenceError,
  InferenceOptions,
} from '@/types/assessment';

import { getCloudInferenceClient } from './cloud-inference-client';
import { getInferenceEngine } from './inference-engine';
import { MODEL_CONFIG } from './model-config';

/**
 * Inference Coordinator
 * Orchestrates device vs cloud inference with deadline tracking and fallback logic
 */

export type InferenceMode = 'device' | 'cloud' | 'auto';

export type InferenceCoordinatorOptions = {
  mode?: InferenceMode;
  deadlineMs?: number;
  enableCloudFallback?: boolean;
  idempotencyKey?: string;
  plantContext?: AssessmentPlantContext;
  assessmentId?: string;
  modelVersion?: string;
};

/**
 * Run inference with deadline budget and cloud fallback
 */
export async function runInference(
  photos: CapturedPhoto[],
  options?: InferenceCoordinatorOptions
): Promise<AssessmentResult> {
  const mode = options?.mode || 'auto';
  const deadlineMs =
    options?.deadlineMs || MODEL_CONFIG.DEVICE_INFERENCE_DEADLINE_MS;
  const enableCloudFallback = options?.enableCloudFallback ?? true;

  const startTime = Date.now();

  try {
    // Auto mode: try device first, fallback to cloud on failure
    if (mode === 'auto' || mode === 'device') {
      try {
        return await runDeviceInference(photos, {
          deadlineMs,
          fallbackToCloud: enableCloudFallback,
        });
      } catch (error) {
        const inferenceError = error as InferenceError;

        // Check if we should fallback to cloud
        if (
          enableCloudFallback &&
          mode === 'auto' &&
          inferenceError.fallbackToCloud
        ) {
          const elapsedMs = Date.now() - startTime;
          const remainingMs = MODEL_CONFIG.HARD_TIMEOUT_MS - elapsedMs;

          if (remainingMs > 1000) {
            console.log(
              `[InferenceCoordinator] Device inference failed, falling back to cloud (${remainingMs}ms remaining)`
            );

            return await runCloudInference(photos, {
              deadlineMs: remainingMs,
              idempotencyKey: options?.idempotencyKey,
              plantContext: options?.plantContext,
              assessmentId: options?.assessmentId,
              modelVersion: options?.modelVersion,
            });
          }
        }

        // No fallback or insufficient time remaining
        throw error;
      }
    }

    // Cloud mode: go directly to cloud
    if (mode === 'cloud') {
      return await runCloudInference(photos, {
        deadlineMs,
        idempotencyKey: options?.idempotencyKey,
        plantContext: options?.plantContext,
        assessmentId: options?.assessmentId,
        modelVersion: options?.modelVersion,
      });
    }

    throw new Error(`Invalid inference mode: ${mode}`);
  } catch (error) {
    const elapsedMs = Date.now() - startTime;
    console.error(
      `[InferenceCoordinator] Inference failed after ${elapsedMs}ms:`,
      error
    );
    throw error;
  }
}

/**
 * Run device inference with deadline tracking
 */
async function runDeviceInference(
  photos: CapturedPhoto[],
  options?: InferenceOptions
): Promise<AssessmentResult> {
  const engine = getInferenceEngine();

  // Initialize if not already initialized
  const isInitialized = await checkEngineInitialized(engine);
  if (!isInitialized) {
    await engine.initialize({ warmup: true });
  }

  // Run inference with deadline
  return await engine.predict(photos, options);
}

/**
 * Run cloud inference via Supabase Edge Function
 */
async function runCloudInference(
  photos: CapturedPhoto[],
  options?: {
    deadlineMs?: number;
    idempotencyKey?: string;
    plantContext?: AssessmentPlantContext;
    assessmentId?: string;
    modelVersion?: string;
  }
): Promise<AssessmentResult> {
  // Validate required parameters
  if (!options?.plantContext || !options?.assessmentId) {
    throw {
      code: 'MISSING_PARAMETERS',
      message: 'Cloud inference requires plantContext and assessmentId',
      category: 'validation',
      retryable: false,
      fallbackToCloud: false,
    } as InferenceError;
  }

  const cloudClient = getCloudInferenceClient();

  try {
    const result = await cloudClient.predict({
      photos,
      plantContext: options.plantContext,
      assessmentId: options.assessmentId,
      modelVersion: options.modelVersion,
    });

    return result;
  } catch (error) {
    console.error('[InferenceCoordinator] Cloud inference failed:', error);
    throw error;
  }
}

/**
 * Check if inference engine is initialized
 */
async function checkEngineInitialized(
  engine: ReturnType<typeof getInferenceEngine>
): Promise<boolean> {
  try {
    const modelInfo = engine.getModelInfo();
    return modelInfo !== null;
  } catch {
    return false;
  }
}

/**
 * Estimate inference time based on photo count and device capabilities
 */
export function estimateInferenceTime(photoCount: number): number {
  // Rough estimate: 500ms per photo + 500ms overhead
  const baseTimeMs = 500;
  const perPhotoMs = 500;
  return baseTimeMs + photoCount * perPhotoMs;
}

/**
 * Check if device inference is likely to meet deadline
 */
export function shouldUseDeviceInference(
  photoCount: number,
  deadlineMs?: number
): boolean {
  const estimatedTimeMs = estimateInferenceTime(photoCount);
  const targetDeadlineMs =
    deadlineMs || MODEL_CONFIG.DEVICE_INFERENCE_DEADLINE_MS;

  // Add 20% buffer for safety
  return estimatedTimeMs * 1.2 < targetDeadlineMs;
}

/**
 * Get fallback reason for telemetry
 */
export function getFallbackReason(error: InferenceError): string {
  switch (error.category) {
    case 'timeout':
      return 'Device inference timeout';
    case 'memory':
      return 'Out of memory';
    case 'model':
      return 'Model loading failed';
    default:
      return 'Unknown error';
  }
}
