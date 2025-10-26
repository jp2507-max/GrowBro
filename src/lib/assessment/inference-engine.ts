import type {
  AssessmentClassRecord,
  AssessmentResult,
  CapturedPhoto,
  ExecutionProvider,
  InferenceError,
  InferenceOptions,
  ModelLoadOptions,
  PerImageResult,
} from '@/types/assessment';

import { applyTemperatureScaling } from './confidence-calibration';
import {
  getBestExecutionProvider,
  logExecutionProviderInfo,
} from './execution-providers';
import {
  canHandleInference,
  determineDegradationStrategy,
} from './graceful-degradation';
import { MODEL_CONFIG } from './model-config';
import { getModelManager } from './model-manager';
import { getActiveModelVersion } from './model-remote-config';
import { recordModelError, recordModelSuccess } from './rollback-monitor';

/**
 * Custom error class for inference engine errors
 * Provides proper Error inheritance with additional metadata
 */
class InferenceEngineError extends Error {
  code: string;
  category: InferenceError['category'];
  retryable: boolean;
  fallbackToCloud: boolean;

  constructor(opts: {
    code: string;
    message: string;
    category: InferenceError['category'];
    retryable: boolean;
    fallbackToCloud?: boolean;
  }) {
    super(opts.message);
    this.name = 'InferenceEngineError';
    this.code = opts.code;
    this.category = opts.category;
    this.retryable = opts.retryable;
    this.fallbackToCloud = !!opts.fallbackToCloud;
  }
}

/**
 * ML Inference Engine
 * Handles on-device ML inference with ONNX Runtime React Native
 * Supports XNNPACK, NNAPI, and CoreML execution providers
 */

export class MLInferenceEngine {
  private isInitialized = false;
  private activeProvider: ExecutionProvider | null = null;
  private session: unknown | null = null; // ONNX Runtime session
  private modelVersion: string | null = null;

  /**
   * Initialize the inference engine
   */
  async initialize(options?: ModelLoadOptions): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Check if device can handle inference
      const memoryCheck = canHandleInference(MODEL_CONFIG.MAX_MODEL_SIZE_MB);
      if (!memoryCheck.canHandle) {
        throw this.createError({
          code: 'INSUFFICIENT_MEMORY',
          message: memoryCheck.reason || 'Insufficient memory for inference',
          category: 'memory',
          retryable: false,
          fallbackToCloud: true,
        });
      }

      const modelManager = getModelManager();
      await modelManager.initialize();

      // Get active model version from remote config
      const activeVersion = getActiveModelVersion();
      this.modelVersion = activeVersion;

      // Check if model is available
      const isAvailable = await modelManager.isModelAvailable();
      if (!isAvailable) {
        throw this.createError({
          code: 'MODEL_NOT_FOUND',
          message: 'Model file not found. Please download the model first.',
          category: 'model',
          retryable: false,
        });
      }

      // Validate model checksum if requested
      if (options?.validateChecksum) {
        const validation = await modelManager.validateModelChecksum();
        if (!validation.valid) {
          throw this.createError({
            code: 'CHECKSUM_VALIDATION_FAILED',
            message: 'Model checksum validation failed',
            category: 'model',
            retryable: false,
          });
        }
      }

      // Load model metadata
      const modelInfo = await modelManager.loadModelMetadata();
      if (!modelInfo) {
        throw this.createError({
          code: 'METADATA_LOAD_FAILED',
          message: 'Failed to load model metadata',
          category: 'model',
          retryable: false,
        });
      }

      this.modelVersion = modelInfo.version;

      // Determine execution provider
      const preferredProvider =
        options?.preferredProvider || getBestExecutionProvider();
      this.activeProvider = preferredProvider;

      // TODO: Load ONNX Runtime session
      // This is a placeholder - actual ONNX Runtime integration will be added
      // const InferenceSession = require('onnxruntime-react-native').InferenceSession;
      // this.session = await InferenceSession.create(modelPath, sessionOptions);

      logExecutionProviderInfo(this.activeProvider);

