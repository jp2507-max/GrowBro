import { Q } from '@nozbe/watermelondb';

import { triggerDigitalTwinSync } from '@/lib/digital-twin/sync-helpers';
import { database } from '@/lib/watermelon';
import { DiagnosticResultModel } from '@/lib/watermelon-models/diagnostic-result';
import { PhEcReadingModel } from '@/lib/watermelon-models/ph-ec-reading';
import { ReservoirModel } from '@/lib/watermelon-models/reservoir';
import { SourceWaterProfileModel } from '@/lib/watermelon-models/source-water-profile';

import {
  type ConfidenceSource,
  ConfidenceSource as ConfidenceSourceValue,
  type DiagnosticAiMetadata,
  DiagnosticConfidenceFlag,
  type DiagnosticFeedbackInput,
  type DiagnosticFeedbackSummary,
  type DiagnosticResult,
  IssueSeverity,
  type NutrientIssue,
  type PhEcReading,
  type Recommendation,
  type Reservoir,
  type SourceWaterProfile,
  type Symptom,
} from '../types';
import {
  evaluateDiagnosticRules,
  RULE_CONFIDENCE_THRESHOLD,
} from '../utils/diagnostic-rules';
import {
  AI_OVERRIDE_THRESHOLD_DEFAULT,
  modelToDiagnosticResult,
  roundConfidence,
} from './diagnostic-mappers';
import { modelToReservoir } from './reservoir-service';
import { modelToSourceWaterProfile } from './source-water-profile-service';

const SECOND_OPINION_THRESHOLD = 0.7;
const HISTORY_WINDOW_HOURS_DEFAULT = 72;
const MAX_HISTORY_SAMPLES = 60;

const SECOND_OPINION_KEY =
  'nutrient.diagnostics.disclaimers.consider_second_opinion';
const LOW_CONFIDENCE_KEY = 'nutrient.diagnostics.disclaimers.low_confidence';
const AI_BELOW_THRESHOLD_RATIONALE =
  'nutrient.diagnostics.rationale.ai_below_threshold';

const AI_ONLY_WARNING_KEY = 'nutrient.diagnostics.disclaimers.ai_only_primary';

export type AiDiagnosticHypothesis = {
  hypothesisId?: string;
  classification: NutrientIssue;
  confidence: number;
  recommendations?: Recommendation[];
  rationale?: string[];
  metadata?: DiagnosticAiMetadata;
  inputReadingIds?: string[];
};

export type EvaluateDiagnosticInput = {
  plantId: string;
  reservoirId?: string;
  symptoms: Symptom[];
  aiHypothesis?: AiDiagnosticHypothesis | null;
  aiConfidenceThreshold?: number;
  userId?: string;
  historyWindowHours?: number;
};

type EvaluationContext = {
  reservoir?: Reservoir | null;
  sourceWaterProfile?: SourceWaterProfile | null;
  readings: PhEcReading[];
  symptoms: Symptom[];
  aiHypothesis?: AiDiagnosticHypothesis | null;
  aiThreshold: number;
};

export async function evaluateAndPersistDiagnostic(
  input: EvaluateDiagnosticInput
): Promise<DiagnosticResult | null> {
  const ctx = await buildEvaluationContext(input);
  if (!ctx) {
    return null;
  }

  const ruleEvaluation = evaluateDiagnosticRules({
    symptoms: ctx.symptoms,
    readings: ctx.readings,
    reservoir: ctx.reservoir ?? undefined,
    sourceWaterProfile: ctx.sourceWaterProfile ?? undefined,
  });

  return combineEvaluations({
    ctx,
    ruleEvaluation,
    plantId: input.plantId,
    reservoirId: input.reservoirId,
    userId: input.userId,
  });
}

export async function recordDiagnosticFeedback(
  diagnosticId: string,
  feedback: DiagnosticFeedbackInput
): Promise<DiagnosticResult> {
  const model = await database
    .get<DiagnosticResultModel>(DiagnosticResultModel.table)
    .find(diagnosticId);

  await model.recordFeedback(
    feedback.helpful,
    feedback.submittedAt,
    feedback.notes
  );
  return modelToDiagnosticResult(model);
}

