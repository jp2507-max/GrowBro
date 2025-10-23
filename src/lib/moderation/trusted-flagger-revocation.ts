/**
 * Trusted Flagger Revocation Service
 * Implements graduated enforcement and quality threshold checks
 *
 * Requirements: 11.3, 11.6
 */

import { supabase } from '@/lib/supabase';

import { AuditService } from './audit-service';
import { calculateAccuracyRate } from './trusted-flagger-analytics';
import { updateFlaggerStatus } from './trusted-flagger-service';

// Initialize audit service
const auditService = new AuditService(supabase);

// ============================================================================
// Quality Thresholds
// ============================================================================

export const QUALITY_THRESHOLDS = {
  WARNING_ACCURACY: 0.75, // Warn if accuracy drops below 75%
  SUSPENSION_ACCURACY: 0.6, // Suspend if accuracy drops below 60%
  REVOCATION_ACCURACY: 0.5, // Revoke if accuracy drops below 50%
  WARNING_FALSE_POSITIVE: 0.3, // Warn if false positives exceed 30%
  SUSPENSION_FALSE_POSITIVE: 0.4, // Suspend if false positives exceed 40%
} as const;

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Check if flagger meets quality standards
 * Returns recommended action based on metrics
 */
export async function assessFlaggerQuality(flaggerId: string): Promise<{
  meets_standards: boolean;
  recommended_action: 'none' | 'warning' | 'suspension' | 'revocation';
  reasons: string[];
}> {
  const accuracyRate = await calculateAccuracyRate(flaggerId);

  // Get false positive rate
  const { data: decisions } = await supabase
    .from('moderation_decisions')
    .select('action, report_id')
    .eq('reporter_id', flaggerId);

  const totalDecisions = decisions?.length || 0;
  const falsePositives =
    decisions?.filter((d) => d.action === 'no_action').length || 0;
  const falsePositiveRate =
    totalDecisions > 0 ? falsePositives / totalDecisions : 0;

  const reasons: string[] = [];
  let recommendedAction: 'none' | 'warning' | 'suspension' | 'revocation' =
    'none';

  // Check for revocation triggers
  if (accuracyRate < QUALITY_THRESHOLDS.REVOCATION_ACCURACY) {
    reasons.push(
      `Accuracy rate (${(accuracyRate * 100).toFixed(1)}%) below revocation threshold (50%)`
    );
    recommendedAction = 'revocation';
  } else if (accuracyRate < QUALITY_THRESHOLDS.SUSPENSION_ACCURACY) {
    reasons.push(
      `Accuracy rate (${(accuracyRate * 100).toFixed(1)}%) below suspension threshold (60%)`
    );
    recommendedAction = 'suspension';
  } else if (accuracyRate < QUALITY_THRESHOLDS.WARNING_ACCURACY) {
    reasons.push(
      `Accuracy rate (${(accuracyRate * 100).toFixed(1)}%) below warning threshold (75%)`
    );
    if (recommendedAction === 'none') recommendedAction = 'warning';
  }

  // Check false positive rate (only escalate if not already at revocation)
  if (
    falsePositiveRate > QUALITY_THRESHOLDS.SUSPENSION_FALSE_POSITIVE &&
    recommendedAction !== 'revocation'
  ) {
    reasons.push(
      `False positive rate (${(falsePositiveRate * 100).toFixed(1)}%) exceeds suspension threshold (40%)`
    );
    if (recommendedAction === 'none' || recommendedAction === 'warning')
      recommendedAction = 'suspension';
  } else if (
    falsePositiveRate > QUALITY_THRESHOLDS.WARNING_FALSE_POSITIVE &&
    recommendedAction === 'none'
  ) {
    reasons.push(
      `False positive rate (${(falsePositiveRate * 100).toFixed(1)}%) exceeds warning threshold (30%)`
    );
    recommendedAction = 'warning';
  }

  return {
    meets_standards: recommendedAction === 'none',
    recommended_action: recommendedAction,
    reasons,
  };
}

/**
 * Issue warning to trusted flagger
 * Requirement: 11.6
 */
