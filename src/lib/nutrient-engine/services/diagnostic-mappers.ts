import type { DiagnosticResultModel } from '@/lib/watermelon-models/diagnostic-result';

import {
  ConfidenceSource,
  type DiagnosticAiMetadata,
  type DiagnosticConfidenceFlag,
  type DiagnosticResult,
  IssueSeverity,
  IssueType,
  type Recommendation,
  type Symptom,
} from '../types';

export const AI_OVERRIDE_THRESHOLD_DEFAULT = 0.78;

function validateIssueSeverity(value: unknown): IssueSeverity {
  const valid = Object.values(IssueSeverity) as string[];
  if (typeof value === 'string' && valid.includes(value)) {
    return value as IssueSeverity;
  }
  return IssueSeverity.MODERATE;
}

function validateIssueType(value: unknown): IssueType {
  const valid = Object.values(IssueType) as string[];
  if (typeof value === 'string' && valid.includes(value)) {
    return value as IssueType;
  }
  console.warn(
    `[diagnostic-mappers] invalid issueType: ${value}, defaulting to 'deficiency'`
  );
  return IssueType.DEFICIENCY;
}

function validateConfidenceSource(value: unknown): ConfidenceSource {
  const valid = Object.values(ConfidenceSource) as string[];
  if (typeof value === 'string' && valid.includes(value)) {
    return value as ConfidenceSource;
  }
  console.warn(
    `[diagnostic-mappers] invalid confidenceSource: ${value}, defaulting to 'rules'`
  );
  return ConfidenceSource.RULES;
}

function decodeSymptoms(codes: string[]): Symptom[] {
  return codes
    .map((code) => {
      const [type, location, severity] = code.split('|');
      if (!type) {
        return null;
      }
      const symptom: Symptom = {
        type,
        location: location ?? '',
        severity: validateIssueSeverity(severity),
      };
      return symptom;
    })
    .filter((symptom): symptom is Symptom => Boolean(symptom));
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

export function roundConfidence(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  return Number(clamped.toFixed(2));
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
      type: validateIssueType(model.issueType),
      severity: validateIssueSeverity(model.issueSeverity),
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
    confidenceSource: validateConfidenceSource(model.confidenceSource),
    rulesBased: Boolean(model.rulesBased),
    aiOverride: Boolean(model.aiOverride),
    rulesConfidence: model.rulesConfidence ?? undefined,
    aiConfidence: model.aiConfidence ?? undefined,
    confidenceThreshold: model.confidenceThreshold ?? undefined,
    rationale: model.rationale ?? [],
    disclaimerKeys: model.disclaimerKeys ?? [],
    needsSecondOpinion: Boolean(model.needsSecond_opinion),
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
