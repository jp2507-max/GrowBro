/**
 * AI Photo Assessment - ML Inference Module
 * Exports for on-device ML inference with ONNX Runtime
 */

// Core inference engine
export {
  getInferenceEngine,
  MLInferenceEngine,
  resetInferenceEngine,
} from './inference-engine';

// Cloud inference client
export {
  CloudInferenceClient,
  getCloudInferenceClient,
  resetCloudInferenceClient,
} from './cloud-inference-client';

// Inference coordinator (deadline budget + cloud fallback)
export type {
  InferenceCoordinatorOptions,
  InferenceMode,
} from './inference-coordinator';
export {
  estimateInferenceTime,
  getFallbackReason,
  runInference,
  shouldUseDeviceInference,
} from './inference-coordinator';

// Model management
export type { DownloadProgress, DownloadResult } from './model-downloader';
export {
  checkModelExists,
  downloadModelFromStorage,
  downloadModelMetadata,
  getModelSize,
} from './model-downloader';
export { deleteModel, downloadModel, updateModel } from './model-lifecycle';
export { getModelManager, ModelManager } from './model-manager';

// Model configuration
export {
  getExecutionProvidersForPlatform,
  getModelPaths,
  isValidModelVersion,
  MODEL_CONFIG,
} from './model-config';

// Model remote config and rollout
export type { ModelRemoteConfig } from './model-remote-config';
export {
  getActiveModelVersion,
  getModelConfigState,
  refreshModelConfig,
  shouldUseShadowModel,
  useModelConfig,
} from './model-remote-config';

// Rollback monitoring
export {
  calculateErrorRate,
  clearMetrics,
  getAllModelMetrics,
  getErrorBreakdown,
  recordModelError,
  recordModelSuccess,
  shouldRollback,
} from './rollback-monitor';

// Edge case detection
export type { EdgeCaseDetectionResult } from './edge-case-detector';
export {
  detectAllEdgeCases,
  detectExtremeCloseUp,
  detectHeavyLEDCast,
  detectNonPlantImage,
} from './edge-case-detector';

// Graceful degradation
export type {
  DegradationDecision,
  DegradationStrategy,
} from './graceful-degradation';
export {
  calculateBackoffDelay,
  canHandleInference,
  checkMemoryAvailability,
  createRetryableError,
  delay,
  determineDegradationStrategy,
  estimateMemoryRequirement,
} from './graceful-degradation';

// Duplicate detection
export type { DuplicateDetectionResult } from './duplicate-detector';
export {
  calculateHammingDistance,
  detectDuplicates,
  findAllDuplicates,
  generatePerceptualHash,
  getUniquePhotos,
  hammingDistanceToSimilarity,
} from './duplicate-detector';

// Timeout handling
export type {
  TimeoutOptions,
  TimeoutProgress,
  TimeoutState,
} from './timeout-handler';
export {
  createCancellableTimeout,
  formatRemainingTime,
  getTimeoutConfig,
  TimeoutHandler,
  withTimeout,
} from './timeout-handler';

// Execution providers
export type { ExecutionProviderConfig } from './execution-providers';
export {
  createSessionOptions,
  getAvailableExecutionProviders,
  getBestExecutionProvider,
  getExecutionProviderDisplayName,
  isExecutionProviderAvailable,
  logExecutionProviderInfo,
} from './execution-providers';

// Telemetry
export {
  getTelemetrySummary,
  logChecksumValidation,
  logCloudInferenceRequest,
  logCloudInferenceTimeout,
  logIdempotencyCacheHit,
  logImageUpload,
  logInferenceSuccess,
  logModelLoad,
  logModelWarmup,
} from './inference-telemetry';

// Confidence calibration
export type {
  CalibrationConfig,
  ConfidenceCalibrationResult,
} from './confidence-calibration';
export {
  applyTemperatureScaling,
  calibrateConfidence,
  calibrateMultiplePredictions,
  getCalibrationConfig,
  resetCalibrationConfig,
  setCalibrationConfig,
  validateCalibrationConfig,
} from './confidence-calibration';

