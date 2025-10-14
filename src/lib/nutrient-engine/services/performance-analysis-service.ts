import type { FeedingPhase, FeedingTemplate, PhEcReading } from '../types';

/**
 * Performance analysis service
 *
 * Analyzes pH/EC performance data and generates template suggestions
 * based on learnings from previous grows.
 *
 * Requirements: 7.3, 7.6
 */

type PerformanceMetrics = {
  phTimeInBand: number; // percentage
  ecTimeInBand: number; // percentage
  avgPhDeviation: number; // average deviation from target
  avgEcDeviation: number; // average deviation from target
  medianCorrectionTime: number; // minutes
  phTrendDirection: 'stable' | 'rising' | 'falling';
  ecTrendDirection: 'stable' | 'rising' | 'falling';
};

type TemplateSuggestion = {
  adjustmentType: 'ph_range' | 'ec_range' | 'both';
  phase: string; // PlantPhase enum value
  currentPhMin?: number;
  currentPhMax?: number;
  suggestedPhMin?: number;
  suggestedPhMax?: number;
  currentEcMin?: number;
  currentEcMax?: number;
  suggestedEcMin?: number;
  suggestedEcMax?: number;
  reason: string;
  confidence: 'low' | 'medium' | 'high';
};

type LearningsResult = {
  metrics: PerformanceMetrics;
  suggestions: TemplateSuggestion[];
  improvedTemplate: FeedingTemplate | null;
};

/**
 * Calculate performance metrics from readings and target ranges
 */
function calculatePerformanceMetrics(
  readings: PhEcReading[],
  phRange: { min: number; max: number },
  ecRange: { min: number; max: number }
): PerformanceMetrics {
  if (readings.length === 0) {
    return {
      phTimeInBand: 0,
      ecTimeInBand: 0,
      avgPhDeviation: 0,
      avgEcDeviation: 0,
      medianCorrectionTime: 0,
      phTrendDirection: 'stable',
      ecTrendDirection: 'stable',
    };
  }

  const phInBand = readings.filter(
    (r) => r.ph >= phRange.min && r.ph <= phRange.max
  ).length;
  const ecInBand = readings.filter(
    (r) => r.ec25c >= ecRange.min && r.ec25c <= ecRange.max
  ).length;

  const phTimeInBand = (phInBand / readings.length) * 100;
  const ecTimeInBand = (ecInBand / readings.length) * 100;

  // Calculate average deviations
  let totalPhDeviation = 0;
  let totalEcDeviation = 0;

  for (const reading of readings) {
    if (reading.ph < phRange.min) {
      totalPhDeviation += phRange.min - reading.ph;
    } else if (reading.ph > phRange.max) {
      totalPhDeviation += reading.ph - phRange.max;
    }

    if (reading.ec25c < ecRange.min) {
      totalEcDeviation += ecRange.min - reading.ec25c;
    } else if (reading.ec25c > ecRange.max) {
      totalEcDeviation += reading.ec25c - ecRange.max;
    }
  }

  const avgPhDeviation = totalPhDeviation / readings.length;
  const avgEcDeviation = totalEcDeviation / readings.length;

  // Determine trend direction (simple linear regression)
  const phTrend = calculateTrend(readings.map((r) => r.ph));
  const ecTrend = calculateTrend(readings.map((r) => r.ec25c));

  return {
    phTimeInBand,
    ecTimeInBand,
    avgPhDeviation,
    avgEcDeviation,
    medianCorrectionTime: calculateMedianCorrectionTime(
      readings,
      phRange,
      ecRange
    ),
    phTrendDirection: phTrend,
    ecTrendDirection: ecTrend,
  };
}

/**
 * Calculate trend direction using simple slope analysis
 */
function calculateTrend(values: number[]): 'stable' | 'rising' | 'falling' {
  if (values.length < 3) return 'stable';

  // Calculate average slope over time
  let totalSlope = 0;
  for (let i = 1; i < values.length; i++) {
    totalSlope += values[i] - values[i - 1];
  }
  const avgSlope = totalSlope / (values.length - 1);

  // Threshold for considering trend significant
  const threshold = 0.05;

  if (avgSlope > threshold) return 'rising';
  if (avgSlope < -threshold) return 'falling';
  return 'stable';
}

/**
 * Calculate median time to correct deviations
 */
