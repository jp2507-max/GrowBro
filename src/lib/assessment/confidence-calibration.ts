/**
 * Confidence Calibration Module
 *
 * Implements temperature scaling for ML model confidence calibration
 * to improve reliability of confidence scores.
 *
 * Requirements:
 * - 2.2: Store both raw_confidence and calibrated_confidence
 * - 2.3: Threshold decisions based on calibrated confidence (0.70 cutoff)
 * - Design: Temperature scaling calibration with offline validation
 */

export type CalibrationConfig = {
  temperature: number;
  classThresholds: Record<string, number>;
  globalThreshold: number;
  version: string;
  calibratedAt: string;
};

export type ConfidenceCalibrationResult = {
  rawConfidence: number;
  calibratedConfidence: number;
  isConfident: boolean;
  threshold: number;
  classId?: string;
};

const DEFAULT_TEMPERATURE = 1.5;
const DEFAULT_GLOBAL_THRESHOLD = 0.7;

/**
 * Default calibration configuration
 * Temperature > 1.0 makes the model less confident (softens probabilities)
 * Temperature < 1.0 makes the model more confident (sharpens probabilities)
 *
 * Uses logit-based temperature scaling: logit(p)/T → sigmoid
 */
const DEFAULT_CALIBRATION_CONFIG: CalibrationConfig = {
  temperature: DEFAULT_TEMPERATURE,
  classThresholds: {
    healthy: 0.75,
    unknown: 0.7,
    nitrogen_deficiency: 0.68,
    phosphorus_deficiency: 0.68,
    potassium_deficiency: 0.68,
    magnesium_deficiency: 0.65,
    calcium_deficiency: 0.65,
    overwatering: 0.72,
    underwatering: 0.72,
    light_burn: 0.7,
    spider_mites: 0.65,
    powdery_mildew: 0.65,
  },
  globalThreshold: DEFAULT_GLOBAL_THRESHOLD,
  version: '1.0.0',
  calibratedAt: new Date().toISOString(),
};

let currentConfig: CalibrationConfig = DEFAULT_CALIBRATION_CONFIG;

/**
 * Apply temperature scaling to raw confidence score
 *
 * Uses logit-based temperature scaling:
 * 1. Clamp p into (eps, 1-eps) to avoid division by zero/inf
 * 2. Compute logit = ln(p/(1-p))
 * 3. Scale logit by dividing by T
 * 4. Convert back via sigmoid: 1 / (1 + exp(-logit/T))
 * 5. Clamp final output to [0,1]
 *
 * @param rawConfidence - Raw model output confidence (0-1)
 * @param temperature - Temperature parameter (default from config)
 * @returns Calibrated confidence score (0-1)
 */
export function applyTemperatureScaling(
  rawConfidence: number,
  temperature: number = currentConfig.temperature
): number {
  if (rawConfidence <= 0) return 0;
  if (rawConfidence >= 1) return 1;
  if (temperature <= 0) return rawConfidence;

  // Small epsilon to avoid division by zero or infinity
  const eps = 1e-12;
  const clamped = Math.max(eps, Math.min(1 - eps, rawConfidence));

  // Compute logit: ln(p/(1-p))
  const logit = Math.log(clamped / (1 - clamped));

  // Scale logit by temperature: logit/T
  const scaledLogit = logit / temperature;

  // Convert back via sigmoid: 1 / (1 + exp(-scaledLogit))
  const calibrated = 1 / (1 + Math.exp(-scaledLogit));

  // Clamp to [0, 1] range (additional safety check)
  return Math.max(0, Math.min(1, calibrated));
}

/**
 * Calibrate confidence score and determine if it meets threshold
 *
 * @param rawConfidence - Raw model output confidence (0-1)
 * @param classId - Optional class ID for class-specific threshold
 * @returns Calibration result with raw, calibrated confidence and threshold decision
 */
export function calibrateConfidence(
  rawConfidence: number,
  classId?: string
): ConfidenceCalibrationResult {
  const calibratedConfidence = applyTemperatureScaling(rawConfidence);

  // Use class-specific threshold if available, otherwise global threshold
  const threshold = classId
    ? (currentConfig.classThresholds[classId] ?? currentConfig.globalThreshold)
    : currentConfig.globalThreshold;

  const isConfident = calibratedConfidence >= threshold;

  return {
    rawConfidence,
    calibratedConfidence,
    isConfident,
    threshold,
    classId,
  };
}

