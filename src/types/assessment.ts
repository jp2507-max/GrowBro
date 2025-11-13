export type AssessmentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

export type AssessmentInferenceMode = 'device' | 'cloud';

export type QualityIssueType =
  | 'blur'
  | 'exposure'
  | 'white_balance'
  | 'composition'
  | 'non_cannabis_subject'
  | 'lighting'
  | 'focus'
  | 'frame'
  | 'unknown';

export type QualityIssueSeverity = 'low' | 'medium' | 'high';

export type QualityIssue = {
  type: QualityIssueType;
  severity: QualityIssueSeverity;
  suggestion?: string;
};

export type QualityResult = {
  score: number;
  acceptable: boolean;
  issues: QualityIssue[];
};

export type AssessmentPlantMetadata = {
  strain?: string;
  stage?: string;
  setup_type?: string;
  [key: string]: unknown;
};

export type AssessmentPlantContext = {
  id: string;
  metadata?: AssessmentPlantMetadata;
};

export type AssessmentTaskTemplate = {
  name: string;
  fields: Record<string, string>;
  description?: string;
};

export type AssessmentActionStep = {
  title: string;
  description: string;
  timeframe: string;
  priority: 'high' | 'medium' | 'low';
  taskTemplate?: AssessmentTaskTemplate;
};

export type AssessmentDiagnosticCheck = {
  id: string;
  name: string;
  instructions: string;
  estimatedTimeMinutes?: number;
};

export type AssessmentActionPlan = {
  immediateSteps: AssessmentActionStep[];
  shortTermActions: AssessmentActionStep[];
  diagnosticChecks: AssessmentDiagnosticCheck[];
  warnings: string[];
  disclaimers: string[];
};

export type AssessmentClassCategory =
  | 'nutrient'
  | 'stress'
  | 'pathogen'
  | 'pest'
  | 'healthy'
  | 'unknown';

export type AssessmentClassRecord = {
  id: string;
  name: string;
  category: AssessmentClassCategory;
  description: string;
  visualCues: string[];
  isOod: boolean;
  actionTemplate: AssessmentActionPlan;
  createdAt: number;
};

export type AssessmentResultSummary = {
  predictedClass?: string;
  rawConfidence?: number;
  calibratedConfidence?: number;
  aggregationRule?: string;
};

export type AssessmentFeedback = {
  helpfulVote?: boolean;
  issueResolved?: boolean;
  feedbackNotes?: string | null;
};

export type AssessmentRecord = {
  id: string;
  plantId: string;
  userId: string;
  images: string[];
  integritySha256: string[];
  filenameKeys: string[];
  plantContext: AssessmentPlantContext;
  status: AssessmentStatus;
  inferenceMode: AssessmentInferenceMode;
  modelVersion: string;
  result: AssessmentResultSummary;
  qualityScores: QualityResult[];
  actionPlan?: AssessmentActionPlan;
  latencyMs?: number;
  processingStartedAt?: number;
  processingCompletedAt?: number;
  resolvedAt?: number;
  feedback?: AssessmentFeedback;
  createdAt: number;
  updatedAt: number;
};

export type AssessmentTelemetryEvent = {
  assessmentId: string;
  inferenceMode: AssessmentInferenceMode;
  latencyMs?: number;
  modelVersion: string;
  photoQualityScore?: number;
  calibratedConfidence?: number;
  rawConfidence?: number;
  timestamp: number;
  errors?: string[];
  provider?: string;
};

// Camera Capture Types

export type GuidanceMode = 'leaf-top' | 'leaf-bottom' | 'whole-plant';

export type PhotoMetadata = {
  width: number;
  height: number;
  cameraModel?: string;
  iso?: number;
  exposureTimeMs?: number;
  aperture?: number;
  gps?: null; // always null after EXIF stripping
  extras?: Record<string, unknown>;
};

export type CapturedPhoto = {
  id: string;
  uri: string;
  timestamp: number;
  qualityScore: QualityResult;
  metadata: PhotoMetadata;
};

export type CaptureComponentProps = {
  onPhotosCapture: (photos: CapturedPhoto[]) => void;
  maxPhotos?: number;
  guidanceMode?: GuidanceMode;
  onCancel?: () => void;
};

export type CameraPermissionStatus =
  | 'granted'
  | 'denied'
  | 'undetermined'
  | 'restricted';

export type CameraError = {
  code: string;
  message: string;
  category: 'capture' | 'permission' | 'storage' | 'hardware';
  retryable: boolean;
  fallbackAction?: 'retry' | 'openSettings' | 'useGallery' | 'contactSupport';
  actionPayload?: Record<string, unknown>;
};

// ML Inference Types

export type ExecutionProvider = 'xnnpack' | 'nnapi' | 'coreml' | 'cpu';

export type ModelInfo = {
  version: string;
  delegates: ExecutionProvider[];
  lastUpdated?: string;
  description?: string;
  checksumSha256?: string;
};

export type PerImageResult = {
  id: string;
  uri: string;
  classId: string;
  conf: number;
  quality: QualityResult;
};

export type AggregationMethod = 'majority-vote' | 'highest-confidence';

export type AssessmentResult = {
  topClass: AssessmentClassRecord;
  rawConfidence: number;
  calibratedConfidence: number;
  perImage: PerImageResult[];
  aggregationMethod: AggregationMethod;
  processingTimeMs: number;
  mode: AssessmentInferenceMode;
  modelVersion: string;
  executionProvider?: ExecutionProvider;
};

export type InferenceError = {
  code: string;
  message: string;
  category: 'model' | 'memory' | 'network' | 'timeout' | 'validation';
  retryable: boolean;
  fallbackToCloud?: boolean;
  details?: Record<string, unknown>;
};

export type ModelLoadOptions = {
  validateChecksum?: boolean;
  warmup?: boolean;
  preferredProvider?: ExecutionProvider;
};

export type InferenceOptions = {
  deadlineMs?: number;
  fallbackToCloud?: boolean;
  batchSize?: number;
};

// Offline Queue Types

export type QueueStatus = {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  stalled?: number;
  lastUpdated?: number;
};

export type ProcessingResult = {
  requestId: string;
  success: boolean;
  error?: string;
  processedAt: number;
  details?: unknown;
};

export type AssessmentRequestData = {
  id: string;
  plantId: string;
  userId: string;
  photos: CapturedPhoto[];
  plantContext: AssessmentPlantContext;
  status: AssessmentStatus;
  retryCount: number;
  lastError?: string;
  nextAttemptAt?: number;
  originalTimestamp: number;
  createdAt: number;
  updatedAt: number;
};