export async function resolveDiagnosticResult(
  diagnosticId: string,
  notes?: string
): Promise<DiagnosticResult> {
  const model = await database
    .get<DiagnosticResultModel>(DiagnosticResultModel.table)
    .find(diagnosticId);

  await model.markResolved(notes);
  return modelToDiagnosticResult(model);
}

/**
 * Generate diagnostic report combining multiple rule evaluations
 */
// eslint-disable-next-line max-lines-per-function
async function combineEvaluations(args: {
  ctx: EvaluationContext;
  ruleEvaluation: ReturnType<typeof evaluateDiagnosticRules>;
  plantId: string;
  reservoirId?: string;
  userId?: string;
}): Promise<DiagnosticResult | null> {
  const { ctx, ruleEvaluation, plantId, reservoirId, userId } = args;
  const aiHypothesis = ctx.aiHypothesis;

  if (!ruleEvaluation && !aiHypothesis) {
    return null;
  }

  const now = Date.now();
  const flags = new Set<DiagnosticConfidenceFlag>(
    ruleEvaluation?.confidenceFlags ?? []
  );
  const disclaimers = new Set<string>(ruleEvaluation?.disclaimerKeys ?? []);

  let classification: NutrientIssue | undefined =
    ruleEvaluation?.issue ?? aiHypothesis?.classification;
  let nutrientCode =
    ruleEvaluation?.nutrientCode ?? classification?.nutrient ?? undefined;
  const baseRuleRecommendations = ruleEvaluation
    ? ruleEvaluation.recommendations.map((rec) =>
        annotateRecommendation(rec, 'rules')
      )
    : [];
  let recommendations: Recommendation[] = [...baseRuleRecommendations];
  let rationale = [...(ruleEvaluation?.rationale ?? [])];
  let supportingReadingIds =
    ruleEvaluation?.supportingReadingIds ?? aiHypothesis?.inputReadingIds ?? [];
  let rulesConfidence = ruleEvaluation?.confidence;
  let aiConfidence = aiHypothesis?.confidence;
  let confidenceSource: ConfidenceSource = ConfidenceSourceValue.RULES;
  let aiOverride = false;
  let finalConfidence = roundConfidence(rulesConfidence ?? 0);

  if (aiHypothesis) {
    const annotatedAiRecommendations =
      aiHypothesis.recommendations?.map((rec) =>
        annotateRecommendation(rec, 'ai')
      ) ?? [];
    const meetsThreshold =
      aiConfidence !== undefined && aiConfidence >= ctx.aiThreshold;

    if (!classification) {
      classification = aiHypothesis.classification;
    }
    if (!nutrientCode && aiHypothesis.classification.nutrient) {
      nutrientCode = aiHypothesis.classification.nutrient;
    }

    if (meetsThreshold) {
      aiOverride = true;
      classification = aiHypothesis.classification;
      nutrientCode = aiHypothesis.classification.nutrient ?? nutrientCode;
      confidenceSource = ConfidenceSourceValue.AI;
      finalConfidence = roundConfidence(aiConfidence ?? 0);
      recommendations = mergeRecommendations(
        annotatedAiRecommendations,
        baseRuleRecommendations
      );
      rationale = uniqueStrings([
        ...(aiHypothesis.rationale ?? []),
        ...rationale,
      ]);
      supportingReadingIds = uniqueStrings([
        ...(aiHypothesis.inputReadingIds ?? []),
        ...supportingReadingIds,
      ]);
    } else if (ruleEvaluation) {
      confidenceSource = ConfidenceSourceValue.HYBRID;
      flags.add(DiagnosticConfidenceFlag.AI_LOW_CONFIDENCE);
      const weighted =
        roundConfidence(rulesConfidence ?? 0) * 0.6 +
        roundConfidence(aiConfidence ?? 0) * 0.4;
      finalConfidence = roundConfidence(weighted);
      recommendations = mergeRecommendations(
        baseRuleRecommendations,
        annotatedAiRecommendations
      );
      rationale = uniqueStrings([
        ...rationale,
        ...(aiHypothesis.rationale ?? []),
        AI_BELOW_THRESHOLD_RATIONALE,
      ]);
      supportingReadingIds = uniqueStrings([
        ...supportingReadingIds,
        ...(aiHypothesis.inputReadingIds ?? []),
      ]);
      if (
        aiConfidence !== undefined &&
        aiConfidence < RULE_CONFIDENCE_THRESHOLD
      ) {
        disclaimers.add(LOW_CONFIDENCE_KEY);
      }
    } else {
      confidenceSource = ConfidenceSourceValue.AI;
      finalConfidence = roundConfidence(aiConfidence ?? 0);
      recommendations = [...annotatedAiRecommendations];
      rationale = uniqueStrings(aiHypothesis.rationale ?? []);
      supportingReadingIds = uniqueStrings([
        ...supportingReadingIds,
        ...(aiHypothesis.inputReadingIds ?? []),
      ]);
      if (aiConfidence !== undefined && aiConfidence < ctx.aiThreshold) {
        flags.add(DiagnosticConfidenceFlag.AI_LOW_CONFIDENCE);
        disclaimers.add(LOW_CONFIDENCE_KEY);
      }
      if (!ruleEvaluation) {
        flags.add(DiagnosticConfidenceFlag.AI_ONLY_GUIDANCE);
        disclaimers.add(AI_ONLY_WARNING_KEY);
      }
    }
  }

  if (aiHypothesis && !ruleEvaluation) {
    flags.add(DiagnosticConfidenceFlag.AI_ONLY_GUIDANCE);
    disclaimers.add(AI_ONLY_WARNING_KEY);
  }

  if (!classification) {
    return null;
  }

  const needsSecondOpinion = finalConfidence < SECOND_OPINION_THRESHOLD;
  if (needsSecondOpinion) {
    disclaimers.add(LOW_CONFIDENCE_KEY);
    disclaimers.add(SECOND_OPINION_KEY);
  }

  const result: DiagnosticResult = {
    id: '',
    plantId,
    reservoirId,
    symptoms: ctx.symptoms,
    classification,
    nutrientCode,
    confidence: finalConfidence,
    confidenceBreakdown: {
      final: finalConfidence,
      threshold: ctx.aiThreshold,
      rules: rulesConfidence,
      ai: aiConfidence,
    },
    recommendations,
    inputReadingIds: supportingReadingIds,
    waterProfileId:
      ctx.reservoir?.sourceWaterProfileId ?? ctx.sourceWaterProfile?.id,
    confidenceSource,
    rulesBased: Boolean(ruleEvaluation),
    aiOverride,
    rulesConfidence,
    aiConfidence,
    confidenceThreshold: ctx.aiThreshold,
    rationale,
    disclaimerKeys: Array.from(disclaimers),
    needsSecondOpinion,
    confidenceFlags: Array.from(flags),
    aiHypothesisId: aiHypothesis?.hypothesisId,
    aiMetadata: aiHypothesis?.metadata,
    feedback: createFeedbackSummary(),
    resolvedAt: undefined,
    resolutionNotes: undefined,
    createdAt: now,
    updatedAt: now,
  };

  const model = await persistResult(result, userId);
  triggerDigitalTwinSync(plantId, 'diagnostic-service');
  const persisted = modelToDiagnosticResult(model);

  return {
    ...persisted,
    symptoms: ctx.symptoms,
    classification: {
      ...persisted.classification,
      likelyCauses: classification.likelyCauses,
    },
    confidenceBreakdown: result.confidenceBreakdown,
    recommendations: persisted.recommendations,
    rationale: result.rationale,
    disclaimerKeys: result.disclaimerKeys,
    confidenceFlags: result.confidenceFlags,
    needsSecondOpinion: result.needsSecondOpinion,
    aiHypothesisId: result.aiHypothesisId,
    aiMetadata: result.aiMetadata,
  };
}

