/**
 * Playbooks Module
 *
 * Exports playbook service and related utilities
 */

export type { OutboxWorkerOptions } from './outbox-worker';
export { OutboxWorker } from './outbox-worker';
export type {
  ApplyPlaybookOptions,
  PlaybookServiceOptions,
} from './playbook-service';
export { PlaybookService } from './playbook-service';
export type { ShiftOptions } from './schedule-shifter';
export { ScheduleShifter } from './schedule-shifter';
export type {
  TaskCustomizationOptions,
  TaskUpdateFields,
} from './task-customization';
export { TaskCustomizationService } from './task-customization';
export type {
  Plant,
  TaskGenerationResult,
  TaskGeneratorOptions,
} from './task-generator';
export { TaskGenerator } from './task-generator';
export type {
  SaveTemplateOptions,
  TemplateSaverOptions,
  TemplateValidationResult,
} from './template-saver';
export { TemplateSaverService } from './template-saver';

// Phase tracking
export type { PhaseTransitionNotification } from './phase-notifications';
export {
  cancelPhaseTransitionNotification,
  checkUpcomingTransitions,
  rehydratePhaseNotifications,
  schedulePhaseTransitionNotification,
} from './phase-notifications';
export type { PhaseInfo, PhaseProgress, PhaseSummary } from './phase-tracker';
export {
  computeCurrentPhase,
  getPhaseProgress,
  getPhaseSummary,
} from './phase-tracker';
export type {
  UsePhaseProgressOptions,
  UsePhaseProgressResult,
} from './use-phase-progress';
export { usePhaseProgress, usePhaseSummary } from './use-phase-progress';
