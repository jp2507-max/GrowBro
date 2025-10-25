import { Model } from '@nozbe/watermelondb';
import {
  date,
  field,
  json,
  readonly,
  relation,
  text,
} from '@nozbe/watermelondb/decorators';

import type {
  AssessmentActionPlan,
  AssessmentInferenceMode,
  AssessmentPlantContext,
  AssessmentPlantMetadata,
  AssessmentStatus,
  QualityIssue,
  QualityResult,
} from '@/types/assessment';

const MAX_ITEMS = 10;
const MAX_WARNING_COUNT = 3;
const MAX_DISCLAIMER_COUNT = 2;
const MAX_TEXT_LENGTH = 200;

function sanitizeStringArray(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .filter((value) => typeof value === 'string' && value.trim().length > 0)
    .slice(0, MAX_ITEMS)
    .map((value) => value.trim().slice(0, MAX_TEXT_LENGTH));
}

function sanitizeImages(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .filter((uri) => typeof uri === 'string')
    .filter((uri) => uri.startsWith('file://') || uri.startsWith('content://'))
    .slice(0, MAX_ITEMS);
}

function sanitizeHashes(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .filter((hash) => typeof hash === 'string' && hash.length > 0)
    .slice(0, MAX_ITEMS);
}

function sanitizeQualityIssues(
  issues: QualityIssue[] | undefined
): QualityIssue[] {
  if (!Array.isArray(issues)) {
    return [];
  }

  return issues.slice(0, MAX_ITEMS).map((issue) => ({
    type: issue?.type ?? 'unknown',
    severity: issue?.severity ?? 'low',
    suggestion: issue?.suggestion?.slice(0, MAX_TEXT_LENGTH),
  }));
}

function sanitizeQualityScores(
  scores: QualityResult[] | undefined
): QualityResult[] {
  if (!Array.isArray(scores)) {
    return [];
  }

  return scores.slice(0, MAX_ITEMS).map((score) => ({
    score: typeof score?.score === 'number' ? score.score : 0,
    acceptable: Boolean(score?.acceptable),
    issues: sanitizeQualityIssues(score?.issues),
  }));
}

