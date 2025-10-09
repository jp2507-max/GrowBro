/**
 * Nutrient Engine and pH/EC System
 *
 * This module provides comprehensive feeding management capabilities including:
 * - EC/pH conversion utilities with temperature compensation
 * - Type definitions for feeding templates, measurements, and diagnostics
 * - Quality assessment and confidence scoring
 *
 * @module nutrient-engine
 */

// Export utility functions
export {
  calculateConfidenceScore,
  computeQualityFlags,
  ecToPpm,
  formatEcPpmDisplay,
  formatPpmWithScale,
  toEC25,
} from './utils/conversions';

// Export domain model types (non-enum types only)
export type {
  Calibration,
  CalibrationPoint,
  CalibrationStatus,
  DeviationAlert,
  DiagnosticResult,
  FeedingPhase,
  FeedingTemplate,
  NutrientIssue,
  NutrientRatio,
  PhEcReading,
  Recommendation,
  Reservoir,
  ReservoirEvent,
  SourceWaterProfile,
  Symptom,
} from './types';

// Export enum-like const objects (TypeScript allows importing both value and type)
export {
  AlertSeverity,
  AlertType,
  CalibrationMethod,
  CalibrationType,
  ConfidenceSource,
  GrowingMedium,
  IssueSeverity,
  IssueType,
  MeasurementMode,
  PlantPhase,
  PpmScale,
  QualityFlag,
  ReservoirEventKind,
} from './types';
