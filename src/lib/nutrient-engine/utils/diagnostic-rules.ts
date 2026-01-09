import {
  DiagnosticConfidenceFlag,
  IssueSeverity,
  IssueType,
  type NutrientIssue,
  type PhEcReading,
  type Recommendation,
  type Reservoir,
  type SourceWaterProfile,
  type Symptom,
} from '../types';

const MIN_HISTORY_POINTS = 3;
const RECENT_WINDOW_MINUTES = 12 * 60;
const DEAD_BAND_PH = 0.1;
const DEAD_BAND_EC = 0.1;
export const RULE_CONFIDENCE_THRESHOLD = 0.7;

const SECOND_OPINION_KEY =
  'nutrient.diagnostics.disclaimers.consider_second_opinion';
const LOW_CONFIDENCE_KEY = 'nutrient.diagnostics.disclaimers.low_confidence';

export type DiagnosticRuleContext = {
  symptoms: Symptom[];
  readings: PhEcReading[];
  reservoir?: Reservoir | null;
  sourceWaterProfile?: SourceWaterProfile | null;
};

export type RuleDiagnosticEvaluation = {
  issue: NutrientIssue;
  nutrientCode?: string;
  confidence: number;
  recommendations: Recommendation[];
  rationale: string[];
  disclaimerKeys: string[];
  confidenceFlags: DiagnosticConfidenceFlag[];
  needsSecondOpinion: boolean;
  supportingReadingIds: string[];
};

type CountBandArgs = {
  readings: PhEcReading[];
  min: number;
  max: number;
  deadband: number;
  selector: (reading: PhEcReading) => number;
};

type RecommendationArgs = {
  code: string;
  descriptionKey: string;
  priority: number;
  context?: Record<string, string | number>;
};

type IssueArgs = {
  type: IssueType;
  severity: IssueSeverity;
  nutrientCode?: string;
  likelyCauseKeys?: string[];
};

type RuleInputs = {
  ctx: DiagnosticRuleContext;
  readings: PhEcReading[];
  rationale: string[];
  flags: DiagnosticConfidenceFlag[];
};

type RuleResult = RuleDiagnosticEvaluation | null;

function sortReadings(readings: PhEcReading[]): PhEcReading[] {
  return [...readings].sort((a, b) => a.measuredAt - b.measuredAt);
}

function filterRecent(readings: PhEcReading[]): PhEcReading[] {
  if (readings.length === 0) {
    return readings;
  }
  const latest = readings[readings.length - 1]?.measuredAt ?? Date.now();
  return readings.filter((reading) => {
    const diffMinutes = Math.abs(latest - reading.measuredAt) / 60_000;
    return diffMinutes <= RECENT_WINDOW_MINUTES;
  });
}

function countOutsideBand(args: CountBandArgs): number {
  const { readings, min, max, deadband, selector } = args;
  return readings.filter((reading) => {
    const value = selector(reading);
    if (value > max + deadband) {
      return true;
    }
    if (value < min - deadband) {
      return true;
    }
    return false;
  }).length;
}

function computeHistoryConfidence(total: number, supporting: number): number {
  if (total === 0) {
    return 0;
  }
  const ratio = supporting / total;
  const bounded = Math.min(Math.max(ratio, 0), 1);
  return Number((0.4 + 0.6 * bounded).toFixed(2));
}

function computeSymptomConfidence(score: number): number {
  const bounded = Math.min(Math.max(score, 0), 1);
  return Number((0.5 + 0.5 * bounded).toFixed(2));
}

function createRecommendation(args: RecommendationArgs): Recommendation {
  const { code, descriptionKey, priority, context = {} } = args;
  return {
    action: `nutrient.diagnostics.actions.${code}`,
    priority,
    description: descriptionKey,
    code,
    context,
  };
}

function createIssue(args: IssueArgs): NutrientIssue {
  const { type, severity, nutrientCode, likelyCauseKeys = [] } = args;
  return {
    type,
    severity,
    nutrient: nutrientCode,
    likelyCauses: likelyCauseKeys,
  };
}

function pushLowHistoryFlag(
  flags: DiagnosticConfidenceFlag[],
  sampleSize: number
): boolean {
  if (sampleSize >= MIN_HISTORY_POINTS) {
    return false;
  }
  if (!flags.includes(DiagnosticConfidenceFlag.LOW_HISTORY)) {
    flags.push(DiagnosticConfidenceFlag.LOW_HISTORY);
  }
  return true;
}

function adjustForHistory(
  confidence: number,
  flags: DiagnosticConfidenceFlag[],
  sampleSize: number
): number {
  const isSparse = pushLowHistoryFlag(flags, sampleSize);
  if (!isSparse) {
    return confidence;
  }
  return Number((confidence * 0.6).toFixed(2));
}

