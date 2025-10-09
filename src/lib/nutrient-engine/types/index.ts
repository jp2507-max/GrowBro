/**
 * Type definitions for the Nutrient Engine and pH/EC system
 *
 * This module provides TypeScript types for feeding templates, measurements,
 * alerts, diagnostics, and calibration management.
 */

// ============================================================================
// Enums (as const objects with literal union types)
// ============================================================================

/**
 * PPM scale for EC to PPM conversion
 * - PPM_500: NaCl/TDS scale (500 ppm = 1.0 mS/cm)
 * - PPM_700: 442/KCl scale (700 ppm = 1.0 mS/cm)
 */
export const PpmScale = {
  PPM_500: '500',
  PPM_700: '700',
} as const;

export type PpmScale = (typeof PpmScale)[keyof typeof PpmScale];

/**
 * Growing medium types
 */
export const GrowingMedium = {
  SOIL: 'soil',
  COCO: 'coco',
  HYDRO: 'hydro',
  SOILLESS: 'soilless',
  PEAT: 'peat',
} as const;

export type GrowingMedium = (typeof GrowingMedium)[keyof typeof GrowingMedium];

/**
 * Plant growth phases
 */
export const PlantPhase = {
  SEEDLING: 'seedling',
  VEGETATIVE: 'veg',
  FLOWERING: 'flower',
  FLUSH: 'flush',
} as const;

export type PlantPhase = (typeof PlantPhase)[keyof typeof PlantPhase];

/**
 * Alert types for deviation detection
 */
export const AlertType = {
  PH_HIGH: 'ph_high',
  PH_LOW: 'ph_low',
  EC_HIGH: 'ec_high',
  EC_LOW: 'ec_low',
  CALIBRATION_STALE: 'calibration_stale',
  TEMP_HIGH: 'temp_high',
} as const;

export type AlertType = (typeof AlertType)[keyof typeof AlertType];

/**
 * Alert severity levels
 */
export const AlertSeverity = {
  INFO: 'info',
  WARNING: 'warning',
  CRITICAL: 'critical',
} as const;

export type AlertSeverity = (typeof AlertSeverity)[keyof typeof AlertSeverity];

/**
 * Nutrient issue types for diagnostics
 */
export const IssueType = {
  DEFICIENCY: 'deficiency',
  TOXICITY: 'toxicity',
  LOCKOUT: 'lockout',
  PH_DRIFT: 'ph_drift',
} as const;

export type IssueType = (typeof IssueType)[keyof typeof IssueType];

/**
 * Issue severity levels
 */
export const IssueSeverity = {
  MILD: 'mild',
  MODERATE: 'moderate',
  SEVERE: 'severe',
} as const;

export type IssueSeverity = (typeof IssueSeverity)[keyof typeof IssueSeverity];

/**
 * Calibration types for pH and EC meters
 */
export const CalibrationType = {
  PH: 'ph',
  EC: 'ec',
} as const;

export type CalibrationType =
  (typeof CalibrationType)[keyof typeof CalibrationType];

/**
 * Reservoir event types for tracking changes
 */
export const ReservoirEventKind = {
  FILL: 'FILL',
  DILUTE: 'DILUTE',
  ADD_NUTRIENT: 'ADD_NUTRIENT',
  PH_UP: 'PH_UP',
  PH_DOWN: 'PH_DOWN',
  CHANGE: 'CHANGE',
} as const;

export type ReservoirEventKind =
  (typeof ReservoirEventKind)[keyof typeof ReservoirEventKind];

/**
 * Quality flags for pH/EC readings
 */
export const QualityFlag = {
  NO_ATC: 'NO_ATC',
  CAL_STALE: 'CAL_STALE',
  TEMP_HIGH: 'TEMP_HIGH',
  OUTLIER: 'OUTLIER',
} as const;

export type QualityFlag = (typeof QualityFlag)[keyof typeof QualityFlag];

/**
 * Calibration methods
 */
export const CalibrationMethod = {
  ONE_POINT: 'one_point',
  TWO_POINT: 'two_point',
  THREE_POINT: 'three_point',
} as const;

export type CalibrationMethod =
  (typeof CalibrationMethod)[keyof typeof CalibrationMethod];

/**
 * Confidence source for diagnostic results
 */
export const ConfidenceSource = {
  RULES: 'rules',
  AI: 'ai',
  HYBRID: 'hybrid',
} as const;

export type ConfidenceSource =
  (typeof ConfidenceSource)[keyof typeof ConfidenceSource];

// ============================================================================
// Domain Model Types
// ============================================================================

/**
 * Nutrient ratio for a specific nutrient in a feeding phase
 */
export type NutrientRatio = {
  nutrient: string; // e.g., 'N', 'P', 'K', 'Ca', 'Mg' or product name
  value: number; // concentration in ml/L or ppm
  unit: string; // 'ml/L', 'ppm', 'g/L'
};

/**
 * Feeding phase configuration within a template
 * Specifies target ranges (not single points) for pH and EC
 */
export type FeedingPhase = {
  phase: PlantPhase;
  durationDays: number; // default duration, user can adjust
  nutrients: NutrientRatio[];
  phRange: [number, number]; // [min, max] target pH band
  ecRange25c: [number, number]; // [min, max] target EC@25°C band (mS/cm)
};