async function persistResult(
  result: DiagnosticResult,
  userId?: string
): Promise<DiagnosticResultModel> {
  return database.write(async () => {
    return database
      .get<DiagnosticResultModel>(DiagnosticResultModel.table)
      .create((record) => {
        record.plantId = result.plantId;
        if (result.reservoirId) {
          record.reservoirId = result.reservoirId;
        }
        if (result.waterProfileId) {
          record.waterProfileId = result.waterProfileId;
        }
        record.issueType = result.classification.type;
        record.issueSeverity = result.classification.severity;
        if (result.nutrientCode) {
          record.nutrientCode = result.nutrientCode;
        }
        record.confidence = result.confidence;
        record.confidenceSource = result.confidenceSource;
        if (result.rulesConfidence !== undefined) {
          record.rulesConfidence = result.rulesConfidence;
        }
        if (result.aiConfidence !== undefined) {
          record.aiConfidence = result.aiConfidence;
        }
        if (result.confidenceThreshold !== undefined) {
          record.confidenceThreshold = result.confidenceThreshold;
        }
        record.rulesBased = result.rulesBased;
        record.aiOverride = Boolean(result.aiOverride);
        record.needsSecond_opinion = result.needsSecondOpinion;
        record.symptomCodes = encodeSymptoms(result.symptoms);
        record.rationale = result.rationale ?? [];
        record.recommendationMessages = encodeRecommendations(
          result.recommendations ?? []
        );
        record.recommendationCodes = (result.recommendations ?? [])
          .map((rec) => rec.code)
          .filter((code): code is string => Boolean(code));
        record.disclaimerKeys = result.disclaimerKeys ?? [];
        record.inputReadingIds = result.inputReadingIds ?? [];
        if (result.aiHypothesisId) {
          record.aiHypothesisId = result.aiHypothesisId;
        }
        if (result.aiMetadata) {
          record.aiMetadata = result.aiMetadata;
        }
        record.feedbackHelpfulCount = result.feedback?.helpfulCount ?? 0;
        record.feedbackNotHelpfulCount = result.feedback?.notHelpfulCount ?? 0;
        record.confidenceFlags = result.confidenceFlags ?? [];
        if (result.resolutionNotes) {
          record.resolutionNotes = result.resolutionNotes;
        }
        if (result.resolvedAt) {
          record.resolvedAt = result.resolvedAt;
        }
        if (userId) {
          record.userId = userId;
        }
      });
  });
}