export async function issueWarning(
  flaggerId: string,
  reasons: string[],
  issuedBy: string
): Promise<void> {
  // No status change, just audit event and notification
  await auditService.logEvent({
    event_type: 'trusted_flagger_warning_issued',
    actor_id: issuedBy,
    actor_type: 'moderator',
    target_id: flaggerId,
    target_type: 'trusted_flagger',
    action: 'issue_warning',
    metadata: {
      reasons,
      improvement_guidance:
        'Please review your reporting standards and ensure substantiated evidence',
    },
  });

  // TODO: Send notification to flagger organization
}

/**
 * Suspend trusted flagger
 * Requirement: 11.3
 */
export async function suspendFlagger(
  flaggerId: string,
  reasons: string[],
  suspendedBy: string
): Promise<void> {
  await updateFlaggerStatus({
    flaggerId,
    status: 'suspended',
    reason: reasons.join('; '),
    updatedBy: suspendedBy,
  });

  await auditService.logEvent({
    event_type: 'trusted_flagger_suspended',
    actor_id: suspendedBy,
    actor_type: 'moderator',
    target_id: flaggerId,
    target_type: 'trusted_flagger',
    action: 'suspend',
    metadata: {
      reasons,
      review_period_days: 30,
    },
  });

  // TODO: Send suspension notification
}

/**
 * Revoke trusted flagger status permanently
 * Requirement: 11.3
 */
export async function revokeFlagger(
  flaggerId: string,
  reasons: string[],
  revokedBy: string
): Promise<void> {
  await updateFlaggerStatus({
    flaggerId,
    status: 'revoked',
    reason: reasons.join('; '),
    updatedBy: revokedBy,
  });

  await auditService.logEvent({
    event_type: 'trusted_flagger_revoked',
    actor_id: revokedBy,
    actor_type: 'moderator',
    target_id: flaggerId,
    target_type: 'trusted_flagger',
    action: 'revoke',
    metadata: {
      reasons,
      permanent: true,
    },
  });

  // TODO: Send revocation notification
}

/**
 * Apply appropriate enforcement action based on quality assessment
 */
export async function enforceQualityStandards(
  flaggerId: string,
  enforcedBy: string
): Promise<{
  action_taken: 'none' | 'warning' | 'suspension' | 'revocation';
  reasons: string[];
}> {
  const assessment = await assessFlaggerQuality(flaggerId);

  if (assessment.recommended_action === 'none') {
    return {
      action_taken: 'none',
      reasons: [],
    };
  }

  // Get current flagger status
  const { data: flagger } = await supabase
    .from('trusted_flaggers')
    .select('status')
    .eq('id', flaggerId)
    .single();

  if (!flagger) {
    throw new Error('Flagger not found');
  }

  // Apply graduated enforcement
  if (assessment.recommended_action === 'revocation') {
    await revokeFlagger(flaggerId, assessment.reasons, enforcedBy);
    return {
      action_taken: 'revocation',
      reasons: assessment.reasons,
    };
  }

  if (assessment.recommended_action === 'suspension') {
    // If already suspended and still failing, consider revocation
    if (flagger.status === 'suspended') {
      await revokeFlagger(
        flaggerId,
        [...assessment.reasons, 'No improvement during suspension period'],
        enforcedBy
      );
      return {
        action_taken: 'revocation',
        reasons: [
          ...assessment.reasons,
          'No improvement during suspension period',
        ],
      };
    }

    await suspendFlagger(flaggerId, assessment.reasons, enforcedBy);
    return {
      action_taken: 'suspension',
      reasons: assessment.reasons,
    };
  }

  if (assessment.recommended_action === 'warning') {
    await issueWarning(flaggerId, assessment.reasons, enforcedBy);
    return {
      action_taken: 'warning',
      reasons: assessment.reasons,
    };
  }

  return {
    action_taken: 'none',
    reasons: [],
  };
}

/**
 * Restore flagger to active status after successful review
 */
export async function restoreFlagger(
  flaggerId: string,
  restoredBy: string,
  reviewNotes: string
): Promise<void> {
  await updateFlaggerStatus({
    flaggerId,
    status: 'active',
    reason: `Restored after successful review: ${reviewNotes}`,
    updatedBy: restoredBy,
  });

  // Update next review date
  const nextReview = new Date();
  nextReview.setMonth(nextReview.getMonth() + 6);

  await supabase
    .from('trusted_flaggers')
    .update({
      review_date: nextReview.toISOString(),
    })
    .eq('id', flaggerId);
}