function buildRuleResult(
  core: Omit<RuleDiagnosticEvaluation, 'confidenceFlags' | 'disclaimerKeys'>,
  flags: DiagnosticConfidenceFlag[],
  needsSecondOpinion: boolean
): RuleDiagnosticEvaluation {
  const disclaimers = new Set<string>();
  if (needsSecondOpinion) {
    disclaimers.add(SECOND_OPINION_KEY);
  }
  return {
    ...core,
    confidenceFlags: [...flags],
    disclaimerKeys: [...disclaimers],
  };
}

function evaluatePhDrift(inputs: RuleInputs): RuleResult {
  const { ctx, readings, rationale, flags } = inputs;
  const { reservoir, sourceWaterProfile } = ctx;
  if (!reservoir || !sourceWaterProfile) {
    return null;
  }

  if (sourceWaterProfile.alkalinityMgPerLCaco3 < 120) {
    return null;
  }

  const recent = filterRecent(readings);
  if (recent.length === 0) {
    return null;
  }

  const aboveBandCount = countOutsideBand({
    readings: recent,
    min: reservoir.targetPhMin,
    max: reservoir.targetPhMax,
    deadband: DEAD_BAND_PH,
    selector: (reading) => reading.ph,
  });

  if (aboveBandCount < Math.ceil(recent.length * 0.6)) {
    return null;
  }

  rationale.push('nutrient.diagnostics.rationale.high_alkalinity');
  rationale.push('nutrient.diagnostics.rationale.ph_persistently_high');

  let historyConfidence = computeHistoryConfidence(
    recent.length,
    aboveBandCount
  );
  historyConfidence = adjustForHistory(historyConfidence, flags, recent.length);

  const symptomConfidence = 0.75;
  const confidence = Number(
    ((historyConfidence + symptomConfidence) / 2).toFixed(2)
  );
  const needsSecondOpinion = confidence < RULE_CONFIDENCE_THRESHOLD;

  const recommendations: Recommendation[] = [
    createRecommendation({
      code: 'PH_DRIFT_BUFFER',
      descriptionKey: 'nutrient.diagnostics.recommendations.buffer_alkalinity',
      priority: 1,
    }),
    createRecommendation({
      code: 'PH_DRIFT_MONITOR',
      descriptionKey:
        'nutrient.diagnostics.recommendations.increase_monitoring',
      priority: 2,
    }),
  ];

  return buildRuleResult(
    {
      issue: createIssue({
        type: IssueType.PH_DRIFT,
        severity: IssueSeverity.MODERATE,
        likelyCauseKeys: ['nutrient.diagnostics.causes.high_alkalinity'],
      }),
      nutrientCode: undefined,
      confidence,
      recommendations,
      rationale,
      needsSecondOpinion,
      supportingReadingIds: recent.map((reading) => reading.id),
    },
    flags,
    needsSecondOpinion
  );
}

function hasNitrogenSymptom(symptoms: Symptom[]): boolean {
  return symptoms.some((symptom) => {
    return symptom.type === 'yellowing' && symptom.location === 'lower_leaves';
  });
}

function evaluateNitrogenDeficiency(inputs: RuleInputs): RuleResult {
  const { ctx, readings, rationale, flags } = inputs;
  const { reservoir, symptoms } = ctx;
  if (!reservoir) {
    return null;
  }

  if (!hasNitrogenSymptom(symptoms)) {
    return null;
  }

  const recent = filterRecent(readings);
  if (recent.length === 0) {
    return null;
  }

  const belowBandCount = countOutsideBand({
    readings: recent,
    min: reservoir.targetEcMin25c,
    max: reservoir.targetEcMax25c,
    deadband: DEAD_BAND_EC,
    selector: (reading) => reading.ec25c,
  });

  if (belowBandCount < Math.ceil(recent.length * 0.5)) {
    return null;
  }

  rationale.push('nutrient.diagnostics.rationale.yellowing_lower_leaves');
  rationale.push('nutrient.diagnostics.rationale.ec_below_target');

  let historyConfidence = computeHistoryConfidence(
    recent.length,
    belowBandCount
  );
  historyConfidence = adjustForHistory(historyConfidence, flags, recent.length);

  const symptomConfidence = computeSymptomConfidence(0.8);
  const confidence = Number(
    ((historyConfidence + symptomConfidence) / 2).toFixed(2)
  );
  const needsSecondOpinion = confidence < RULE_CONFIDENCE_THRESHOLD;

  const recommendations: Recommendation[] = [
    createRecommendation({
      code: 'N_DEFICIENCY_FEED',
      descriptionKey: 'nutrient.diagnostics.recommendations.nitrogen_feed',
      priority: 1,
    }),
    createRecommendation({
      code: 'N_DEFICIENCY_MONITOR',
      descriptionKey: 'nutrient.diagnostics.recommendations.monitor48h',
      priority: 2,
    }),
  ];

  return buildRuleResult(
    {
      issue: createIssue({
        type: IssueType.DEFICIENCY,
        severity: IssueSeverity.MODERATE,
        nutrientCode: 'N',
        likelyCauseKeys: ['nutrient.diagnostics.causes.insufficient_nitrogen'],
      }),
      nutrientCode: 'N',
      confidence,
      recommendations,
      rationale,
      needsSecondOpinion,
      supportingReadingIds: recent.map((reading) => reading.id),
    },
    flags,
    needsSecondOpinion
  );
}

