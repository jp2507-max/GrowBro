/**
 * Performance Metrics Utilities
 *
 * Calculate feeding performance metrics including:
 * - % time within target bands
 * - Median time-to-correction
 * - Deviation frequency and patterns
 *
 * Requirements: 7.3 (feeding performance reports), 7.6 (pattern identification)
 */

import type { DeviationAlert, PhEcReading, Reservoir } from '../types';

// ============================================================================
// Types
// ============================================================================

export type TargetBand = {
  min: number;
  max: number;
};

export type MetricType = 'ph' | 'ec';

export type TimeInBandMetrics = {
  totalReadings: number;
  readingsInBand: number;
  readingsOutOfBand: number;
  percentageInBand: number;
  longestStreak: number;
  currentStreak: number;
};

export type CorrectionMetrics = {
  totalCorrections: number;
  medianCorrectionTimeMs: number;
  averageCorrectionTimeMs: number;
  fastestCorrectionMs: number;
  slowestCorrectionMs: number;
};

export type DeviationPattern = {
  type: 'ph_high' | 'ph_low' | 'ec_high' | 'ec_low';
  frequency: number;
  averageMagnitude: number;
  lastOccurrence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
};

export type PerformanceReport = {
  reservoirId: string;
  dateRange: { start: number; end: number };
  phMetrics: TimeInBandMetrics;
  ecMetrics: TimeInBandMetrics;
  correctionMetrics: CorrectionMetrics;
  deviationPatterns: DeviationPattern[];
  overallScore: number; // 0-100
  insights: string[];
  recommendations: string[];
};

// ============================================================================
// Time in Band Calculations
// ============================================================================

/**
 * Calculate target bands from historical readings
 * Uses median-based approach to infer reasonable target ranges
 *
 * @param readings - Array of pH/EC readings
 * @returns Target bands for pH and EC
 */
function calculateTargetBands(readings: PhEcReading[]): {
  ph: TargetBand;
  ec: TargetBand;
} {
  if (readings.length === 0) {
    return {
      ph: { min: 5.4, max: 6.4 },
      ec: { min: 0.8, max: 2.5 },
    };
  }

  // Extract values
  const phValues = readings.map((r) => r.ph).sort((a, b) => a - b);
  const ecValues = readings.map((r) => r.ec25c).sort((a, b) => a - b);

  // Calculate median-based bands (10th-90th percentile)
  const getPercentile = (arr: number[], p: number) =>
    arr[Math.floor(arr.length * p)];

  return {
    ph: {
      min: getPercentile(phValues, 0.1),
      max: getPercentile(phValues, 0.9),
    },
    ec: {
      min: getPercentile(ecValues, 0.1),
      max: getPercentile(ecValues, 0.9),
    },
  };
}

/**
 * Calculate time in band metrics for pH or EC
 *
 * @param readings - Array of pH/EC readings (sorted by time)
 * @param targetBand - Target range
 * @param metricType - Type of metric ('ph' or 'ec')
 * @returns Time in band metrics
 */
