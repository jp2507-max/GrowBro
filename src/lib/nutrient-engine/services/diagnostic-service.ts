import { Q } from '@nozbe/watermelondb';

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
import { modelToReservoir } from './reservoir-service';
import { modelToSourceWaterProfile } from './source-water-profile-service';

const SECOND_OPINION_THRESHOLD = 0.7;
const AI_OVERRIDE_THRESHOLD_DEFAULT = 0.78;
const HISTORY_WINDOW_HOURS_DEFAULT = 72;
const MAX_HISTORY_SAMPLES = 60;

const SECOND_OPINION_KEY =
  'nutrient.diagnostics.disclaimers.considerSecondOpinion';
const LOW_CONFIDENCE_KEY = 'nutrient.diagnostics.disclaimers.lowConfidence';
const AI_BELOW_THRESHOLD_RATIONALE =
  'nutrient.diagnostics.rationale.aiBelowThreshold';
const AI_ONLY_WARNING_KEY = 'nutrient.diagnostics.disclaimers.aiOnlyPrimary';

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
        record.needsSecondOpinion = result.needsSecondOpinion;
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

function decodeSymptoms(codes: string[]): Symptom[] {
  return codes
    .map((code) => {
      const [type, location, severity] = code.split('|');
      if (!type) {
        return null;
      }
      const normalizedSeverity = (
        Object.values(IssueSeverity) as string[]
      ).includes(severity)
        ? (severity as IssueSeverity)
        : IssueSeverity.MODERATE;
      const symptom: Symptom = {
        type,
        location: location ?? '',
        severity: normalizedSeverity,
      };
      return symptom;
    })
    .filter((symptom): symptom is Symptom => Boolean(symptom));
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

function decodeRecommendations(entries: string[]): Recommendation[] {
  return entries
    .map((entry) => {
      try {
        const parsed = JSON.parse(entry) as {
          action?: string;
          description?: string;
          priority?: number;
          code?: string;
          context?: Record<string, string | number> | null;
        };
        if (!parsed.description) {
          return null;
        }
        const recommendation: Recommendation = {
          action: parsed.action ?? parsed.description,
          description: parsed.description,
          priority: parsed.priority ?? 2,
          code: parsed.code ?? undefined,
          context: parsed.context ?? undefined,
        };
        return recommendation;
      } catch (error) {
        console.warn(
          '[diagnostic-service] recommendation decode failed',
          error
        );
        return null;
      }
    })
    .filter((rec): rec is Recommendation => Boolean(rec));
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

function roundConfidence(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  return Number(clamped.toFixed(2));
}

function createFeedbackSummary(): DiagnosticFeedbackSummary {
  return {
    helpfulCount: 0,
    notHelpfulCount: 0,
  };
}

export function modelToDiagnosticResult(
  model: DiagnosticResultModel
): DiagnosticResult {
  return {
    id: model.id,
    plantId: model.plantId,
    reservoirId: model.reservoirId ?? undefined,
    symptoms: decodeSymptoms(model.symptomCodes ?? []),
    classification: {
      type: model.issueType as NutrientIssue['type'],
      severity: model.issueSeverity as IssueSeverity,
      nutrient: model.nutrientCode ?? undefined,
      likelyCauses: [],
    },
    nutrientCode: model.nutrientCode ?? undefined,
    confidence: roundConfidence(model.confidence ?? 0),
    confidenceBreakdown: {
      final: roundConfidence(model.confidence ?? 0),
      threshold: model.confidenceThreshold ?? AI_OVERRIDE_THRESHOLD_DEFAULT,
      rules: model.rulesConfidence ?? undefined,
      ai: model.aiConfidence ?? undefined,
    },
    recommendations: decodeRecommendations(model.recommendationMessages ?? []),
    inputReadingIds: model.inputReadingIds ?? [],
    waterProfileId: model.waterProfileId ?? undefined,
    confidenceSource: model.confidenceSource as ConfidenceSource,
    rulesBased: Boolean(model.rulesBased),
    aiOverride: Boolean(model.aiOverride),
    rulesConfidence: model.rulesConfidence ?? undefined,
    aiConfidence: model.aiConfidence ?? undefined,
    confidenceThreshold: model.confidenceThreshold ?? undefined,
    rationale: model.rationale ?? [],
    disclaimerKeys: model.disclaimerKeys ?? [],
    needsSecondOpinion: Boolean(model.needsSecondOpinion),
    confidenceFlags: (model.confidenceFlags ??
      []) as DiagnosticConfidenceFlag[],
    aiHypothesisId: model.aiHypothesisId ?? undefined,
    aiMetadata: (model.aiMetadata ?? undefined) as
      | DiagnosticAiMetadata
      | undefined,
    feedback: {
      helpfulCount: model.feedbackHelpfulCount ?? 0,
      notHelpfulCount: model.feedbackNotHelpfulCount ?? 0,
    },
    resolvedAt: model.resolvedAt ?? undefined,
    resolutionNotes: model.resolutionNotes ?? undefined,
    createdAt: model.createdAt.getTime(),
    updatedAt: model.updatedAt.getTime(),
  };
}