function calculateMedianCorrectionTime(
  readings: PhEcReading[],
  phRange: { min: number; max: number },
  ecRange: { min: number; max: number }
): number {
  if (readings.length < 2) return 0;

  const sortedReadings = [...readings].sort(
    (a, b) => a.measuredAt - b.measuredAt
  );
  const correctionDurations: number[] = [];

  const isInRange = (value: number, range: { min: number; max: number }) =>
    value >= range.min && value <= range.max;

  // Track pH corrections
  let phDeviationStart: number | null = null;
  for (const reading of sortedReadings) {
    if (!isInRange(reading.ph, phRange) && phDeviationStart === null) {
      phDeviationStart = reading.measuredAt;
    } else if (isInRange(reading.ph, phRange) && phDeviationStart !== null) {
      correctionDurations.push(reading.measuredAt - phDeviationStart);
      phDeviationStart = null;
    }
  }

  // Track EC corrections
  let ecDeviationStart: number | null = null;
  for (const reading of sortedReadings) {
    if (!isInRange(reading.ec25c, ecRange) && ecDeviationStart === null) {
      ecDeviationStart = reading.measuredAt;
    } else if (isInRange(reading.ec25c, ecRange) && ecDeviationStart !== null) {
      correctionDurations.push(reading.measuredAt - ecDeviationStart);
      ecDeviationStart = null;
    }
  }

  if (correctionDurations.length === 0) return 0;

  correctionDurations.sort((a, b) => a - b);
  const mid = Math.floor(correctionDurations.length / 2);
  const median =
    correctionDurations.length % 2 === 0
      ? (correctionDurations[mid - 1] + correctionDurations[mid]) / 2
      : correctionDurations[mid];

  return Math.round(median / (1000 * 60)); // Convert to minutes
}

/**
 * Generate pH range suggestion based on metrics
 */
function generatePhSuggestion(
  metrics: PerformanceMetrics,
  currentPhase: FeedingPhase,
  phRange: { min: number; max: number }
): TemplateSuggestion | null {
  if (metrics.phTimeInBand >= 70) return null;

  const suggestion: TemplateSuggestion = {
    adjustmentType: 'ph_range',
    phase: currentPhase.phase,
    currentPhMin: phRange.min,
    currentPhMax: phRange.max,
    suggestedPhMin: phRange.min,
    suggestedPhMax: phRange.max,
    reason: '',
    confidence: 'medium',
  };

  const clampPh = (value: number) => Math.min(14, Math.max(0, value));

  // Adjust based on trend
  if (metrics.phTrendDirection === 'rising' && metrics.avgPhDeviation > 0) {
    suggestion.suggestedPhMax = clampPh(phRange.max + 0.2);
    suggestion.reason = `pH tends to rise above target. Consider widening upper range to ${suggestion.suggestedPhMax.toFixed(1)}.`;
    suggestion.confidence = metrics.phTimeInBand < 50 ? 'high' : 'medium';
  } else if (
    metrics.phTrendDirection === 'falling' &&
    metrics.avgPhDeviation > 0
  ) {
    suggestion.suggestedPhMin = clampPh(phRange.min - 0.2);
    suggestion.reason = `pH tends to fall below target. Consider widening lower range to ${suggestion.suggestedPhMin.toFixed(1)}.`;
    suggestion.confidence = metrics.phTimeInBand < 50 ? 'high' : 'medium';
  } else {
    // Widen both ends slightly if unstable
    suggestion.suggestedPhMin = clampPh(phRange.min - 0.1);
    suggestion.suggestedPhMax = clampPh(phRange.max + 0.1);
    suggestion.reason = `pH fluctuates frequently. Consider slightly wider range: ${suggestion.suggestedPhMin.toFixed(1)}–${suggestion.suggestedPhMax.toFixed(1)}.`;
    suggestion.confidence = 'low';
  }

  return suggestion;
}

/**
 * Generate EC range suggestion based on metrics
 */
function generateEcSuggestion(
  metrics: PerformanceMetrics,
  currentPhase: FeedingPhase,
  ecRange: { min: number; max: number }
): TemplateSuggestion | null {
  if (metrics.ecTimeInBand >= 70) return null;

  const suggestion: TemplateSuggestion = {
    adjustmentType: 'ec_range',
    phase: currentPhase.phase,
    currentEcMin: ecRange.min,
    currentEcMax: ecRange.max,
    suggestedEcMin: ecRange.min,
    suggestedEcMax: ecRange.max,
    reason: '',
    confidence: 'medium',
  };

  // Clamp EC min to non-negative values
  const clampEcMin = (value: number) => Math.max(0, value);

  // Adjust based on trend
  if (metrics.ecTrendDirection === 'rising' && metrics.avgEcDeviation > 0) {
    suggestion.suggestedEcMax = ecRange.max + 0.2;
    suggestion.reason = `EC tends to rise above target. Consider widening upper range to ${suggestion.suggestedEcMax.toFixed(1)} mS/cm.`;
    suggestion.confidence = metrics.ecTimeInBand < 50 ? 'high' : 'medium';
  } else if (
    metrics.ecTrendDirection === 'falling' &&
    metrics.avgEcDeviation > 0
  ) {
    suggestion.suggestedEcMin = clampEcMin(ecRange.min - 0.2);
    suggestion.reason = `EC tends to fall below target. Consider widening lower range to ${suggestion.suggestedEcMin.toFixed(1)} mS/cm.`;
    suggestion.confidence = metrics.ecTimeInBand < 50 ? 'high' : 'medium';
  } else {
    // Widen both ends slightly if unstable
    suggestion.suggestedEcMin = clampEcMin(ecRange.min - 0.1);
    suggestion.suggestedEcMax = ecRange.max + 0.1;
    suggestion.reason = `EC fluctuates frequently. Consider slightly wider range: ${suggestion.suggestedEcMin.toFixed(1)}–${suggestion.suggestedEcMax.toFixed(1)} mS/cm.`;
    suggestion.confidence = 'low';
  }

  return suggestion;
}