async function buildEvaluationContext(
  input: EvaluateDiagnosticInput
): Promise<EvaluationContext | null> {
  const {
    plantId,
    reservoirId,
    historyWindowHours = HISTORY_WINDOW_HOURS_DEFAULT,
    aiHypothesis,
    aiConfidenceThreshold,
    symptoms,
  } = input;

  const readings = await fetchRecentReadings({
    plantId,
    reservoirId,
    historyWindowHours,
  });

  const reservoir = reservoirId ? await fetchReservoir(reservoirId) : null;

  const sourceWaterProfile = reservoir?.sourceWaterProfileId
    ? await fetchSourceWaterProfile(reservoir.sourceWaterProfileId)
    : null;

  if (!readings.length && !aiHypothesis) {
    return null;
  }

  return {
    reservoir,
    sourceWaterProfile,
    readings,
    symptoms,
    aiHypothesis: aiHypothesis ?? null,
    aiThreshold: aiConfidenceThreshold ?? AI_OVERRIDE_THRESHOLD_DEFAULT,
  };
}

async function fetchRecentReadings(args: {
  plantId: string;
  reservoirId?: string;
  historyWindowHours: number;
}): Promise<PhEcReading[]> {
  const { plantId, reservoirId, historyWindowHours } = args;
  const since = Date.now() - historyWindowHours * 60 * 60 * 1000;

  const conditions = [Q.where('measured_at', Q.gte(since))];
  if (reservoirId) {
    conditions.push(Q.where('reservoir_id', reservoirId));
  } else {
    conditions.push(Q.where('plant_id', plantId));
  }

  const models = await database
    .get<PhEcReadingModel>(PhEcReadingModel.table)
    .query(...conditions, Q.sortBy('measured_at', Q.desc))
    .fetch();

  return models.slice(0, MAX_HISTORY_SAMPLES).map(modelToPhEcReading).reverse();
}

async function fetchReservoir(reservoirId: string): Promise<Reservoir | null> {
  try {
    const model = await database
      .get<ReservoirModel>(ReservoirModel.table)
      .find(reservoirId);
    return modelToReservoir(model);
  } catch (error) {
    console.warn('[diagnostic-service] reservoir lookup failed', error);
    return null;
  }
}

async function fetchSourceWaterProfile(
  sourceWaterProfileId: string
): Promise<SourceWaterProfile | null> {
  try {
    const model = await database
      .get<SourceWaterProfileModel>(SourceWaterProfileModel.table)
      .find(sourceWaterProfileId);
    return modelToSourceWaterProfile(model);
  } catch (error) {
    console.warn(
      '[diagnostic-service] source water profile lookup failed',
      error
    );
    return null;
  }
}