// Result aggregation
export type { AggregatedResult, AggregationInput } from './result-aggregation';
export {
  aggregateResults,
  createMockAggregatedResult,
  getConfidenceLevel,
  shouldShowCommunityCTA,
  validateAggregationInput,
} from './result-aggregation';

// Assessment classes
export {
  getAllAssessmentClasses,
  getAssessmentClass,
  getClassCategory,
  getClassDisplayName,
  getClassesByCategory,
  getNutrientDeficiencyClasses,
  getPestAndPathogenClasses,
  getStressConditionClasses,
  getUnknownClass,
  isOodClass,
  isValidClassId,
} from './assessment-classes';

// Image processing and storage
export { imageCacheManager } from './image-cache-manager';
export type { ProcessedImage } from './image-processing';
export {
  generateImageFilename,
  generateThumbnail,
  getImageSize,
  readImageAsBase64,
  stripExifData,
} from './image-processing';
export {
  cleanupOldAssessments,
  computeFilenameKey,
  computeIntegritySha256,
  deleteAssessmentImages,
  getAssessmentStorageSize,
  storeImage,
  storeThumbnail,
} from './image-storage';

// Action plan generation and task integration
export {
  ActionPlanGenerator,
  actionPlanGenerator,
  generateActionPlan,
} from './action-plan-generator';
export {
  CORRECTIVE_ACTION_WARNINGS,
  DIAGNOSTIC_CHECKS,
  getActionPlanTemplate,
  hasActionPlanTemplate,
  STANDARD_DISCLAIMERS,
} from './action-plan-templates';
export type {
  AssessmentActionEvent,
  AssessmentActionType,
  PlaybookAdjustmentMetadata,
  TaskCreationMetadata,
} from './action-tracking';
export {
  ActionTrackingService,
  actionTrackingService,
  trackCommunityCTA,
  trackHelpfulVote,
  trackIssueResolution,
  trackPlaybookAdjustment,
  trackRetake,
  trackTaskCreation,
} from './action-tracking';
export type {
  PlaybookAdjustment,
  PlaybookAdjustmentOptions,
  PlaybookAdjustmentResult,
} from './playbook-integration';
export {
  PlaybookIntegrationService,
  playbookIntegrationService,
  suggestPlaybookAdjustments,
} from './playbook-integration';
export type {
  TaskCreationOptions,
  TaskCreationResult,
} from './task-integration';
export {
  createTasksFromActionPlan,
  TaskIntegrationService,
  taskIntegrationService,
} from './task-integration';

// Feedback and telemetry services
export type {
  InferenceMetrics,
  InferenceMetricsFilters,
  PerClassMetrics,
  UserActionMetrics,
} from './assessment-analytics';
export {
  getAssessmentSummary,
  getExecutionProviderDistribution,
  getInferenceMetrics,
  getModelVersionDistribution,
  getPerClassMetrics,
  getUserActionMetrics,
} from './assessment-analytics';
export type { SubmitFeedbackOptions } from './assessment-feedback-service';
export {
  getAssessmentFeedback,
  getFeedbackStats,
  hasAssessmentFeedback,
  submitFeedback,
} from './assessment-feedback-service';
export {
  addAssessmentCreatedBreadcrumb,
  addCloudFallbackBreadcrumb,
  addExecutionProviderBreadcrumb,
  addFeedbackBreadcrumb,
  addInferenceSuccessBreadcrumb,
  addModelLoadBreadcrumb,
  addUserActionBreadcrumb,
  captureChecksumValidationError,
  captureInferenceError,
} from './assessment-sentry';
export {
  getAssessmentTelemetry,
  logCloudFallback as logAssessmentCloudFallback,
  logAssessmentCreated,
  logExecutionProvider as logAssessmentExecutionProvider,
  logInferenceFailure as logAssessmentInferenceFailure,
  logFeedbackSubmitted,
  logInferenceCompleted,
  logUserAction,
} from './assessment-telemetry-service';