/**
 * Generate template suggestions based on performance analysis
 */
function generateSuggestions(params: {
  metrics: PerformanceMetrics;
  currentPhase: FeedingPhase;
  phRange: { min: number; max: number };
  ecRange: { min: number; max: number };
}): TemplateSuggestion[] {
  const { metrics, currentPhase, phRange, ecRange } = params;
  const suggestions: TemplateSuggestion[] = [];

  const phSuggestion = generatePhSuggestion(metrics, currentPhase, phRange);
  if (phSuggestion) suggestions.push(phSuggestion);

  const ecSuggestion = generateEcSuggestion(metrics, currentPhase, ecRange);
  if (ecSuggestion) suggestions.push(ecSuggestion);

  return suggestions;
}

/**
 * Create improved template from suggestions
 */
function createImprovedTemplate(
  currentTemplate: FeedingTemplate,
  currentPhase: FeedingPhase,
  suggestions: TemplateSuggestion[]
): FeedingTemplate | null {
  if (suggestions.length === 0) return null;

  return {
    ...currentTemplate,
    id: '', // Will be generated on save
    name: `${currentTemplate.name} (Improved)`,
    isCustom: true,
    phases: currentTemplate.phases.map((phase) => {
      if (phase.phase !== currentPhase.phase) return phase;

      // Apply suggestions to this phase
      let updatedPhase = { ...phase };
      for (const suggestion of suggestions) {
        if (
          suggestion.adjustmentType === 'ph_range' ||
          suggestion.adjustmentType === 'both'
        ) {
          updatedPhase = {
            ...updatedPhase,
            phRange: [
              suggestion.suggestedPhMin ?? phase.phRange[0],
              suggestion.suggestedPhMax ?? phase.phRange[1],
            ],
          };
        }
        if (
          suggestion.adjustmentType === 'ec_range' ||
          suggestion.adjustmentType === 'both'
        ) {
          updatedPhase = {
            ...updatedPhase,
            ecRange25c: [
              suggestion.suggestedEcMin ?? phase.ecRange25c[0],
              suggestion.suggestedEcMax ?? phase.ecRange25c[1],
            ],
          };
        }
      }
      return updatedPhase;
    }),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/**
 * Analyze performance and generate learnings for next template
 *
 * Analyzes readings against current template and generates suggestions
 * for improving target ranges in the next grow cycle.
 *
 * @param readings - Historical pH/EC readings
 * @param currentTemplate - Current feeding template being analyzed
 * @param currentPhase - Current growth phase (to focus analysis)
 * @returns Analysis results with suggestions and improved template
 */
export function analyzePerformanceAndGenerateLearnings(
  readings: PhEcReading[],
  currentTemplate: FeedingTemplate,
  currentPhase: FeedingPhase
): LearningsResult {
  if (readings.length === 0 || !currentPhase) {
    return {
      metrics: {
        phTimeInBand: 0,
        ecTimeInBand: 0,
        avgPhDeviation: 0,
        avgEcDeviation: 0,
        medianCorrectionTime: 0,
        phTrendDirection: 'stable',
        ecTrendDirection: 'stable',
      },
      suggestions: [],
      improvedTemplate: null,
    };
  }

  const phRange = {
    min: currentPhase.phRange[0],
    max: currentPhase.phRange[1],
  };
  const ecRange = {
    min: currentPhase.ecRange25c[0],
    max: currentPhase.ecRange25c[1],
  };

  const metrics = calculatePerformanceMetrics(readings, phRange, ecRange);
  const suggestions = generateSuggestions({
    metrics,
    currentPhase,
    phRange,
    ecRange,
  });

  const improvedTemplate = createImprovedTemplate(
    currentTemplate,
    currentPhase,
    suggestions
  );

  return {
    metrics,
    suggestions,
    improvedTemplate,
  };
}
