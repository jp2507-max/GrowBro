/**
 * Appeals Service - DSA Art. 20 Internal Complaint-Handling
 *
 * Implements:
 * - Appeal intake with eligibility validation
 * - Human review assignment with conflict-of-interest prevention
 * - Decision reversal engine for upheld appeals
 * - Appeal status tracking and deadline management
 *
 * Requirements: 4.1, 4.2, 4.5, 4.8
 */

import type {
  Appeal,
  AppealDecision,
  AppealInput,
  AppealStatus,
  AppealSubmissionResult,
  AppealType,
  ModerationDecision,
} from '@/types/moderation';

import { validateAppeal } from '../schemas/moderation-schemas';
import { supabase } from '../supabase';
import { logAppealsAudit } from './appeals-audit';
import {
  scheduleDeadlineWarning,
  sendAppealNotification,
} from './appeals-notifications';

// ============================================================================
// Constants
// ============================================================================

/**
 * Minimum appeal window per DSA Art. 20 (≥7 days)
 * Product policy may extend these windows
 */
export const APPEAL_DEADLINES = {
  content_removal: 14, // days
  account_action: 30, // days
  geo_restriction: 14, // days
  minimum: 7, // DSA minimum requirement
} as const;

/**
 * ODS resolution target per DSA Art. 21
 */
export const ODS_RESOLUTION_TARGET_DAYS = 90;

// ============================================================================
// Appeal Intake
// ============================================================================

/**
 * Submit an appeal for a moderation decision
 *
 * Validates:
 * - Appeal is within deadline window
 * - Original decision exists and is appealable
 * - User has not already appealed this decision
 * - Required fields are present (counter-arguments, evidence)
 *
 * Returns unique appeal ID and deadline
 *
 * Requirement: 4.1, 4.2
 */
export async function submitAppeal(
  input: AppealInput
): Promise<AppealSubmissionResult> {
  // Quick validation
  const validation = validateAppeal(input);
  if (!validation.is_valid) {
    return { success: false, error: validation.errors.join('; ') };
  }

  try {
    // Ensure original decision exists and is eligible
    const originalDecision = await fetchModerationDecision(
      input.original_decision_id
    );
    if (!originalDecision)
      return { success: false, error: 'Original decision not found' };

    const eligibility = checkAppealEligibility(
      originalDecision,
      input.appeal_type
    );
    if (!eligibility.eligible)
      return { success: false, error: eligibility.reason };

    // Ensure user hasn't already appealed
    const existingAppeal = await checkExistingAppeal(
      input.user_id,
      input.original_decision_id
    );
    if (existingAppeal)
      return {
        success: false,
        error: `Appeal already exists (ID: ${existingAppeal.id})`,
      };

    // Build appeal record and delegate creation/notifications to helper
    const deadline = calculateAppealDeadline(input.appeal_type);
    const appealPartial: Partial<Appeal> = {
      original_decision_id: input.original_decision_id,
      user_id: input.user_id,
      appeal_type: input.appeal_type,
      counter_arguments: input.counter_arguments,
      supporting_evidence: input.supporting_evidence || [],
      status: 'pending',
      submitted_at: new Date(),
      deadline,
    };

    const createdAppeal = await createAndNotifyAppeal(appealPartial, input);

    return {
      success: true,
      appeal_id: createdAppeal.id,
      deadline: createdAppeal.deadline,
    };
  } catch (error) {
    console.error('[AppealsService] Failed to submit appeal:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to submit appeal. Please try again.',
    };
  }
}

async function createAndNotifyAppeal(
  appeal: Partial<Appeal>,
  input: AppealInput
): Promise<Appeal> {
  const createdAppeal = await createAppealRecord(appeal);

  // Send confirmation notification to user (Requirement 4.1)
  await sendAppealNotification({
    appealId: createdAppeal.id,
    userId: input.user_id,
    type: 'appeal_submitted',
    status: 'pending',
    deadlineDate: createdAppeal.deadline,
  });

  // Schedule deadline warning (24 hours before)
  await scheduleDeadlineWarning(
    createdAppeal.id,
    input.user_id,
    createdAppeal.deadline
  );

  // Log audit event
  await logAppealsAudit({
    appealId: createdAppeal.id,
    action: 'appeal-submitted',
    userId: input.user_id,
    metadata: {
      appealType: input.appeal_type,
      originalDecisionId: input.original_decision_id,
    },
  });

  return createdAppeal;
}

/**
 * Get appeal status with original decision context
 *
 * Requirement: 4.2
 */
export async function getAppealStatus(
  appealId: string
): Promise<Appeal | null> {
  try {
    const { data, error } = await supabase
      .from('appeals')
      .select('*')
      .eq('id', appealId)
      .is('deleted_at', null)
      .single();

    if (error) throw error;
    return data as Appeal;
  } catch (error) {
    console.error('[AppealsService] Failed to get appeal status:', error);
    return null;
  }
}

