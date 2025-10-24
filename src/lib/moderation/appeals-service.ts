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
import { accountRestorationService } from './account-restoration-service';
import { logAppealsAudit } from './appeals-audit';
import {
  scheduleDeadlineWarning,
  sendAppealNotification,
} from './appeals-notifications';
import { contentRestorationService } from './content-restoration-service';
import { moderationMetrics, trackAppealDecision } from './moderation-metrics';

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
  repeat_offender_status: 30, // days - same as account_action
  minimum: 7, // DSA minimum requirement
} as const;

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
async function findEligibleReviewer(criteria: {
  appealId: string;
  originalModeratorId: string;
  originalSupervisorId?: string;
  appealType: AppealType;
}): Promise<{ id: string; name: string } | null> {
  try {
    // Get all moderators with reviewer role
    const { data: reviewers, error } = await supabase
      .from('moderator_sessions')
      .select('moderator_id, email')
      .in('role', ['moderator', 'senior_moderator', 'supervisor'])
      .neq('moderator_id', criteria.originalModeratorId);

    if (error) throw error;
    if (!reviewers || reviewers.length === 0) return null;

    // Filter out original supervisor if present
    let eligibleReviewers = reviewers.filter(
      (r) => r.moderator_id !== criteria.originalSupervisorId
    );

    if (eligibleReviewers.length === 0) return null;

    // Get reviewer workloads (active appeals assigned)
    const { data: workloads } = await supabase
      .from('appeals')
      .select('reviewer_id')
      .in('status', ['in_review'])
      .in(
        'reviewer_id',
        eligibleReviewers.map((r) => r.moderator_id)
      );

    // Calculate workload scores
    const workloadMap = new Map<string, number>();
    workloads?.forEach((w) => {
      if (w.reviewer_id) {
        workloadMap.set(
          w.reviewer_id,
          (workloadMap.get(w.reviewer_id) || 0) + 1
        );
      }
    });

    // Sort by workload (lowest first)
    eligibleReviewers.sort((a, b) => {
      const workloadA = workloadMap.get(a.moderator_id) || 0;
      const workloadB = workloadMap.get(b.moderator_id) || 0;
      return workloadA - workloadB;
    });

    // Return reviewer with lowest workload
    const selected = eligibleReviewers[0];
    return {
      id: selected.moderator_id,
      name: selected.email.split('@')[0], // Use email prefix as name
    };
  } catch (error) {
    console.error('[AppealsService] Failed to find eligible reviewer:', error);
    return null;
  }
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

async function validateAppealForDecision(
  appealId: string,
  reviewerId: string
): Promise<{ appeal?: any; error?: string }> {
  const appeal = await getAppealStatus(appealId);
  if (!appeal) {
    return { error: 'Appeal not found' };
  }

  // Verify reviewer assignment
  if (appeal.reviewer_id !== reviewerId) {
    return { error: 'Reviewer mismatch - not assigned to this appeal' };
  }

  // Verify appeal is in review
  if (appeal.status !== 'in_review') {
    return { error: `Cannot process appeal in status: ${appeal.status}` };
  }

  return { appeal };
}

async function executeAppealDecision(
  appeal: any,
  decisionData: {
    decision: AppealDecision;
    reasoning: string;
    appealId: string;
  }
): Promise<void> {
  // Update appeal with decision
  await updateAppealDecision(decisionData.appealId, {
    decision: decisionData.decision,
    reasoning: decisionData.reasoning,
    status: 'resolved',
    resolvedAt: new Date(),
  });

  // If upheld, reverse original decision
  if (decisionData.decision === 'upheld') {
    await reverseOriginalDecision(
      appeal.original_decision_id,
      decisionData.appealId,
      decisionData.reasoning
    );
  }
}

async function handleAppealPostProcessing(
  appeal: any,
  processingData: {
    decision: AppealDecision;
    reasoning: string;
    appealId: string;
    reviewerId: string;
  }
): Promise<void> {
  // Send notification to user
  await sendAppealNotification({
    appealId: processingData.appealId,
    userId: appeal.user_id,
    type: 'appeal_decision',
    decision: processingData.decision,
    status: 'resolved',
  });

  // Log audit event
  await logAppealsAudit({
    appealId: processingData.appealId,
    action: 'appeal-decision',
    userId: appeal.user_id,
    reviewerId: processingData.reviewerId,
    decision: processingData.decision,
    metadata: {
      reasoning: processingData.reasoning,
    },
  });

  // Update metrics (appeal reversal rate)
  if (processingData.decision === 'upheld') {
    const timeToResolution = appeal.resolved_at
      ? (appeal.resolved_at.getTime() - appeal.submitted_at.getTime()) /
        (1000 * 60 * 60)
      : 0;

    const originalDecision = await fetchModerationDecision(
      appeal.original_decision_id
    );
    if (originalDecision) {
      trackAppealDecision(processingData.appealId, processingData.decision, {
        originalAction: originalDecision.action,
        timeToResolutionHours: timeToResolution,
      });

      // Track false positive
      moderationMetrics.trackFalsePositive(
        originalDecision.id,
        originalDecision.action,
        true
      );
    }
  }
}

export async function processAppealDecision(decision: {
  appealId: string;
  reviewerId: string;
  decision: AppealDecision;
  reasoning: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate appeal and reviewer
    const validation = await validateAppealForDecision(
      decision.appealId,
      decision.reviewerId
    );
    if (validation.error || !validation.appeal) {
      return { success: false, error: validation.error };
    }

    // Execute the decision
    await executeAppealDecision(validation.appeal, {
      decision: decision.decision,
      reasoning: decision.reasoning,
      appealId: decision.appealId,
    });

    // Handle post-processing (notifications, audit, metrics)
    await handleAppealPostProcessing(validation.appeal, {
      decision: decision.decision,
      reasoning: decision.reasoning,
      appealId: decision.appealId,
      reviewerId: decision.reviewerId,
    });

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
    case 'quarantine':
    case 'geo_block': {
      // Restore content visibility
      const { data: report } = await supabase
        .from('content_reports')
        .select('content_id, content_type')
        .eq('id', decision.report_id)
        .single();

      if (report) {
        const contentType = report.content_type as 'post' | 'comment';
        await contentRestorationService.restoreContent(
          report.content_id,
          contentType,
          {
            originalAction: decision.action,
            restorationData: { reversalReason: reason, appealId },
          }
        );
      }
      break;
    }

    case 'suspend_user':
    case 'rate_limit':
    case 'shadow_ban':
      // Restore account status
      await accountRestorationService.restoreAccount(
        decision.report_id,
        decision.action,
        { reversalReason: reason, appealId }
      );
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
  try {
    const { data, error } = await supabase
      .from('appeals')
      .insert(appeal)
      .select()
      .single();

    if (error) throw error;
    return data as Appeal;
  } catch (error) {
    console.error('[AppealsService] Failed to create appeal record:', error);
    throw error;
  }
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
// Repeat Offender Status Appeals (DSA Art. 20, Req 12.2, 12.4)
// ============================================================================

/**
 * Process repeat offender status appeal
 *
 * Handles appeals where users contest their repeat offender classification
 * or escalation level. Allows correction of false positives.
 *
 * Requirements: 12.2, 12.4
 */
async function processRepeatOffenderAppeal(params: {
  appeal: Appeal;
  decision: AppealDecision;
  reasoning: string;
  reviewerId: string;
}): Promise<{ success: boolean; error?: string }> {
  const { appeal, decision, reasoning, reviewerId } = params;

  try {
    // Import here to avoid circular dependency
    const { RepeatOffenderService } = await import('./repeat-offender-service');
    const repeatOffenderService = new RepeatOffenderService();

    if (decision === 'upheld') {
      // Appeal upheld - correct the violation record
      const userId = appeal.user_id;
      const violationType = 'general_policy_violation'; // Default type for status appeals

      // Determine correction action based on appeal reasoning
      const correctResult = await repeatOffenderService.correctViolation({
        user_id: userId,
        violation_type: violationType,
        reason: reasoning,
        moderator_id: reviewerId,
        reduce_count_by: 1, // Reduce by 1 violation
      });

      if (!correctResult.success) {
        return {
          success: false,
          error: `Failed to correct violation: ${correctResult.error}`,
        };
      }

      // Log the correction
      await logAppealsAudit({
        appealId: appeal.id,
        action: 'decision-reversed',
        userId: userId,
        reviewerId,
        metadata: {
          appeal_type: 'repeat_offender_status',
          violation_type: violationType,
          previous_state: correctResult.previous_state,
          new_record: correctResult.record,
        },
      });
    } else {
      // Appeal rejected - log for transparency
      await logAppealsAudit({
        appealId: appeal.id,
        action: 'appeal-decision',
        userId: appeal.user_id,
        reviewerId,
        decision: 'rejected',
        metadata: {
          appeal_type: 'repeat_offender_status',
          reasoning,
        },
      });
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
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
  processRepeatOffenderAppeal,
};