      // Perform warmup if requested
      if (options?.warmup) {
        await this.warmup();
      }

      this.isInitialized = true;
      console.log('[MLInferenceEngine] Initialized successfully');
    } catch (error) {
      console.error('[MLInferenceEngine] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Perform model warmup with dummy input
   */
  async warmup(): Promise<void> {
    console.log('[MLInferenceEngine] Starting warmup...');

    try {
      const { WARMUP } = MODEL_CONFIG;

      for (let i = 0; i < WARMUP.ITERATIONS; i++) {
        // TODO: Run inference with dummy tensor
        // const dummyInput = createDummyTensor(WARMUP.TENSOR_SHAPE);
        // await this.session.run({ input: dummyInput });
        console.log(
          `[MLInferenceEngine] Warmup iteration ${i + 1}/${WARMUP.ITERATIONS}`
        );
      }

      console.log('[MLInferenceEngine] Warmup completed');
    } catch (error) {
      console.error('[MLInferenceEngine] Warmup failed:', error);
      // Warmup failure is not fatal
    }
  }

  /**
   * Run inference on captured photos
   */
  async predict(
    photos: CapturedPhoto[],
    options?: InferenceOptions
  ): Promise<AssessmentResult> {
    this.assertInitialized();

    const startTime = Date.now();
    const deadlineMs =
      options?.deadlineMs ?? MODEL_CONFIG.DEVICE_INFERENCE_DEADLINE_MS;

    try {
      this.assertWithinDeadline(startTime, deadlineMs, 'start');

      const perImageResults = await this.runPerImageInference(
        photos,
        startTime,
        deadlineMs
      );

      return this.createAssessmentResult(perImageResults, startTime);
    } catch (error) {
      return this.handlePredictFailure(error, startTime);
    }
  }

  private assertInitialized(): void {
    if (this.isInitialized) {
      return;
    }

    throw this.createError({
      code: 'NOT_INITIALIZED',
      message: 'Inference engine not initialized',
      category: 'model',
      retryable: false,
    });
  }

  private assertWithinDeadline(
    startTime: number,
    deadlineMs: number,
    phase: 'start' | 'processing'
  ): void {
    if (Date.now() - startTime <= deadlineMs) {
      return;
    }

    const message =
      phase === 'start'
        ? 'Inference deadline exceeded before starting'
        : 'Inference deadline exceeded during processing';

    throw this.createError({
      code: 'DEADLINE_EXCEEDED',
      message,
      category: 'timeout',
      retryable: false,
      fallbackToCloud: true,
    });
  }

  private async runPerImageInference(
    photos: CapturedPhoto[],
    startTime: number,
    deadlineMs: number
  ): Promise<PerImageResult[]> {
    const perImageResults: PerImageResult[] = [];

    for (const photo of photos) {
      this.assertWithinDeadline(startTime, deadlineMs, 'processing');
      const result = await this.predictSingleImage(photo);
      perImageResults.push(result);
    }

    return perImageResults;
  }

  private createAssessmentResult(
    perImageResults: PerImageResult[],
    startTime: number
  ): AssessmentResult {
    const aggregated = this.aggregateResults(perImageResults);
    const processingTimeMs = Date.now() - startTime;

    console.log(
      `[MLInferenceEngine] Inference completed in ${processingTimeMs}ms`
    );

    const modelVersion = this.modelVersion || MODEL_CONFIG.CURRENT_VERSION;
    recordModelSuccess(modelVersion);

    return {
      topClass: aggregated.topClass,
      rawConfidence: aggregated.rawConfidence,
      calibratedConfidence: aggregated.calibratedConfidence,
      perImage: perImageResults,
      aggregationMethod: aggregated.method,
      processingTimeMs,
      mode: 'device',
      modelVersion,
      executionProvider: this.activeProvider || undefined,
    };
  }

  private handlePredictFailure(error: unknown, startTime: number): never {
    const processingTimeMs = Date.now() - startTime;
    console.error(
      `[MLInferenceEngine] Inference failed after ${processingTimeMs}ms:`,
      error
    );

    const modelVersion = this.modelVersion || MODEL_CONFIG.CURRENT_VERSION;
    const inferenceError = error as InferenceError;
    recordModelError(
      modelVersion,
      inferenceError.code || 'UNKNOWN_ERROR',
      inferenceError.category || 'unknown'
    );

    const degradation = determineDegradationStrategy(error as Error);
    console.log(
      `[MLInferenceEngine] Degradation strategy: ${degradation.strategy} - ${degradation.reason}`
    );

    throw error;
  }

  /**
   * Run inference on a single image
   */
  private async predictSingleImage(
    photo: CapturedPhoto
  ): Promise<PerImageResult> {
    // TODO: Implement actual ONNX Runtime inference
    // This is a placeholder that returns mock results

    // 1. Load and preprocess image
    // const imageData = await loadImage(photo.uri);
    // const preprocessed = preprocessImage(imageData);

    // 2. Run inference
    // const output = await this.session.run({ input: preprocessed });
    // const logits = output.output;

    // 3. Apply softmax to get probabilities
    // const probabilities = softmax(logits);

    // 4. Get top class and confidence
    // const topClassIndex = argmax(probabilities);
    // const rawConfidence = probabilities[topClassIndex];

    // Placeholder: Return mock result
    const mockClassId = 'healthy';
    const mockRawConfidence = 0.92;

    return {
      id: photo.id,
      uri: photo.uri,
      classId: mockClassId,
      conf: mockRawConfidence,
      quality: photo.qualityScore,
    };
  }

  /**
   * Aggregate results from multiple images
   */
  private aggregateResults(results: PerImageResult[]): {
    topClass: AssessmentClassRecord;
    rawConfidence: number;
    calibratedConfidence: number;
    method: 'majority-vote' | 'highest-confidence';
  } {
    if (results.length === 0) {
      throw this.createError({
        code: 'NO_RESULTS',
        message: 'No inference results to aggregate',
        category: 'validation',
        retryable: false,
      });
    }

    const { votes, confidences } = this.countVotes(results);
    const { topClassId, method } = this.selectTopClass(votes, confidences);

    // Calculate average confidence for top class
    const topClassConfidences = confidences.get(topClassId) || [];
    const rawConfidence =
      topClassConfidences.length > 0
        ? topClassConfidences.reduce((sum, conf) => sum + conf, 0) /
          topClassConfidences.length
        : 0;

    // Apply confidence calibration
    const calibratedConfidence = applyTemperatureScaling(rawConfidence);

    // Check if confidence is below threshold
    const isLowConfidence =
      calibratedConfidence < MODEL_CONFIG.CONFIDENCE.MINIMUM_THRESHOLD;

    // Get class record
    const topClass = this.getClassRecord(
      isLowConfidence ? 'unknown' : topClassId
    );

    return {
      topClass,
      rawConfidence,
      calibratedConfidence,
      method,
    };
  }

  /**
   * Count votes and collect confidences for each class
   */
  private countVotes(results: PerImageResult[]): {
    votes: Map<string, number>;
    confidences: Map<string, number[]>;
  } {
    const votes = new Map<string, number>();
    const confidences = new Map<string, number[]>();

    for (const result of results) {
      votes.set(result.classId, (votes.get(result.classId) || 0) + 1);

      if (!confidences.has(result.classId)) {
        confidences.set(result.classId, []);
      }
      confidences.get(result.classId)!.push(result.conf);
    }

    return { votes, confidences };
  }

  /**
   * Select top class using majority vote or highest confidence
   */
  private selectTopClass(
    votes: Map<string, number>,
    confidences: Map<string, number[]>
  ): {
    topClassId: string;
    method: 'majority-vote' | 'highest-confidence';
  } {
    // Find class with most votes
    let topClassId: string | null = null;
    let maxVotes = 0;

    for (const [classId, voteCount] of votes.entries()) {
      if (voteCount > maxVotes) {
        maxVotes = voteCount;
        topClassId = classId;
      }
    }

    // Handle tie: use highest confidence
    const tiedClasses = Array.from(votes.entries())
      .filter(([, count]) => count === maxVotes)
      .map(([classId]) => classId);

    let method: 'majority-vote' | 'highest-confidence' = 'majority-vote';

    if (tiedClasses.length > 1) {
      method = 'highest-confidence';
      topClassId = this.selectByHighestConfidence(tiedClasses, confidences);
    }

    if (!topClassId) {
      throw this.createError({
        code: 'AGGREGATION_FAILED',
        message: 'Failed to aggregate results',
        category: 'validation',
        retryable: false,
      });
    }

    return { topClassId, method };
  }

  /**
   * Select class with highest average confidence from tied classes
   */
  private selectByHighestConfidence(
    classes: string[],
    confidences: Map<string, number[]>
  ): string {
    let maxConfidence = 0;
    let selectedClass = classes[0];

    for (const classId of classes) {
      const classConfidences = confidences.get(classId) || [];
      const avgConfidence =
        classConfidences.length > 0
          ? classConfidences.reduce((sum, conf) => sum + conf, 0) /
            classConfidences.length
          : 0;

      if (avgConfidence > maxConfidence) {
        maxConfidence = avgConfidence;
        selectedClass = classId;
      }
    }

    return selectedClass;
  }

  /**
   * Get assessment class record by ID
   */
  private getClassRecord(classId: string): AssessmentClassRecord {
    let classInfo = MODEL_CONFIG.CLASSES.find((c) => c.id === classId);

    if (!classInfo) {
      // Return unknown class as fallback
      const unknownClass = MODEL_CONFIG.CLASSES.find((c) => c.isOod);
      if (!unknownClass) {
        throw this.createError({
          code: 'CLASS_NOT_FOUND',
          message: `Class not found: ${classId}`,
          category: 'validation',
          retryable: false,
        });
      }
      classInfo = unknownClass;
    }

    return {
      id: classInfo.id,
      name: classInfo.name,
      category: classInfo.category,
      description: '', // Will be populated from database
      visualCues: [],
      isOod: classInfo.isOod,
      actionTemplate: {
        immediateSteps: [],
        shortTermActions: [],
        diagnosticChecks: [],
        warnings: [],
        disclaimers: [],
      },
      createdAt: Date.now(),
    };
  }

  /**
   * Get model information
   */
  getModelInfo() {
    const modelManager = getModelManager();
    return modelManager.getModelInfo();
  }

  /**
   * Update model to new version
   */
  async updateModel(
    version: string,
    options?: ModelLoadOptions
  ): Promise<void> {
    const modelManager = getModelManager();
    await modelManager.updateModel(version, options);

    // Reinitialize with new model
    this.isInitialized = false;
    this.session = null;
    await this.initialize(options);
  }

  /**
   * Release resources
   */
  async dispose(): Promise<void> {
    if (this.session) {
      // TODO: Dispose ONNX Runtime session
      // await this.session.release();
      this.session = null;
    }

    this.isInitialized = false;
    this.activeProvider = null;
    this.modelVersion = null;

    console.log('[MLInferenceEngine] Resources released');
  }

  /**
   * Create typed inference error
   */
  private createError(options: {
    code: string;
    message: string;
    category: InferenceError['category'];
    retryable: boolean;
    fallbackToCloud?: boolean;
  }): Error {
    return new InferenceEngineError(options);
  }
}

// Singleton instance
let inferenceEngineInstance: MLInferenceEngine | null = null;

/**
 * Get singleton inference engine instance
 */
export function getInferenceEngine(): MLInferenceEngine {
  if (!inferenceEngineInstance) {
    inferenceEngineInstance = new MLInferenceEngine();
  }
  return inferenceEngineInstance;
}

/**
 * Reset inference engine (useful for testing)
 */
export async function resetInferenceEngine(): Promise<void> {
  if (inferenceEngineInstance) {
    try {
      await inferenceEngineInstance.dispose();
    } catch (err) {
      // Log disposal errors but don't fail the reset operation
      console.error('Error disposing inference engine:', err);
    } finally {
      inferenceEngineInstance = null;
    }
  }
}