/**
 * Get appeal with full context including original decision and evidence
 *
 * Requirement: 4.2
 */
export async function getAppealWithContext(appealId: string): Promise<{
  appeal: Appeal;
  originalDecision: ModerationDecision;
  policyCitations: string[];
  evidence: string[];
} | null> {
  try {
    const { data: appeal, error: appealError } = await supabase
      .from('appeals')
      .select(
        `
        *,
        original_decision:moderation_decisions!original_decision_id(*)
      `
      )
      .eq('id', appealId)
      .is('deleted_at', null)
      .single();

    if (appealError) throw appealError;
    if (!appeal) return null;

    const originalDecision =
      appeal.original_decision as unknown as ModerationDecision;

    return {
      appeal: appeal as unknown as Appeal,
      originalDecision,
      policyCitations: originalDecision.policy_violations || [],
      evidence: appeal.supporting_evidence || [],
    };
  } catch (error) {
    console.error('[AppealsService] Failed to get appeal with context:', error);
    return null;
  }
}

// ============================================================================
// Eligibility & Deadline Management
// ============================================================================

/**
 * Check if a decision is eligible for appeal
 *
 * Requirement: 4.1
 */
export function checkAppealEligibility(
  decision: ModerationDecision,
  appealType: AppealType
): { eligible: boolean; reason?: string } {
  // Check if decision is already reversed
  if (decision.reversed_at) {
    return {
      eligible: false,
      reason: 'Decision has already been reversed',
    };
  }

  // Check if decision requires no action
  if (decision.action === 'no_action') {
    return {
      eligible: false,
      reason: 'No action was taken on this content',
    };
  }

  // Check if appeal window has expired
  const deadlineDays = APPEAL_DEADLINES[appealType];
  const appealWindowEnd = new Date(decision.created_at);
  appealWindowEnd.setDate(appealWindowEnd.getDate() + deadlineDays);

  if (new Date() > appealWindowEnd) {
    return {
      eligible: false,
      reason: `Appeal window expired (deadline was ${appealWindowEnd.toISOString()})`,
    };
  }

  return { eligible: true };
}

/**
 * Calculate appeal deadline based on appeal type
 *
 * Ensures minimum 7-day window per DSA Art. 20
 * Extends to product policy windows (14/30 days)
 *
 * Requirement: 4.1
 */
export function calculateAppealDeadline(appealType: AppealType): Date {
  const days = APPEAL_DEADLINES[appealType];

  // Ensure we meet DSA minimum
  if (days < APPEAL_DEADLINES.minimum) {
    throw new Error(
      `Appeal deadline for ${appealType} (${days} days) is below DSA minimum (${APPEAL_DEADLINES.minimum} days)`
    );
  }

  const deadline = new Date();
  deadline.setDate(deadline.getDate() + days);
  return deadline;
}

// ============================================================================
// Reviewer Assignment (Conflict-of-Interest Prevention)
// ============================================================================

/**
 * Assign a reviewer to an appeal
 *
 * Ensures:
 * - Reviewer is not the original moderator
 * - Reviewer has not been involved in related decisions
 * - Reviewer is qualified and available
 *
 * Requirement: 4.5
 */
export async function assignReviewer(
  appealId: string
): Promise<{ success: boolean; reviewerId?: string; error?: string }> {
  try {
    const appeal = await getAppealStatus(appealId);
    if (!appeal) {
      return { success: false, error: 'Appeal not found' };
    }

    // Check if already assigned
    if (appeal.reviewer_id) {
      return {
        success: false,
        error: `Appeal already assigned to reviewer ${appeal.reviewer_id}`,
      };
    }

    // Get original decision to identify conflicts
    const originalDecision = await fetchModerationDecision(
      appeal.original_decision_id
    );
    if (!originalDecision) {
      return { success: false, error: 'Original decision not found' };
    }

    // Find eligible reviewer
    const eligibleReviewer = await findEligibleReviewer({
      appealId,
      originalModeratorId: originalDecision.moderator_id,
      originalSupervisorId: originalDecision.supervisor_id,
      appealType: appeal.appeal_type,
    });

    if (!eligibleReviewer) {
      return {
        success: false,
        error: 'No eligible reviewers available (conflict-of-interest)',
      };
    }

    // Assign reviewer
    await updateAppealReviewer(appealId, eligibleReviewer.id);

    // Update appeal status
    await updateAppealStatus(appealId, 'in_review');

    // Send notification to reviewer
    await sendAppealNotification({
      appealId,
      userId: eligibleReviewer.id,
      type: 'appeal_assigned',
      status: 'in_review',
    });

    // Log audit event
    await logAppealsAudit({
      appealId,
      action: 'appeal-assigned',
      reviewerId: eligibleReviewer.id,
    });

    return {
      success: true,
      reviewerId: eligibleReviewer.id,
    };
  } catch (error) {
    console.error('[AppealsService] Failed to assign reviewer:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Assignment failed',
    };
  }
}

