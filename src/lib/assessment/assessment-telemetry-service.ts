import { Q } from '@nozbe/watermelondb';

import { telemetryClient } from '@/lib/privacy/telemetry-client';
import { database } from '@/lib/watermelon';
import type { AssessmentTelemetryModel } from '@/lib/watermelon-models/assessment-telemetry';
import type {
  AssessmentInferenceMode,
  AssessmentResult,
  ExecutionProvider,
  InferenceError,
} from '@/types/assessment';

/**
 * Assessment Telemetry Service
 * Logs privacy-safe telemetry events for AI assessments
 */

/**
 * Log assessment creation event
 */
export async function logAssessmentCreated(options: {
  assessmentId: string;
  mode: AssessmentInferenceMode;
  photoCount: number;
}): Promise<void> {
  const { assessmentId, mode, photoCount } = options;

  await database.write(async () => {
    await database
      .get<AssessmentTelemetryModel>('assessment_telemetry')
      .create((record) => {
        record.assessmentId = assessmentId;
        record.eventType = 'assessment_created';
        record.mode = mode;
        record.metadata = { photoCount };
      });
  });

  // Also log to privacy telemetry client
  await telemetryClient.track({
    name: 'assessment_created',
    properties: {
      assessmentId,
      mode,
      photoCount,
    },
    timestamp: new Date(),
    sessionId: 'assessment',
  });
}

/**
 * Log successful inference completion
 */
export async function logInferenceCompleted(
  assessmentId: string,
  result: AssessmentResult
): Promise<void> {
  await database.write(async () => {
    await database
      .get<AssessmentTelemetryModel>('assessment_telemetry')
      .create((record) => {
        record.assessmentId = assessmentId;
        record.eventType = 'assessment_completed';
        record.mode = result.mode;
        record.latencyMs = result.processingTimeMs;
        record.modelVersion = result.modelVersion;
        record.rawConfidence = result.rawConfidence;
        record.calibratedConfidence = result.calibratedConfidence;
        record.predictedClass = result.topClass.id;
        record.executionProvider = result.executionProvider;
        record.metadata = {
          aggregationMethod: result.aggregationMethod,
          photosProcessed: result.perImage.length,
        };
      });
  });

  await telemetryClient.track({
    name: 'assessment_completed',
    properties: {
      assessmentId,
      mode: result.mode,
      latencyMs: result.processingTimeMs,
      modelVersion: result.modelVersion,
      calibratedConfidence: result.calibratedConfidence,
      provider: result.executionProvider ?? 'unknown',
    },
    timestamp: new Date(),
    sessionId: 'assessment',
  });
}

/**
 * Log inference failure
 */
export async function logInferenceFailure(options: {
  assessmentId: string;
  error: InferenceError;
  mode: AssessmentInferenceMode;
  latencyMs?: number;
}): Promise<void> {
  const { assessmentId, error, mode, latencyMs } = options;

  await database.write(async () => {
    await database
      .get<AssessmentTelemetryModel>('assessment_telemetry')
      .create((record) => {
        record.assessmentId = assessmentId;
        record.eventType = 'inference_failed';
        record.mode = mode;
        record.latencyMs = latencyMs;
        record.errorCode = error.code;
        record.metadata = {
          errorCategory: error.category,
          retryable: error.retryable,
          // Avoid raw messages; store a bounded, sanitized summary
          errorSummary: (error.message ?? '').slice(0, 120),
        };
      });
  });

  await telemetryClient.track({
    name: 'inference_failed',
    properties: {
      assessmentId,
      mode,
      errorCode: error.code,
      errorCategory: error.category,
      latencyMs: latencyMs ?? 0,
    },
    timestamp: new Date(),
    sessionId: 'assessment',
  });
}

/**
 * Log cloud fallback event
 */
export async function logCloudFallback(options: {
  assessmentId: string;
  reason: string;
  deviceLatencyMs: number;
}): Promise<void> {
  const { assessmentId, reason, deviceLatencyMs } = options;

  await database.write(async () => {
    await database
      .get<AssessmentTelemetryModel>('assessment_telemetry')
      .create((record) => {
        record.assessmentId = assessmentId;
        record.eventType = 'cloud_fallback';
        record.mode = 'cloud';
        record.fallbackReason = reason;
        record.latencyMs = deviceLatencyMs;
        record.metadata = { reason };
      });
  });

  await telemetryClient.track({
    name: 'cloud_fallback',
    properties: {
      assessmentId,
      reason,
      deviceLatencyMs,
    },
    timestamp: new Date(),
    sessionId: 'assessment',
  });
}

/**
 * Log execution provider selection
 */
export async function logExecutionProvider(options: {
  assessmentId: string;
  provider: ExecutionProvider;
  availableProviders: ExecutionProvider[];
}): Promise<void> {
  const { assessmentId, provider, availableProviders } = options;

  await database.write(async () => {
    await database
      .get<AssessmentTelemetryModel>('assessment_telemetry')
      .create((record) => {
        record.assessmentId = assessmentId;
        record.eventType = 'inference_started';
        record.executionProvider = provider;
        record.metadata = {
          availableProviders,
        };
      });
  });

  await telemetryClient.track({
    name: 'execution_provider_selected',
    properties: {
      assessmentId,
      provider,
      availableCount: availableProviders.length,
    },
    timestamp: new Date(),
    sessionId: 'assessment',
  });
}

/**
 * Log user action (task created, playbook shifted, community CTA, retake, etc.)
 */
export async function logUserAction(options: {
  assessmentId: string;
  action:
    | 'task_created'
    | 'playbook_adjustment'
    | 'community_cta_tapped'
    | 'community_cta_shown'
    | 'community_post_created'
    | 'retake_initiated'
    | 'diagnostic_checklist_shown';
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { assessmentId, action, metadata = {} } = options;

  await database.write(async () => {
    await database
      .get<AssessmentTelemetryModel>('assessment_telemetry')
      .create((record) => {
        record.assessmentId = assessmentId;
        record.eventType = action;
        record.metadata = metadata;
      });
  });

  await telemetryClient.track({
    name: action,
    properties: {
      assessmentId,
      ...metadata,
    },
    timestamp: new Date(),
    sessionId: 'assessment',
  });
}

/**
 * Log feedback submission
 */
export async function logFeedbackSubmitted(options: {
  assessmentId: string;
  helpful: boolean;
  issueResolved?: string;
}): Promise<void> {
  const { assessmentId, helpful, issueResolved } = options;

  await database.write(async () => {
    await database
      .get<AssessmentTelemetryModel>('assessment_telemetry')
      .create((record) => {
        record.assessmentId = assessmentId;
        record.eventType = 'feedback_submitted';
        record.metadata = {
          helpful,
          issueResolved,
        };
      });
  });

  await telemetryClient.track({
    name: 'feedback_submitted',
    properties: {
      assessmentId,
      helpful,
      issueResolved: issueResolved ?? 'not_provided',
    },
    timestamp: new Date(),
    sessionId: 'assessment',
  });
}

/**
 * Get telemetry summary for an assessment
 */
export async function getAssessmentTelemetry(
  assessmentId: string
): Promise<AssessmentTelemetryModel[]> {
  const telemetry = await database
    .get<AssessmentTelemetryModel>('assessment_telemetry')
    .query(Q.where('assessment_id', assessmentId))
    .fetch();

  return telemetry;
}
