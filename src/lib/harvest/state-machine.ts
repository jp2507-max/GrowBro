/**
 * Harvest Workflow State Machine
 *
 * Implements finite state machine for harvest stage transitions
 * Requirements: 9.1, 9.2, 9.3, 9.4
 */

import { isValidTransition } from '@/lib/utils/harvest-validation';
import { HarvestStage } from '@/types';
import type {
  HarvestAuditAction,
  HarvestAuditEntry,
  HarvestAuditStatus,
  OverrideSkipRequest,
  StageRevertRequest,
  StageUndoRequest,
} from '@/types/harvest';

/**
 * Undo window duration in milliseconds (default 15 seconds)
 * Requirement 9.5: Configurable server-enforced timeout
 */
export const UNDO_WINDOW_MS = 15 * 1000;

/**
 * State machine configuration for each stage
 */
interface StageMetadata {
  stage: HarvestStage;
  name: string;
  canAdvance: boolean;
  canUndo: boolean;
  canRevert: boolean;
}

/**
 * Stage metadata lookup
 */
const STAGE_METADATA: Record<HarvestStage, StageMetadata> = {
  [HarvestStage.HARVEST]: {
    stage: HarvestStage.HARVEST,
    name: 'Harvest',
    canAdvance: true,
    canUndo: false, // Initial stage, nothing to undo to
    canRevert: false,
  },
  [HarvestStage.DRYING]: {
    stage: HarvestStage.DRYING,
    name: 'Drying',
    canAdvance: true,
    canUndo: true,
    canRevert: true,
  },
  [HarvestStage.CURING]: {
    stage: HarvestStage.CURING,
    name: 'Curing',
    canAdvance: true,
    canUndo: true,
    canRevert: true,
  },
  [HarvestStage.INVENTORY]: {
    stage: HarvestStage.INVENTORY,
    name: 'Inventory',
    canAdvance: false, // Final stage
    canUndo: true,
    canRevert: true,
  },
};

/**
 * Get metadata for a harvest stage
 */
export function getStageMetadata(stage: HarvestStage): StageMetadata {
  return STAGE_METADATA[stage];
}

/**
 * Validate if a stage transition is allowed
 * Requirement 9.1: FSM with forward-only transitions
 *
 * @param fromStage - Current stage
 * @param toStage - Target stage
 * @returns Validation result with error message if invalid
 */
export function validateStageTransition(
  fromStage: HarvestStage,
  toStage: HarvestStage
): { valid: boolean; error?: string } {
  // Check if already at target stage
  if (fromStage === toStage) {
    return {
      valid: false,
      error: 'Already at target stage',
    };
  }

  // Check if current stage can advance
  const metadata = getStageMetadata(fromStage);
  if (!metadata.canAdvance) {
    return {
      valid: false,
      error: `Cannot advance from final stage: ${fromStage}`,
    };
  }

  // Check if transition is valid (forward only)
  if (!isValidTransition(fromStage, toStage)) {
    return {
      valid: false,
      error: `Invalid transition from ${fromStage} to ${toStage}. Only forward transitions are allowed.`,
    };
  }

  return { valid: true };
}

/**
 * Check if undo is allowed for a stage completion
 * Requirement 9.5: 15-second undo window enforced by server time
 *
 * @param stageCompletedAt - Server timestamp when stage was completed
 * @param currentServerTime - Current server time
 * @returns True if within undo window
 */
export function canUndoStageChange(
  stageCompletedAt: Date,
  currentServerTime: Date
): boolean {
  const elapsedMs = currentServerTime.getTime() - stageCompletedAt.getTime();
  return elapsedMs <= UNDO_WINDOW_MS;
}

/**
 * Calculate when undo window expires
 *
 * @param stageCompletedAt - Server timestamp when stage was completed
 * @returns Expiration timestamp
 */
export function getUndoExpirationTime(stageCompletedAt: Date): Date {
  return new Date(stageCompletedAt.getTime() + UNDO_WINDOW_MS);
}

/**
 * Validate undo request
 * Requirement 9.5: Server-enforced undo window validation
 *
 * @param request - Undo request
 * @param currentStage - Current harvest stage
 * @param currentServerTime - Current server time
 * @returns Validation result
 */