function modelToPhEcReading(model: PhEcReadingModel): PhEcReading {
  return {
    id: model.id,
    plantId: model.plantId ?? undefined,
    reservoirId: model.reservoirId ?? undefined,
    measuredAt: model.measuredAt,
    ph: model.ph,
    ecRaw: model.ecRaw,
    ec25c: model.ec25c,
    tempC: model.tempC,
    atcOn: model.atcOn,
    ppmScale: model.ppmScale as PhEcReading['ppmScale'],
    meterId: model.meterId ?? undefined,
    note: model.note ?? undefined,
    qualityFlags: model.qualityFlags ?? [],
    createdAt: model.createdAt.getTime(),
    updatedAt: model.updatedAt.getTime(),
  };
}

function encodeSymptoms(symptoms: Symptom[]): string[] {
  return symptoms.map((symptom) => {
    const location = symptom.location ?? '';
    const severity = symptom.severity ?? IssueSeverity.MODERATE;
    return [symptom.type, location, severity].join('|');
  });
}

function encodeRecommendations(recs: Recommendation[]): string[] {
  return recs.map((rec) =>
    JSON.stringify({
      action: rec.action,
      description: rec.description,
      priority: rec.priority,
      code: rec.code,
      context: rec.context ?? null,
    })
  );
}

type RecommendationSource = 'ai' | 'rules';

function annotateRecommendation(
  recommendation: Recommendation,
  source: RecommendationSource
): Recommendation {
  const context: Record<string, string | number> = {
    ...(recommendation.context ?? {}),
  };
  const existingSource =
    typeof context.source === 'string' ? (context.source as string) : undefined;
  const mergedSource = mergeContextSources(existingSource, source);
  if (mergedSource) {
    context.source = mergedSource;
  } else {
    delete context.source;
  }
  return {
    ...recommendation,
    context: Object.keys(context).length ? context : undefined,
  };
}

function mergeRecommendationContexts(
  existing?: Record<string, string | number>,
  incoming?: Record<string, string | number>
): Record<string, string | number> | undefined {
  if (!existing && !incoming) {
    return undefined;
  }
  const context: Record<string, string | number> = {
    ...(existing ?? {}),
  };
  if (incoming) {
    for (const [key, value] of Object.entries(incoming)) {
      if (key === 'source') {
        const combined = mergeContextSources(
          typeof context.source === 'string'
            ? (context.source as string)
            : undefined,
          typeof value === 'string' ? value : undefined
        );
        if (combined) {
          context.source = combined;
        }
        continue;
      }
      context[key] = value;
    }
  }
  return Object.keys(context).length ? context : undefined;
}

function mergeContextSources(
  existing?: string,
  incoming?: string
): string | undefined {
  const sources = new Set<string>();
  const addSource = (value?: string) => {
    if (!value) {
      return;
    }
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .forEach((entry) => sources.add(entry));
  };
  addSource(existing);
  addSource(incoming);
  return sources.size ? Array.from(sources).join(',') : undefined;
}

function mergeRecommendations(
  primary: Recommendation[],
  secondary: Recommendation[]
): Recommendation[] {
  const merged: Recommendation[] = primary.map((rec) => ({
    ...rec,
    context: rec.context ? { ...rec.context } : undefined,
  }));
  for (const rec of secondary) {
    const matchIndex = merged.findIndex((entry) => {
      if (entry.code && rec.code) {
        return entry.code === rec.code;
      }
      if (entry.code || rec.code) {
        return false;
      }
      return entry.description === rec.description;
    });
    if (matchIndex >= 0) {
      const existing = merged[matchIndex];
      merged[matchIndex] = {
        ...existing,
        priority: Math.min(existing.priority, rec.priority),
        context: mergeRecommendationContexts(existing.context, rec.context),
      };
      continue;
    }
    merged.push({
      ...rec,
      context: rec.context ? { ...rec.context } : undefined,
    });
  }
  return merged;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function createFeedbackSummary(): DiagnosticFeedbackSummary {
  return {
    helpfulCount: 0,
    notHelpfulCount: 0,
  };
}