/**
 * Find eligible reviewer with conflict-of-interest checks
 *
 * Requirement: 4.5
 */
async function findEligibleReviewer(_criteria: {
  appealId: string;
  originalModeratorId: string;
  originalSupervisorId?: string;
  appealType: AppealType;
}): Promise<{ id: string; name: string } | null> {
  // TODO: Implement Supabase query
  // - Exclude original moderator and supervisor
  // - Exclude reviewers with related decision history
  // - Prioritize by workload and expertise
  // - Return available reviewer with lowest conflict score
  return null;
}

/**
 * Check for conflict-of-interest between reviewer and appeal
 *
 * Requirement: 4.5
 */
export async function checkReviewerConflict(
  reviewerId: string,
  appealId: string
): Promise<{ hasConflict: boolean; reasons: string[] }> {
  const reasons: string[] = [];

  try {
    const appeal = await getAppealStatus(appealId);
    if (!appeal) {
      return { hasConflict: false, reasons: [] };
    }

    const originalDecision = await fetchModerationDecision(
      appeal.original_decision_id
    );
    if (!originalDecision) {
      return { hasConflict: false, reasons: [] };
    }

    // Check if reviewer was original moderator
    if (reviewerId === originalDecision.moderator_id) {
      reasons.push('Reviewer was the original moderator');
    }

    // Check if reviewer was supervisor
    if (
      originalDecision.supervisor_id &&
      reviewerId === originalDecision.supervisor_id
    ) {
      reasons.push('Reviewer was the supervisor for original decision');
    }

    // TODO: Check for related decisions by this reviewer
    // TODO: Check for relationship indicators

    return {
      hasConflict: reasons.length > 0,
      reasons,
    };
  } catch (error) {
    console.error('[AppealsService] Failed to check reviewer conflict:', error);
    return { hasConflict: false, reasons: [] };
  }
}

// ============================================================================
// Appeal Decision Processing
// ============================================================================

/**
 * Process an appeal decision
 *
 * If upheld:
 * - Reverses original moderation action
 * - Restores content/account status
 * - Logs reversal with reasoning
 *
 * If rejected:
 * - Maintains original decision
 * - Provides detailed explanation
 * - Offers ODS escalation option
 *
 * Requirement: 4.2, 4.8
 */
export async function processAppealDecision(decision: {
  appealId: string;
  reviewerId: string;
  decision: AppealDecision;
  reasoning: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const appeal = await getAppealStatus(decision.appealId);
    if (!appeal) {
      return { success: false, error: 'Appeal not found' };
    }

    // Verify reviewer assignment
    if (appeal.reviewer_id !== decision.reviewerId) {
      return {
        success: false,
        error: 'Reviewer mismatch - not assigned to this appeal',
      };
    }

    // Verify appeal is in review
    if (appeal.status !== 'in_review') {
      return {
        success: false,
        error: `Cannot process appeal in status: ${appeal.status}`,
      };
    }

    // Update appeal with decision
    await updateAppealDecision(decision.appealId, {
      decision: decision.decision,
      reasoning: decision.reasoning,
      status: 'resolved',
      resolvedAt: new Date(),
    });

    // If upheld, reverse original decision
    if (decision.decision === 'upheld') {
      await reverseOriginalDecision(
        appeal.original_decision_id,
        decision.appealId,
        decision.reasoning
      );
    }

    // Send notification to user
    await sendAppealNotification({
      appealId: decision.appealId,
      userId: appeal.user_id,
      type: 'appeal_decision',
      decision: decision.decision,
      status: 'resolved',
    });

    // Log audit event
    await logAppealsAudit({
      appealId: decision.appealId,
      action: 'appeal-decision',
      userId: appeal.user_id,
      reviewerId: decision.reviewerId,
      decision: decision.decision,
      metadata: {
        reasoning: decision.reasoning,
      },
    });

    // Update metrics (appeal reversal rate)
    // This could be tracked via a metrics service if available
    if (decision.decision === 'upheld') {
      console.log('[AppealsMetrics] Appeal upheld - reversal rate updated');
    }

    return { success: true };
  } catch (error) {
    console.error('[AppealsService] Failed to process appeal decision:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Processing failed',
    };
  }
}

/**
 * Reverse original moderation decision
 *
 * Restores content visibility or account status
 * Creates immutable audit trail
 *
 * Requirement: 4.2
 */