export function validateUndoRequest(
  request: StageUndoRequest,
  currentStage: HarvestStage,
  currentServerTime: Date
): { valid: boolean; error?: string } {
  // Check if current stage supports undo
  const metadata = getStageMetadata(currentStage);
  if (!metadata.canUndo) {
    return {
      valid: false,
      error: `Cannot undo from stage: ${currentStage}`,
    };
  }

  // Check if within undo window
  if (!canUndoStageChange(request.stage_completed_at, currentServerTime)) {
    const expiresAt = getUndoExpirationTime(request.stage_completed_at);
    return {
      valid: false,
      error: `Undo window expired at ${expiresAt.toISOString()}. Use revert instead.`,
    };
  }

  return { valid: true };
}

/**
 * Validate revert request
 * Requirement 9.6: Revert stage flow with audit note
 *
 * @param request - Revert request
 * @param currentStage - Current harvest stage
 * @returns Validation result
 */
export function validateRevertRequest(
  request: StageRevertRequest,
  currentStage: HarvestStage
): { valid: boolean; error?: string } {
  // Check if current stage supports revert
  const metadata = getStageMetadata(currentStage);
  if (!metadata.canRevert) {
    return {
      valid: false,
      error: `Cannot revert from stage: ${currentStage}`,
    };
  }

  // Check if target stage is before current stage
  const stages = [
    HarvestStage.HARVEST,
    HarvestStage.DRYING,
    HarvestStage.CURING,
    HarvestStage.INVENTORY,
  ];
  const currentIndex = stages.indexOf(currentStage);
  const targetIndex = stages.indexOf(request.to_stage);

  if (targetIndex >= currentIndex) {
    return {
      valid: false,
      error: `Can only revert to earlier stages. Current: ${currentStage}, Target: ${request.to_stage}`,
    };
  }

  // Validate reason is provided
  if (!request.reason || request.reason.trim().length === 0) {
    return {
      valid: false,
      error: 'Reason is mandatory for stage revert',
    };
  }

  return { valid: true };
}

/**
 * Validate override & skip request
 * Requirement 9.2: Override with mandatory reason and audit
 *
 * @param request - Override request
 * @param currentStage - Current harvest stage
 * @returns Validation result
 */
export function validateOverrideRequest(
  request: OverrideSkipRequest,
  currentStage: HarvestStage
): { valid: boolean; error?: string } {
  // Check if target stage is ahead of current stage
  const stages = [
    HarvestStage.HARVEST,
    HarvestStage.DRYING,
    HarvestStage.CURING,
    HarvestStage.INVENTORY,
  ];
  const currentIndex = stages.indexOf(currentStage);
  const targetIndex = stages.indexOf(request.to_stage);

  if (targetIndex <= currentIndex) {
    return {
      valid: false,
      error: `Override can only skip forward. Current: ${currentStage}, Target: ${request.to_stage}`,
    };
  }

  // Validate reason is provided
  if (!request.reason || request.reason.trim().length === 0) {
    return {
      valid: false,
      error: 'Reason is mandatory for stage override',
    };
  }

  return { valid: true };
}

/**
 * Get the previous stage in the FSM
 *
 * @param currentStage - Current stage
 * @returns Previous stage, or null if at first stage
 */
export function getPreviousStage(
  currentStage: HarvestStage
): HarvestStage | null {
  const stages = [
    HarvestStage.HARVEST,
    HarvestStage.DRYING,
    HarvestStage.CURING,
    HarvestStage.INVENTORY,
  ];
  const currentIndex = stages.indexOf(currentStage);
  if (currentIndex <= 0) {
    return null;
  }
  return stages[currentIndex - 1];
}

/**
 * Create audit entry for stage transition
 * Requirement 9.7: Full audit trail
 *
 * @param params - Audit entry parameters
 * @returns Audit entry object
 */
export function createAuditEntry(params: {
  harvest_id: string;
  user_id: string | null;
  action: HarvestAuditAction;
  status: HarvestAuditStatus;
  from_stage: HarvestStage | null;
  to_stage: HarvestStage | null;
  reason: string | null;
  performed_at: Date;
  metadata?: Record<string, unknown>;
}): Omit<HarvestAuditEntry, 'id' | 'created_at'> {
  return {
    harvest_id: params.harvest_id,
    user_id: params.user_id,
    action: params.action,
    status: params.status,
    from_stage: params.from_stage,
    to_stage: params.to_stage,
    reason: params.reason,
    performed_at: params.performed_at,
    metadata: params.metadata || {},
  };
}
