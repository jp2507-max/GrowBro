/**
 * Nutrient Engine and pH/EC System
 *
 * This module provides comprehensive feeding management capabilities including:
 * - EC/pH conversion utilities with temperature compensation
 * - Type definitions for feeding templates, measurements, and diagnostics
 * - Quality assessment and confidence scoring
 * - Alert evaluation and deviation detection
 * - Notification delivery for pH/EC alerts
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

// Export alert evaluation utilities
export {
  COOLDOWN_MS,
  DEAD_BAND,
  evaluateReadingAgainstTargets,
  generateRecommendations,
  MIN_PERSIST_MS,
  TEMP_HIGH_THRESHOLD,
} from './utils/alert-evaluation';

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

// Export alert services
export {
  acknowledgeAlert,
  createAlert,
  evaluateAndTriggerAlert,
  getActiveAlerts,
  getAlertHistory,
  getOfflineAlerts,
  getUnacknowledgedAlerts,
  markAlertDeliveredLocally,
  observeActiveAlerts,
  resolveAlert,
} from './services/alert-service';

// Export notification services
export {
  cancelAlertNotification,
  cancelReservoirAlerts,
  canSendNotifications,
  deliverOfflineAlert,
  openNotificationSettings,
  scheduleAlertNotification,
} from './services/alert-notification-service';

// Export reservoir services
export {
  assignSourceWaterProfile,
  createReservoir,
  type CreateReservoirData,
  deleteReservoir,
  getReservoir,
  listReservoirs,
  modelToReservoir,
  observeReservoir,
  observeReservoirs,
  updateReservoir,
  type UpdateReservoirData,
} from './services/reservoir-service';

// Export source water profile services
export {
  createSourceWaterProfile,
  type CreateSourceWaterProfileData,
  deleteSourceWaterProfile,
  getSourceWaterProfile,
  listSourceWaterProfiles,
  modelToSourceWaterProfile,
  observeSourceWaterProfile,
  observeSourceWaterProfiles,
  updateSourceWaterProfile,
  type UpdateSourceWaterProfileData,
} from './services/source-water-profile-service';

// Export alkalinity warning utilities
export {
  ALKALINITY_THRESHOLDS,
  type AlkalinityRiskLevel,
  type AlkalinityWarning,
  getAlkalinityEducationalContent,
  getAlkalinityRiskLevel,
  getAlkalinityTestingGuidance,
  getAlkalinityWarning,
  shouldShowAlkalinityWarning,
} from './utils/alkalinity-warnings';

// Export annual reminder utilities
export {
  ANNUAL_REMINDER_INTERVAL_MS,
  EARLY_REMINDER_THRESHOLD_MS,
  getAnnualTestingEducationalContent,
  getDaysOverdue,
  getDaysUntilReminder,
  getReminderMessage,
  getWaterTestingChecklist,
  type ReminderMessage,
  shouldShowAnnualReminder,
  shouldShowEarlyReminder,
} from './utils/annual-reminder';

// Export template services
export {
  applyStrainAdjustments,
  createStarterTemplate,
  createTemplate,
  type CreateTemplateOptions,
  deleteTemplate,
  getDefaultPhaseConfig,
  getTemplate,
  listTemplates,
  type StrainAdjustment,
  TemplateValidationError,
  updateTemplate,
  type UpdateTemplateOptions,
  validatePhase,
  validateTemplate,
} from './services/template-service';

// Export schedule services
export {
  applyUndo,
  calculateDoseGuidance,
  createCalendarTaskFromEvent,
  type DoseGuidance,
  type FeedingEvent,
  type FeedingSchedule,
  generateSchedule,
  type ScheduleUndoState,
  shiftSchedule,
} from './services/schedule-service';

// Export hooks
export type { UseAlertEvaluationReturn } from './hooks/use-alert-evaluation';
export { useAlertEvaluation } from './hooks/use-alert-evaluation';