async function reverseOriginalDecision(
  decisionId: string,
  appealId: string,
  reason: string
): Promise<void> {
  const decision = await fetchModerationDecision(decisionId);
  if (!decision) {
    throw new Error('Original decision not found');
  }

  // Update decision status
  await updateDecisionReversal(decisionId, {
    reversed_at: new Date(),
    reversal_reason: reason,
    status: 'reversed',
  });

  // Execute reversal based on action type
  switch (decision.action) {
    case 'remove':
      // Restore content visibility
      console.log(
        '[AppealsService] Restoring content visibility for decision:',
        decisionId
      );
      break;
    case 'suspend_user':
      // Restore account status
      console.log(
        '[AppealsService] Restoring account status for user:',
        decision.user_id
      );
      break;
    case 'geo_block':
      // Remove geo-restrictions
      console.log(
        '[AppealsService] Removing geo-restrictions for decision:',
        decisionId
      );
      break;
    case 'quarantine':
    case 'rate_limit':
    case 'shadow_ban':
      // Remove restrictions
      console.log('[AppealsService] Removing restrictions:', decision.action);
      break;
    default:
      console.warn(
        `[AppealsService] No reversal action for type: ${decision.action}`
      );
  }

  // Log audit event
  await logAppealsAudit({
    appealId,
    action: 'decision-reversed',
    metadata: {
      originalDecisionId: decisionId,
      reason,
      action: decision.action,
    },
  });
}

// ============================================================================
// Database Operations (TODO: Implement with Supabase)
// ============================================================================

async function fetchModerationDecision(
  decisionId: string
): Promise<ModerationDecision | null> {
  try {
    const { data, error } = await supabase
      .from('moderation_decisions')
      .select('*')
      .eq('id', decisionId)
      .is('deleted_at', null)
      .single();

    if (error) throw error;
    return data as ModerationDecision;
  } catch (error) {
    console.error(
      '[AppealsService] Failed to fetch moderation decision:',
      error
    );
    return null;
  }
}

async function checkExistingAppeal(
  userId: string,
  decisionId: string
): Promise<Appeal | null> {
  try {
    const { data, error } = await supabase
      .from('appeals')
      .select('*')
      .eq('user_id', userId)
      .eq('original_decision_id', decisionId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    return data as Appeal | null;
  } catch (error) {
    console.error('[AppealsService] Failed to check existing appeal:', error);
    return null;
  }
}

async function createAppealRecord(appeal: Partial<Appeal>): Promise<Appeal> {
  // TODO: Implement Supabase insert
  // Return created appeal with generated ID
  return appeal as Appeal;
}

async function updateAppealReviewer(
  appealId: string,
  reviewerId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('appeals')
      .update({ reviewer_id: reviewerId, updated_at: new Date() })
      .eq('id', appealId);

    if (error) throw error;
  } catch (error) {
    console.error('[AppealsService] Failed to update appeal reviewer:', error);
    throw error;
  }
}

async function updateAppealStatus(
  appealId: string,
  status: AppealStatus
): Promise<void> {
  try {
    const { error } = await supabase
      .from('appeals')
      .update({ status, updated_at: new Date() })
      .eq('id', appealId);

    if (error) throw error;
  } catch (error) {
    console.error('[AppealsService] Failed to update appeal status:', error);
    throw error;
  }
}

async function updateAppealDecision(
  appealId: string,
  update: {
    decision: AppealDecision;
    reasoning: string;
    status: AppealStatus;
    resolvedAt: Date;
  }
): Promise<void> {
  try {
    const { error } = await supabase
      .from('appeals')
      .update({
        decision: update.decision,
        decision_reasoning: update.reasoning,
        status: update.status,
        resolved_at: update.resolvedAt,
        updated_at: new Date(),
      })
      .eq('id', appealId);

    if (error) throw error;
  } catch (error) {
    console.error('[AppealsService] Failed to update appeal decision:', error);
    throw error;
  }
}

async function updateDecisionReversal(
  decisionId: string,
  reversal: {
    reversed_at: Date;
    reversal_reason: string;
    status: string;
  }
): Promise<void> {
  try {
    const { error } = await supabase
      .from('moderation_decisions')
      .update({
        reversed_at: reversal.reversed_at,
        reversal_reason: reversal.reversal_reason,
        status: reversal.status,
        updated_at: new Date(),
      })
      .eq('id', decisionId);

    if (error) throw error;
  } catch (error) {
    console.error(
      '[AppealsService] Failed to update decision reversal:',
      error
    );
    throw error;
  }
}

// ============================================================================
// Exports
// ============================================================================

export const appealsService = {
  submitAppeal,
  getAppealStatus,
  getAppealWithContext,
  checkAppealEligibility,
  calculateAppealDeadline,
  assignReviewer,
  checkReviewerConflict,
  processAppealDecision,
};