/**
 * Calibrate multiple predictions and apply aggregation rules
 *
 * Aggregation rules:
 * 1. Majority vote on class predictions
 * 2. If tie, use highest calibrated confidence
 * 3. If all predictions below threshold, mark as not confident
 *
 * @param predictions - Array of predictions with class IDs and raw confidences
 * @returns Aggregated calibration result
 */
export function calibrateMultiplePredictions(
  predictions: { classId: string; rawConfidence: number }[]
): ConfidenceCalibrationResult & {
  aggregationMethod: 'majority-vote' | 'highest-confidence';
  perPrediction: ConfidenceCalibrationResult[];
} {
  if (predictions.length === 0) {
    return {
      rawConfidence: 0,
      calibratedConfidence: 0,
      isConfident: false,
      threshold: currentConfig.globalThreshold,
      aggregationMethod: 'majority-vote',
      perPrediction: [],
    };
  }

  // Calibrate each prediction
  const calibrated = predictions.map((pred) =>
    calibrateConfidence(pred.rawConfidence, pred.classId)
  );

  // Count votes per class
  const voteCounts = new Map<string, number>();
  predictions.forEach((pred) => {
    voteCounts.set(pred.classId, (voteCounts.get(pred.classId) ?? 0) + 1);
  });

  // Find class with most votes
  let maxVotes = 0;
  let winningClasses: string[] = [];
  voteCounts.forEach((count, classId) => {
    if (count > maxVotes) {
      maxVotes = count;
      winningClasses = [classId];
    } else if (count === maxVotes) {
      winningClasses.push(classId);
    }
  });

  let finalResult: ConfidenceCalibrationResult;
  let aggregationMethod: 'majority-vote' | 'highest-confidence';

  if (winningClasses.length === 1) {
    // Clear winner by majority vote
    const winningClass = winningClasses[0];
    const winningPredictions = calibrated.filter(
      (c, i) => predictions[i].classId === winningClass
    );
    // Use highest confidence among winning class predictions
    finalResult = winningPredictions.reduce((best, current) =>
      current.calibratedConfidence > best.calibratedConfidence ? current : best
    );
    aggregationMethod = 'majority-vote';
  } else {
    // Tie - use highest calibrated confidence
    finalResult = calibrated.reduce((best, current) =>
      current.calibratedConfidence > best.calibratedConfidence ? current : best
    );
    aggregationMethod = 'highest-confidence';
  }

  // Check if all predictions are below threshold
  const allBelowThreshold = calibrated.every((c) => !c.isConfident);
  if (allBelowThreshold) {
    finalResult = {
      ...finalResult,
      isConfident: false,
    };
  }

  return {
    ...finalResult,
    aggregationMethod,
    perPrediction: calibrated,
  };
}

/**
 * Update calibration configuration
 *
 * @param config - New calibration configuration
 */
export function setCalibrationConfig(config: Partial<CalibrationConfig>): void {
  const mergedConfig = {
    ...currentConfig,
    ...config,
    classThresholds: {
      ...currentConfig.classThresholds,
      ...(config.classThresholds ?? {}),
    },
  };
  if (!validateCalibrationConfig(mergedConfig)) {
    throw new Error('Invalid calibration configuration');
  }
  currentConfig = mergedConfig;
}

/**
 * Get current calibration configuration
 */
export function getCalibrationConfig(): CalibrationConfig {
  return structuredClone(currentConfig);
}

/**
 * Reset calibration configuration to defaults
 */
export function resetCalibrationConfig(): void {
  currentConfig = { ...DEFAULT_CALIBRATION_CONFIG };
}

/**
 * Validate calibration configuration
 *
 * @param config - Configuration to validate
 * @returns True if valid, false otherwise
 */
export function validateCalibrationConfig(
  config: Partial<CalibrationConfig>
): boolean {
  if (config.temperature !== undefined) {
    if (config.temperature <= 0 || config.temperature > 10) {
      return false;
    }
  }

  if (config.globalThreshold !== undefined) {
    if (config.globalThreshold < 0 || config.globalThreshold > 1) {
      return false;
    }
  }

  if (config.classThresholds) {
    for (const threshold of Object.values(config.classThresholds)) {
      if (threshold < 0 || threshold > 1) {
        return false;
      }
    }
  }

  return true;
}
