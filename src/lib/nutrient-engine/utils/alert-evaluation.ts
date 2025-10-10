/**
 * Alert evaluation utilities for pH/EC deviation detection
 *
 * Implements hysteresis (deadbands), persistence window, and per-reservoir cooldown
 * to prevent alert spam while ensuring timely notifications for actual issues.
 */

import type {
  AlertSeverity,
  AlertType,
  DeviationAlert,
  PhEcReading,
  Reservoir,
} from '@/lib/nutrient-engine/types';

// ============================================================================
// Constants and Configuration
// ============================================================================

/**
 * Deadband thresholds to prevent alert thrashing from small fluctuations
 * Values represent the buffer zone beyond target ranges before triggering alerts
 */
export const DEAD_BAND = {
  ph: 0.1, // pH units
  ec: 0.1, // mS/cm
} as const;

/**
 * Minimum persistence window (ms) - reading must be out of range for this duration
 * before triggering an alert to avoid false positives from transient spikes
 */
export const MIN_PERSIST_MS = 5 * 60_000; // 5 minutes

/**
 * Cooldown period (ms) per reservoir per alert type to prevent notification spam
 */
export const COOLDOWN_MS = 60 * 60_000; // 60 minutes

/**
 * Temperature threshold for high temperature warnings (°C)
 */
export const TEMP_HIGH_THRESHOLD = 28;

// ============================================================================
// Alert Evaluation Logic
// ============================================================================

/**
 * Evaluates a pH/EC reading against reservoir target ranges
 * Returns a deviation alert if out of bounds, considering deadbands, persistence, and cooldown
 */
export function evaluateReadingAgainstTargets(options: {
  reading: PhEcReading;
  reservoir: Reservoir;
  recentReadings: PhEcReading[];
  activeAlerts: DeviationAlert[];
}): DeviationAlert | null {
  const { reading, reservoir, recentReadings, activeAlerts } = options;
  const now = Date.now();

  // Check pH deviation
  const phDeviation = checkPhDeviation(reading, reservoir);
  if (phDeviation) {
    if (
      shouldTriggerAlert({
        alertType: phDeviation,
        currentReading: reading,
        recentReadings,
        activeAlerts,
        now,
        metric: 'ph',
      })
    ) {
      return createAlert(phDeviation, reading, reservoir);
    }
  }

  // Check EC deviation
  const ecDeviation = checkEcDeviation(reading, reservoir);
  if (ecDeviation) {
    if (
      shouldTriggerAlert({
        alertType: ecDeviation,
        currentReading: reading,
        recentReadings,
        activeAlerts,
        now,
        metric: 'ec',
      })
    ) {
      return createAlert(ecDeviation, reading, reservoir);
    }
  }

  // Check temperature warning
  if (reading.tempC >= TEMP_HIGH_THRESHOLD) {
    const tempAlertType: AlertType = 'temp_high';
    if (!isInCooldown(tempAlertType, activeAlerts, now)) {
      return createAlert(tempAlertType, reading, reservoir);
    }
  }

  return null;
}

/**
 * Checks if pH reading is outside target range considering deadband
 */
function checkPhDeviation(
  reading: PhEcReading,
  reservoir: Reservoir
): AlertType | null {
  const { ph } = reading;
  const { targetPhMin, targetPhMax } = reservoir;

  if (ph > targetPhMax + DEAD_BAND.ph) {
    return 'ph_high';
  }
  if (ph < targetPhMin - DEAD_BAND.ph) {
    return 'ph_low';
  }
  return null;
}

/**
 * Checks if EC reading is outside target range considering deadband
 */
function checkEcDeviation(
  reading: PhEcReading,
  reservoir: Reservoir
): AlertType | null {
  const { ec25c } = reading;
  const { targetEcMin25c, targetEcMax25c } = reservoir;

  if (ec25c > targetEcMax25c + DEAD_BAND.ec) {
    return 'ec_high';
  }
  if (ec25c < targetEcMin25c - DEAD_BAND.ec) {
    return 'ec_low';
  }
  return null;
}

/**
 * Determines if alert should be triggered based on persistence and cooldown
 */
function shouldTriggerAlert(options: {
  alertType: AlertType;
  currentReading: PhEcReading;
  recentReadings: PhEcReading[];
  activeAlerts: DeviationAlert[];
  now: number;
  metric: 'ph' | 'ec';
}): boolean {
  const {
    alertType,
    currentReading,
    recentReadings,
    activeAlerts,
    now,
    metric,
  } = options;

  // Check cooldown first (fast path)
  if (isInCooldown(alertType, activeAlerts, now)) {
    return false;
  }

  // Check persistence - need readings outside range for MIN_PERSIST_MS
  return checkPersistence({
    alertType,
    currentReading,
    recentReadings,
    now,
    metric,
  });
}