function hasToxicitySymptom(symptoms: Symptom[]): boolean {
  return symptoms.some((symptom) => {
    if (symptom.type === 'burnt_tips') {
      return true;
    }
    return symptom.type === 'tip_burn';
  });
}

function evaluateToxicity(inputs: RuleInputs): RuleResult {
  const { ctx, readings, rationale, flags } = inputs;
  const { reservoir, symptoms } = ctx;
  if (!reservoir) {
    return null;
  }

  if (!hasToxicitySymptom(symptoms)) {
    return null;
  }

  const recent = filterRecent(readings);
  if (recent.length === 0) {
    return null;
  }

  const aboveBandCount = countOutsideBand({
    readings: recent,
    min: reservoir.targetEcMin25c,
    max: reservoir.targetEcMax25c,
    deadband: DEAD_BAND_EC,
    selector: (reading) => reading.ec25c,
  });

  if (aboveBandCount < Math.ceil(recent.length * 0.5)) {
    return null;
  }

  rationale.push('nutrient.diagnostics.rationale.tip_burn_observed');
  rationale.push('nutrient.diagnostics.rationale.ec_above_target');

  let historyConfidence = computeHistoryConfidence(
    recent.length,
    aboveBandCount
  );
  historyConfidence = adjustForHistory(historyConfidence, flags, recent.length);

  const symptomConfidence = computeSymptomConfidence(0.7);
  const confidence = Number(
    ((historyConfidence + symptomConfidence) / 2).toFixed(2)
  );
  const needsSecondOpinion = confidence < RULE_CONFIDENCE_THRESHOLD;

  const recommendations: Recommendation[] = [
    createRecommendation({
      code: 'TOXICITY_DILUTE',
      descriptionKey: 'nutrient.diagnostics.recommendations.dilute_reservoir',
      priority: 1,
    }),
    createRecommendation({
      code: 'TOXICITY_MONITOR',
      descriptionKey: 'nutrient.diagnostics.recommendations.retest12h',
      priority: 2,
    }),
  ];

  return buildRuleResult(
    {
      issue: createIssue({
        type: IssueType.TOXICITY,
        severity: IssueSeverity.MODERATE,
        likelyCauseKeys: ['nutrient.diagnostics.causes.solution_too_strong'],
      }),
      nutrientCode: undefined,
      confidence,
      recommendations,
      rationale,
      needsSecondOpinion,
      supportingReadingIds: recent.map((reading) => reading.id),
    },
    flags,
    needsSecondOpinion
  );
}

function pickBestEvaluation(results: RuleResult[]): RuleResult {
  return results.reduce<RuleResult>((winner, entry) => {
    if (!entry) {
      return winner;
    }
    if (!winner) {
      return entry;
    }
    if (entry.confidence > winner.confidence) {
      return entry;
    }
    return winner;
  }, null);
}

export function evaluateDiagnosticRules(
  ctx: DiagnosticRuleContext
): RuleDiagnosticEvaluation | null {
  const sorted = sortReadings(ctx.readings);
  const baseFlags: DiagnosticConfidenceFlag[] = [];
  const baseRationale: string[] = [];

  const phDrift = evaluatePhDrift({
    ctx,
    readings: sorted,
    rationale: [...baseRationale],
    flags: [...baseFlags],
  });

  const deficiency = evaluateNitrogenDeficiency({
    ctx,
    readings: sorted,
    rationale: [...baseRationale],
    flags: [...baseFlags],
  });

  const toxicity = evaluateToxicity({
    ctx,
    readings: sorted,
    rationale: [...baseRationale],
    flags: [...baseFlags],
  });

  const best = pickBestEvaluation([phDrift, deficiency, toxicity]);
  if (!best) {
    return null;
  }

  const flags = new Set<DiagnosticConfidenceFlag>(best.confidenceFlags);
  const disclaimers = new Set<string>(best.disclaimerKeys);
  if (best.confidence < RULE_CONFIDENCE_THRESHOLD) {
    flags.add(DiagnosticConfidenceFlag.RULES_WEAK_MATCH);
    disclaimers.add(LOW_CONFIDENCE_KEY);
  }

  return {
    ...best,
    confidenceFlags: [...flags],
    disclaimerKeys: [...disclaimers],
  };
}