export function calculateTimeInBand(
  readings: PhEcReading[],
  targetBand: TargetBand,
  metricType: MetricType
): TimeInBandMetrics {
  if (readings.length === 0) {
    return {
      totalReadings: 0,
      readingsInBand: 0,
      readingsOutOfBand: 0,
      percentageInBand: 0,
      longestStreak: 0,
      currentStreak: 0,
    };
  }

  let readingsInBand = 0;
  let longestStreak = 0;
  let currentStreak = 0;

  for (const reading of readings) {
    const value = metricType === 'ph' ? reading.ph : reading.ec25c;
    const inBand = value >= targetBand.min && value <= targetBand.max;

    if (inBand) {
      readingsInBand++;
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  const readingsOutOfBand = readings.length - readingsInBand;
  const percentageInBand = (readingsInBand / readings.length) * 100;

  return {
    totalReadings: readings.length,
    readingsInBand,
    readingsOutOfBand,
    percentageInBand,
    longestStreak,
    currentStreak,
  };
}

// ============================================================================
// Correction Time Calculations
// ============================================================================

/**
 * Calculate correction metrics from deviation alerts
 * Measures time from alert trigger to resolution
 *
 * @param alerts - Array of deviation alerts (sorted by time)
 * @returns Correction metrics
 */
export function calculateCorrectionMetrics(
  alerts: DeviationAlert[]
): CorrectionMetrics {
  const resolvedAlerts = alerts.filter(
    (alert) => alert.resolvedAt !== undefined
  );

  if (resolvedAlerts.length === 0) {
    return {
      totalCorrections: 0,
      medianCorrectionTimeMs: 0,
      averageCorrectionTimeMs: 0,
      fastestCorrectionMs: 0,
      slowestCorrectionMs: 0,
    };
  }

  const correctionTimes = resolvedAlerts.map(
    (alert) => alert.resolvedAt! - alert.triggeredAt
  );

  correctionTimes.sort((a, b) => a - b);

  const length = correctionTimes.length;
  const medianCorrectionTimeMs =
    length % 2 === 0
      ? (correctionTimes[length / 2 - 1] + correctionTimes[length / 2]) / 2
      : correctionTimes[Math.floor(length / 2)];
  const averageCorrectionTimeMs =
    correctionTimes.reduce((sum, time) => sum + time, 0) /
    correctionTimes.length;

  return {
    totalCorrections: resolvedAlerts.length,
    medianCorrectionTimeMs,
    averageCorrectionTimeMs,
    fastestCorrectionMs: correctionTimes[0],
    slowestCorrectionMs: correctionTimes[correctionTimes.length - 1],
  };
}

// ============================================================================
// Deviation Pattern Analysis
// ============================================================================

/**
 * Analyze deviation patterns from alerts
 *
 * @param alerts - Array of deviation alerts (sorted by time)
 * @returns Array of deviation patterns
 */
export function analyzeDeviationPatterns(
  alerts: DeviationAlert[]
): DeviationPattern[] {
  if (alerts.length === 0) {
    return [];
  }

  // Group alerts by type
  const alertsByType = new Map<string, DeviationAlert[]>();

  for (const alert of alerts) {
    const type = alert.type;
    if (!alertsByType.has(type)) {
      alertsByType.set(type, []);
    }
    alertsByType.get(type)!.push(alert);
  }

  // Analyze each pattern
  const patterns: DeviationPattern[] = [];

  for (const [type, typeAlerts] of alertsByType) {
    if (typeAlerts.length < 2) continue;

    // Calculate frequency (alerts per day)
    const timespan =
      typeAlerts[typeAlerts.length - 1].triggeredAt - typeAlerts[0].triggeredAt;
    const days = timespan / (24 * 60 * 60 * 1000);
    const frequency = days > 0 ? typeAlerts.length / days : 0;

    // Calculate average magnitude (severity-based estimate)
    const severities = typeAlerts.map((a) => severityToScore(a.severity));
    const averageMagnitude =
      severities.reduce((sum, s) => sum + s, 0) / severities.length;

    // Determine trend (increasing, decreasing, stable)
    const recentCount = typeAlerts.filter(
      (a) => a.triggeredAt > Date.now() - 7 * 24 * 60 * 60 * 1000
    ).length;
    const olderCount = typeAlerts.length - recentCount;
    const recentRate = recentCount / 7;
    const olderRate = days > 7 ? olderCount / (days - 7) : 0;

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (recentRate > olderRate * 1.2) {
      trend = 'increasing';
    } else if (recentRate < olderRate * 0.8) {
      trend = 'decreasing';
    }

    patterns.push({
      type: type as 'ph_low' | 'ph_high' | 'ec_low' | 'ec_high',
      frequency,
      averageMagnitude,
      lastOccurrence: typeAlerts[typeAlerts.length - 1].triggeredAt,
      trend,
    });
  }

  return patterns;
}

/**
 * Convert severity to numeric score for magnitude calculation
 */
function severityToScore(severity: string): number {
  switch (severity) {
    case 'low':
      return 1;
    case 'medium':
      return 2;
    case 'high':
      return 3;
    default:
      return 1;
  }
}

// ============================================================================
// Performance Score Calculation
// ============================================================================

/**
 * Calculate overall performance score (0-100)
 * Based on multiple factors with weighted contributions
 *
 * @param options - Performance score options
 * @returns Score from 0-100
 */
export function calculatePerformanceScore(options: {
  phMetrics: TimeInBandMetrics;
  ecMetrics: TimeInBandMetrics;
  correctionMetrics: CorrectionMetrics;
  deviationPatterns: DeviationPattern[];
}): number {
  const { phMetrics, ecMetrics, correctionMetrics, deviationPatterns } =
    options;
  // Weight factors
  const PH_WEIGHT = 0.35;
  const EC_WEIGHT = 0.35;
  const CORRECTION_WEIGHT = 0.2;
  const PATTERN_WEIGHT = 0.1;

  // pH score (% time in band)
  const phScore = phMetrics.percentageInBand;

  // EC score (% time in band)
  const ecScore = ecMetrics.percentageInBand;

  // Correction score (inverse of median correction time, capped at 24h)
  const maxCorrectionMs = 24 * 60 * 60 * 1000; // 24 hours
  const correctionScore =
    correctionMetrics.totalCorrections > 0
      ? (1 -
          Math.min(correctionMetrics.medianCorrectionTimeMs, maxCorrectionMs) /
            maxCorrectionMs) *
        100
      : 100;

  // Pattern score (penalize increasing trends)
  const increasingPatterns = deviationPatterns.filter(
    (p) => p.trend === 'increasing'
  ).length;
  const patternScore = Math.max(0, 100 - increasingPatterns * 20); // -20 per increasing pattern

  // Weighted average
  const overallScore =
    phScore * PH_WEIGHT +
    ecScore * EC_WEIGHT +
    correctionScore * CORRECTION_WEIGHT +
    patternScore * PATTERN_WEIGHT;

  return Math.round(overallScore);
}

// ============================================================================
// Insight Generation
// ============================================================================

/**
 * Generates performance insights
 *
 * @param options - Insight generation options
 * @returns Array of insight strings
 */
export function generateInsights(options: {
  phMetrics: TimeInBandMetrics;
  ecMetrics: TimeInBandMetrics;
  correctionMetrics: CorrectionMetrics;
  deviationPatterns: DeviationPattern[];
}): string[] {
  const { phMetrics, ecMetrics, correctionMetrics, deviationPatterns } =
    options;
  const insights: string[] = [];

  // pH insights
  if (phMetrics.percentageInBand >= 90) {
    insights.push('Excellent pH stability maintained throughout period');
  } else if (phMetrics.percentageInBand < 70) {
    insights.push('pH frequently out of range - review calibration and dosing');
  }

  if (phMetrics.longestStreak >= 20) {
    insights.push(
      `Strong pH management: ${phMetrics.longestStreak} consecutive readings in range`
    );
  }

  // EC insights
  if (ecMetrics.percentageInBand >= 90) {
    insights.push('Excellent EC stability maintained throughout period');
  } else if (ecMetrics.percentageInBand < 70) {
    insights.push('EC frequently out of range - review feeding schedule');
  }

  // Correction insights
  if (correctionMetrics.totalCorrections > 0) {
    const medianHours = Math.round(
      correctionMetrics.medianCorrectionTimeMs / (60 * 60 * 1000)
    );
    if (medianHours <= 2) {
      insights.push(
        `Fast response time: typically corrected within ${medianHours}h`
      );
    } else if (medianHours > 12) {
      insights.push(
        `Slow corrections: median ${medianHours}h - consider more frequent monitoring`
      );
    }
  }

  // Pattern insights
  const increasingPatterns = deviationPatterns.filter(
    (p) => p.trend === 'increasing'
  );
  if (increasingPatterns.length > 0) {
    const types = increasingPatterns.map((p) => p.type).join(', ');
    insights.push(
      `Increasing frequency of ${types} deviations - investigate root cause`
    );
  }

  return insights;
}

/**
 * Generates performance recommendations
 *
 * @param options - Recommendation generation options
 * @returns Array of recommendation strings
 */
export function generateRecommendations(options: {
  phMetrics: TimeInBandMetrics;
  ecMetrics: TimeInBandMetrics;
  correctionMetrics: CorrectionMetrics;
  deviationPatterns: DeviationPattern[];
}): string[] {
  const { phMetrics, ecMetrics, correctionMetrics, deviationPatterns } =
    options;
  const recommendations: string[] = [];

  // pH recommendations
  if (phMetrics.percentageInBand < 80) {
    recommendations.push(
      'Consider adjusting target pH range for your growing medium'
    );
    recommendations.push(
      'Verify meter calibration with fresh buffer solutions'
    );
  }

  // EC recommendations
  if (ecMetrics.percentageInBand < 80) {
    recommendations.push(
      'Review and adjust feeding template for better EC control'
    );
    recommendations.push('Monitor source water EC variations');
  }

  // Correction recommendations
  if (
    correctionMetrics.totalCorrections > 0 &&
    correctionMetrics.medianCorrectionTimeMs > 12 * 60 * 60 * 1000
  ) {
    recommendations.push(
      'Increase monitoring frequency to catch deviations earlier'
    );
    recommendations.push('Set up automated alerts for faster response');
  }

  // Pattern-based recommendations
  for (const pattern of deviationPatterns) {
    if (pattern.trend === 'increasing' && pattern.frequency > 0.5) {
      // More than every 2 days
      if (pattern.type === 'ph_high' || pattern.type === 'ph_low') {
        recommendations.push(
          'Persistent pH drift detected - check alkalinity and adjust dosing strategy'
        );
      } else if (pattern.type === 'ec_high' || pattern.type === 'ec_low') {
        recommendations.push(
          'EC instability detected - review reservoir management and evaporation rates'
        );
      }
    }
  }

  // Remove duplicates
  return [...new Set(recommendations)];
}

// ============================================================================
// Report Generation
// ============================================================================

/**
 * Creates empty performance report when no readings available
 */
function createEmptyReport(reservoirId: string): PerformanceReport {
  return {
    reservoirId,
    dateRange: { start: 0, end: 0 },
    phMetrics: {
      totalReadings: 0,
      readingsInBand: 0,
      readingsOutOfBand: 0,
      percentageInBand: 0,
      longestStreak: 0,
      currentStreak: 0,
    },
    ecMetrics: {
      totalReadings: 0,
      readingsInBand: 0,
      readingsOutOfBand: 0,
      percentageInBand: 0,
      longestStreak: 0,
      currentStreak: 0,
    },
    correctionMetrics: {
      totalCorrections: 0,
      medianCorrectionTimeMs: 0,
      averageCorrectionTimeMs: 0,
      fastestCorrectionMs: 0,
      slowestCorrectionMs: 0,
    },
    deviationPatterns: [],
    overallScore: 0,
    insights: [],
    recommendations: ['No data available - start logging readings'],
  };
}

/**
 * Generates comprehensive performance report
 *
 * @param options - Report generation options
 * @returns Performance report
 */

export function generatePerformanceReport(options: {
  reservoirId: string;
  readings: PhEcReading[];
  alerts: DeviationAlert[];
  reservoir?: Reservoir;
}): PerformanceReport {
  const { reservoirId, readings, alerts, reservoir } = options;
  if (readings.length === 0) {
    return createEmptyReport(reservoirId);
  }

  // Sort by time
  const sortedReadings = [...readings].sort(
    (a, b) => a.measuredAt - b.measuredAt
  );
  const sortedAlerts = [...alerts].sort(
    (a, b) => a.triggeredAt - b.triggeredAt
  );

  // Date range
  const dateRange = {
    start: sortedReadings[0].measuredAt,
    end: sortedReadings[sortedReadings.length - 1].measuredAt,
  };

  // Calculate target bands
  const targetBands = reservoir
    ? {
        ph: {
          min: reservoir.targetPhMin ?? 5.4,
          max: reservoir.targetPhMax ?? 6.4,
        },
        ec: {
          min: reservoir.targetEcMin25c ?? 0.8,
          max: reservoir.targetEcMax25c ?? 2.5,
        },
      }
    : calculateTargetBands(sortedReadings);

  // Calculate metrics
  const phMetrics = calculateTimeInBand(sortedReadings, targetBands.ph, 'ph');
  const ecMetrics = calculateTimeInBand(sortedReadings, targetBands.ec, 'ec');
  const correctionMetrics = calculateCorrectionMetrics(sortedAlerts);
  const deviationPatterns = analyzeDeviationPatterns(sortedAlerts);

  // Calculate score
  const overallScore = calculatePerformanceScore({
    phMetrics,
    ecMetrics,
    correctionMetrics,
    deviationPatterns,
  });

  // Generate insights and recommendations
  const insights = generateInsights({
    phMetrics,
    ecMetrics,
    correctionMetrics,
    deviationPatterns,
  });
  const recommendations = generateRecommendations({
    phMetrics,
    ecMetrics,
    correctionMetrics,
    deviationPatterns,
  });

  return {
    reservoirId,
    dateRange,
    phMetrics,
    ecMetrics,
    correctionMetrics,
    deviationPatterns,
    overallScore,
    insights,
    recommendations,
  };
}