/**
 * Creates a deviation alert with appropriate message and recommendations
 */
function createAlert(
  alertType: AlertType,
  reading: PhEcReading,
  reservoir: Reservoir
): DeviationAlert {
  const now = Date.now();
  const { message, severity } = generateAlertMessage(
    alertType,
    reading,
    reservoir
  );
  const { recommendations, recommendationCodes } = generateRecommendations(
    alertType,
    reading,
    reservoir
  );

  return {
    id: `alert_${now}_${reading.id}`, // Temporary ID, will be replaced by DB
    readingId: reading.id,
    type: alertType,
    severity,
    message,
    recommendations,
    recommendationCodes,
    cooldownUntil: now + COOLDOWN_MS,
    triggeredAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Checks if an alert type is currently in cooldown period
 */
function isInCooldown(
  alertType: AlertType,
  activeAlerts: DeviationAlert[],
  now: number
): boolean {
  const relevantAlert = activeAlerts.find((alert) => alert.type === alertType);
  if (!relevantAlert) return false;

  return (
    relevantAlert.cooldownUntil !== undefined &&
    relevantAlert.cooldownUntil > now
  );
}

/**
 * Checks if readings have persisted outside range for minimum duration
 * Simplified: check if any reading >= MIN_PERSIST_MS ago was also out of range
 */
function checkPersistence(options: {
  alertType: AlertType;
  currentReading: PhEcReading;
  recentReadings: PhEcReading[];
  now: number;
  metric: 'ph' | 'ec';
}): boolean {
  const { alertType, currentReading, recentReadings, now, metric } = options;
  // If no recent readings, can't verify persistence
  if (recentReadings.length === 0) {
    return false;
  }

  // Find oldest reading that is at least MIN_PERSIST_MS ago
  const oldEnoughTime = now - MIN_PERSIST_MS;
  const oldReadings = recentReadings.filter(
    (r) => r.measuredAt <= oldEnoughTime
  );

  if (oldReadings.length === 0) {
    return false;
  }

  // Check if at least one old reading was also out of range in the same direction
  const hasOldOutOfRangeReading = oldReadings.some((reading) => {
    if (metric === 'ph') {
      if (alertType === 'ph_high') {
        // Old reading was also high (within 0.5 pH units of current)
        return reading.ph >= currentReading.ph - 0.5;
      }
      if (alertType === 'ph_low') {
        // Old reading was also low (within 0.5 pH units of current)
        return reading.ph <= currentReading.ph + 0.5;
      }
    } else if (metric === 'ec') {
      if (alertType === 'ec_high') {
        // Old reading was also high (within 0.5 mS/cm of current)
        return reading.ec25c >= currentReading.ec25c - 0.5;
      }
      if (alertType === 'ec_low') {
        // Old reading was also low (within 0.5 mS/cm of current)
        return reading.ec25c <= currentReading.ec25c + 0.5;
      }
    }
    return false;
  });

  return hasOldOutOfRangeReading;
}

/**
 * Generates alert message based on type and reading values
 */
function generateAlertMessage(
  alertType: AlertType,
  reading: PhEcReading,
  reservoir: Reservoir
): { message: string; severity: AlertSeverity } {
  switch (alertType) {
    case 'ph_high':
      return {
        message: `pH ${reading.ph.toFixed(1)} (target ${reservoir.targetPhMin.toFixed(1)}-${reservoir.targetPhMax.toFixed(1)})`,
        severity: 'warning',
      };
    case 'ph_low':
      return {
        message: `pH ${reading.ph.toFixed(1)} (target ${reservoir.targetPhMin.toFixed(1)}-${reservoir.targetPhMax.toFixed(1)})`,
        severity: 'warning',
      };
    case 'ec_high':
      return {
        message: `EC ${reading.ec25c.toFixed(2)} mS/cm @25°C (target ${reservoir.targetEcMin25c.toFixed(2)}-${reservoir.targetEcMax25c.toFixed(2)})`,
        severity: 'warning',
      };
    case 'ec_low':
      return {
        message: `EC ${reading.ec25c.toFixed(2)} mS/cm @25°C (target ${reservoir.targetEcMin25c.toFixed(2)}-${reservoir.targetEcMax25c.toFixed(2)})`,
        severity: 'warning',
      };
    case 'temp_high':
      return {
        message: `Temperature ${reading.tempC.toFixed(1)}°C is high - readings may be less accurate`,
        severity: 'info',
      };
    case 'calibration_stale':
      return {
        message:
          'Meter calibration is stale - consider recalibrating for accurate readings',
        severity: 'info',
      };
    default:
      return {
        message: 'Reading outside target range',
        severity: 'warning',
      };
  }
}

/**
 * Generates correction recommendations and machine-readable codes
 */
export function generateRecommendations(
  alertType: AlertType,
  reading: PhEcReading,
  reservoir: Reservoir
): { recommendations: string[]; recommendationCodes: string[] } {
  switch (alertType) {
    case 'ph_high':
      return generatePhHighRecommendations();
    case 'ph_low':
      return generatePhLowRecommendations();
    case 'ec_high':
      return generateEcHighRecommendations(reservoir);
    case 'ec_low':
      return generateEcLowRecommendations();
    case 'calibration_stale':
      return generateCalibrationStaleRecommendations();
    case 'temp_high':
      return generateTempHighRecommendations();
    default:
      return generateDefaultRecommendations();
  }
}

/**
 * Generates recommendations for pH high alerts
 */
function generatePhHighRecommendations(): {
  recommendations: string[];
  recommendationCodes: string[];
} {
  return {
    recommendations: [
      'Add pH down solution gradually',
      'Mix thoroughly and wait 15 minutes',
      'Recheck pH after adjustment',
      'Consider checking water alkalinity',
    ],
    recommendationCodes: [
      'ADJUST_PH_DOWN',
      'MIX_THOROUGH',
      'RECHECK_15MIN',
      'CHECK_ALKALINITY',
    ],
  };
}

/**
 * Generates recommendations for pH low alerts
 */
function generatePhLowRecommendations(): {
  recommendations: string[];
  recommendationCodes: string[];
} {
  return {
    recommendations: [
      'Add pH up solution gradually',
      'Mix thoroughly and wait 15 minutes',
      'Recheck pH after adjustment',
      'Verify pH meter calibration',
    ],
    recommendationCodes: [
      'ADJUST_PH_UP',
      'MIX_THOROUGH',
      'RECHECK_15MIN',
      'VERIFY_CALIBRATION',
    ],
  };
}

/**
 * Generates recommendations for EC high alerts
 */
function generateEcHighRecommendations(reservoir: Reservoir): {
  recommendations: string[];
  recommendationCodes: string[];
} {
  return {
    recommendations: [
      `Dilute reservoir by 10% (add ${(reservoir.volumeL * 0.1).toFixed(1)}L fresh water)`,
      'Mix thoroughly',
      'Recheck EC in 30 minutes',
      'Check for nutrient buildup or salt accumulation',
    ],
    recommendationCodes: [
      'DILUTE_10PCT',
      'MIX_THOROUGH',
      'RECHECK_30MIN',
      'CHECK_BUILDUP',
    ],
  };
}

/**
 * Generates recommendations for EC low alerts
 */
function generateEcLowRecommendations(): {
  recommendations: string[];
  recommendationCodes: string[];
} {
  return {
    recommendations: [
      'Add nutrients gradually according to your feeding schedule',
      'Mix thoroughly',
      'Recheck EC in 30 minutes',
      'Verify nutrient dosing calculations',
    ],
    recommendationCodes: [
      'ADD_NUTRIENTS',
      'MIX_THOROUGH',
      'RECHECK_30MIN',
      'VERIFY_DOSE',
    ],
  };
}

/**
 * Generates recommendations for calibration stale alerts
 */
function generateCalibrationStaleRecommendations(): {
  recommendations: string[];
  recommendationCodes: string[];
} {
  return {
    recommendations: [
      'Calibrate pH and EC meters with fresh calibration solutions',
      'Follow manufacturer calibration procedure',
      'Store probes properly in storage solution',
      'Verify readings with second meter if available',
    ],
    recommendationCodes: [
      'CALIBRATE_METER',
      'FOLLOW_PROCEDURE',
      'STORE_PROPERLY',
      'VERIFY_READINGS',
    ],
  };
}

/**
 * Generates recommendations for temperature high alerts
 */
function generateTempHighRecommendations(): {
  recommendations: string[];
  recommendationCodes: string[];
} {
  return {
    recommendations: [
      'Cool reservoir to 18-24°C for accurate readings',
      'Check ambient temperature',
      'Consider temperature compensation accuracy',
      'Wait for temperature to stabilize before taking readings',
    ],
    recommendationCodes: [
      'COOL_RESERVOIR',
      'CHECK_AMBIENT',
      'CHECK_ATC',
      'WAIT_STABILIZE',
    ],
  };
}

/**
 * Generates default recommendations
 */
function generateDefaultRecommendations(): {
  recommendations: string[];
  recommendationCodes: string[];
} {
  return {
    recommendations: ['Review reading and take corrective action'],
    recommendationCodes: ['REVIEW'],
  };
}