function sanitizePlantMetadata(
  metadata: AssessmentPlantMetadata | undefined
): AssessmentPlantMetadata | undefined {
  if (!metadata || typeof metadata !== 'object') {
    return undefined;
  }

  const sanitized: AssessmentPlantMetadata = {};

  if (typeof metadata.strain === 'string') {
    sanitized.strain = metadata.strain;
  }

  if (typeof metadata.stage === 'string') {
    sanitized.stage = metadata.stage;
  }

  if (typeof metadata.setup_type === 'string') {
    sanitized.setup_type = metadata.setup_type;
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function sanitizePlantContext(
  context: AssessmentPlantContext | undefined
): AssessmentPlantContext {
  if (!context || typeof context !== 'object') {
    return { id: '' };
  }

  return {
    id: typeof context.id === 'string' ? context.id : String(context.id ?? ''),
    metadata: sanitizePlantMetadata(context.metadata),
  };
}

function trimString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  return value.slice(0, MAX_TEXT_LENGTH);
}

function sanitizeTaskTemplate(
  template: AssessmentActionPlan['immediateSteps'][number]['taskTemplate']
): AssessmentActionPlan['immediateSteps'][number]['taskTemplate'] | undefined {
  if (!template) {
    return undefined;
  }

  const fields: Record<string, string> = {};
  Object.entries(template.fields ?? {})
    .slice(0, MAX_ITEMS)
    .forEach(([key, value]) => {
      if (typeof value === 'string') {
        fields[key] = value.slice(0, MAX_TEXT_LENGTH);
      }
    });

  return {
    name: trimString(template.name) ?? '',
    description: trimString(template.description),
    fields,
  };
}

function sanitizeActionSteps(
  steps: AssessmentActionPlan['immediateSteps'] | undefined
): AssessmentActionPlan['immediateSteps'] {
  if (!Array.isArray(steps)) {
    return [];
  }

  return steps.slice(0, MAX_ITEMS).map((step) => ({
    title: trimString(step?.title) ?? '',
    description: trimString(step?.description) ?? '',
    timeframe: trimString(step?.timeframe) ?? '',
    priority:
      step?.priority === 'high' ||
      step?.priority === 'medium' ||
      step?.priority === 'low'
        ? step.priority
        : 'medium',
    taskTemplate: sanitizeTaskTemplate(step?.taskTemplate),
  }));
}

function sanitizeDiagnosticChecks(
  checks: AssessmentActionPlan['diagnosticChecks'] | undefined
): AssessmentActionPlan['diagnosticChecks'] {
  if (!Array.isArray(checks)) {
    return [];
  }

  return checks.slice(0, MAX_ITEMS).map((check) => ({
    id: trimString(check?.id) ?? '',
    name: trimString(check?.name) ?? '',
    instructions: trimString(check?.instructions) ?? '',
    estimatedTimeMinutes:
      typeof check?.estimatedTimeMinutes === 'number'
        ? check.estimatedTimeMinutes
        : undefined,
  }));
}

function sanitizeActionPlan(
  plan: AssessmentActionPlan | undefined
): AssessmentActionPlan | undefined {
  if (!plan) {
    return undefined;
  }

  return {
    immediateSteps: sanitizeActionSteps(plan.immediateSteps),
    shortTermActions: sanitizeActionSteps(plan.shortTermActions),
    diagnosticChecks: sanitizeDiagnosticChecks(plan.diagnosticChecks),
    warnings: Array.isArray(plan.warnings)
      ? plan.warnings
          .slice(0, MAX_WARNING_COUNT)
          .map((warning) => trimString(warning) ?? '')
      : [],
    disclaimers: Array.isArray(plan.disclaimers)
      ? plan.disclaimers
          .slice(0, MAX_DISCLAIMER_COUNT)
          .map((disclaimer) => trimString(disclaimer) ?? '')
      : [],
  };
}

export class AssessmentModel extends Model {
  static table = 'assessments';

  static associations = {
    plants: { type: 'belongs_to', key: 'plant_id' },
    users: { type: 'belongs_to', key: 'user_id' },
    assessment_classes: { type: 'belongs_to', key: 'predicted_class' },
  } as const;

  @text('plant_id') plantId!: string;
  @text('user_id') userId!: string;
  @text('status') status!: AssessmentStatus;
  @text('inference_mode') inferenceMode!: AssessmentInferenceMode;
  @text('model_version') modelVersion!: string;
  @text('predicted_class') predictedClass?: string;

  @field('raw_confidence') rawConfidence?: number;
  @field('calibrated_confidence') calibratedConfidence?: number;
  @text('aggregation_rule') aggregationRule?: string;
  @field('latency_ms') latencyMs?: number;
  @field('helpful_vote') helpfulVote?: boolean;
  @field('issue_resolved') issueResolved?: boolean;
  @text('feedback_notes') feedbackNotes?: string;

  @json('images', sanitizeImages)
  images!: string[];

  @json('integrity_sha256_json', sanitizeHashes)
  integritySha256!: string[];

  @json('filename_keys_json', sanitizeHashes)
  filenameKeys!: string[];

  @json('plant_context', sanitizePlantContext)
  plantContext!: AssessmentPlantContext;

  @json('quality_scores', sanitizeQualityScores)
  qualityScores!: QualityResult[];

  @json('action_plan', sanitizeActionPlan)
  actionPlan?: AssessmentActionPlan;

  @date('processing_started_at') processingStartedAt?: Date;
  @date('processing_completed_at') processingCompletedAt?: Date;
  @date('resolved_at') resolvedAt?: Date;

  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @relation('assessment_classes', 'predicted_class')
  assessmentClass?: AssessmentClassModel;
}

export class AssessmentClassModel extends Model {
  static table = 'assessment_classes';

  static associations = {
    assessments: { type: 'has_many', foreignKey: 'predicted_class' },
  } as const;

  @text('name') name!: string;
  @text('category') category!: string;
  @text('description') description!: string;
  @field('is_ood') isOod!: boolean;

  @json('visual_cues', sanitizeStringArray)
  visualCues!: string[];

  @json('action_template', sanitizeActionPlan)
  actionTemplate!: AssessmentActionPlan;

  @readonly @date('created_at') createdAt!: Date;
}