/**
 * Feeding template for a specific growing medium
 * Defines complete feeding schedule across all growth phases
 */
export type FeedingTemplate = {
  id: string;
  name: string;
  medium: GrowingMedium;
  phases: FeedingPhase[];
  isCustom?: boolean;
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
};

/**
 * pH/EC reading with temperature compensation
 * Stores both raw and temperature-compensated EC values
 */
export type PhEcReading = {
  id: string;
  plantId?: string;
  reservoirId?: string;
  measuredAt: number; // epoch ms
  ph: number; // pH value (0-14)
  ecRaw: number; // raw EC reading (mS/cm)
  ec25c: number; // temperature compensated to 25°C (mS/cm)
  tempC: number; // temperature in Celsius
  atcOn: boolean; // auto temperature compensation enabled on meter
  ppmScale: PpmScale; // scale used for PPM display
  meterId?: string;
  note?: string;
  qualityFlags?: QualityFlag[]; // computed quality indicators
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
};

/**
 * Reservoir configuration with target ranges
 */
export type Reservoir = {
  id: string;
  name: string;
  volumeL: number; // volume in liters
  medium: GrowingMedium;
  targetPhMin: number;
  targetPhMax: number;
  targetEcMin25c: number; // mS/cm @25°C
  targetEcMax25c: number; // mS/cm @25°C
  ppmScale: PpmScale;
  sourceWaterProfileId?: string;
  playbookBinding?: string;
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
};

/**
 * Source water profile for baseline water quality
 */
export type SourceWaterProfile = {
  id: string;
  name: string;
  baselineEc25c: number; // baseline EC @25°C (mS/cm)
  alkalinityMgPerLCaco3: number; // alkalinity as CaCO₃ (mg/L)
  hardnessMgPerL: number; // total hardness (mg/L)
  lastTestedAt: number; // epoch ms
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
};

/**
 * Calibration point for meter calibration
 */
export type CalibrationPoint = {
  expected: number; // expected standard value
  measured: number; // measured value from meter
  stabilizationTime: number; // seconds to stabilize
};

/**
 * Meter calibration record
 */
export type Calibration = {
  id: string;
  meterId: string;
  type: CalibrationType;
  points: CalibrationPoint[];
  slope: number;
  offset: number;
  tempC: number;
  method?: CalibrationMethod;
  validDays?: number; // validity period in days
  performedAt: number; // epoch ms
  expiresAt: number; // epoch ms
  isValid: boolean;
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
};

/**
 * Deviation alert for out-of-range measurements
 */
export type DeviationAlert = {
  id: string;
  readingId: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  recommendations: string[];
  recommendationCodes: string[]; // e.g., ['DILUTE_10PCT', 'ADJUST_PH_DOWN']
  cooldownUntil?: number; // epoch ms to prevent alert spam
  triggeredAt: number; // epoch ms
  acknowledgedAt?: number; // epoch ms
  resolvedAt?: number; // epoch ms
  deliveredAtLocal?: number; // epoch ms for offline alerts
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
};

/**
 * Reservoir event for tracking changes
 */
export type ReservoirEvent = {
  id: string;
  reservoirId: string;
  kind: ReservoirEventKind;
  deltaEc25c?: number; // change in EC (mS/cm)
  deltaPh?: number; // change in pH
  note?: string;
  createdAt: number; // epoch ms
  updatedAt: number; // epoch ms
};

/**
 * Symptom for diagnostic classification
 */
export type Symptom = {
  type: string; // e.g., 'yellowing', 'necrosis', 'curling'
  location: string; // e.g., 'lower_leaves', 'upper_leaves', 'tips'
  severity: IssueSeverity;
  description?: string;
};

/**
 * Nutrient issue classification
 */
export type NutrientIssue = {
  type: IssueType;
  nutrient?: string; // specific nutrient if applicable
  severity: IssueSeverity;
  likelyCauses: string[];
};

/**
 * Recommendation for addressing nutrient issues
 */
export type Recommendation = {
  action: string;
  priority: number; // 1 = highest
  description: string;
  code?: string; // machine-readable code
};

/**
 * Diagnostic result for nutrient issue classification
 */
export type DiagnosticResult = {
  id: string;
  plantId: string;
  symptoms: Symptom[];
  classification: NutrientIssue;
  confidence: number; // 0-1
  recommendations: Recommendation[];
  inputReadingIds?: string[]; // pH/EC readings used
  waterProfileId?: string; // source water profile considered
  confidenceSource: ConfidenceSource;
  rulesBased: boolean;
  aiOverride?: boolean;
  createdAt: number; // epoch ms
};

/**
 * Measurement mode for UI state
 */
export const MeasurementMode = {
  MANUAL: 'manual',
  BLUETOOTH: 'bluetooth',
} as const;

export type MeasurementMode =
  (typeof MeasurementMode)[keyof typeof MeasurementMode];

/**
 * Calibration status for validation
 */
export type CalibrationStatus = {
  isValid: boolean;
  daysUntilExpiry: number;
  lastCalibrationDate: number; // epoch ms
  needsCalibration: boolean;
};
