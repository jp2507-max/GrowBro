/**
 * Conflict of Interest (COI) detection service
 * Prevents moderators from reviewing content with potential bias
 * Requirements: 2.5, 4.5
 */

import {
  apiCheckConflictOfInterest,
  apiGetAlternativeModerators,
  apiHasPreviousDecision,
  apiHasRelationship,
  apiLogCOIEvent,
} from '@/api/moderation/conflict-of-interest-api';
import type { ConflictOfInterest } from '@/types/moderation';

import { getDecisionsByModerator } from './similar-decisions';

/**
 * Check for conflict of interest between moderator and report
 */
export async function checkConflictOfInterest(
  reportId: string,
  moderatorId: string
): Promise<ConflictOfInterest> {
  return apiCheckConflictOfInterest(reportId, moderatorId);
}

/**
 * Check if moderator previously decided on same content
 */
export async function hasPreviousDecision(
  moderatorId: string,
  contentId: string
): Promise<{ hasDecision: boolean; decisionIds: string[] }> {
  const result = await apiHasPreviousDecision(moderatorId, contentId);
  return { hasDecision: result.hasDecision, decisionIds: result.decisionIds };
}

/**
 * Check if moderator has relationship with content creator
 * (e.g., follows, frequently interacts, same organization)
 */
export async function hasRelationship(
  moderatorId: string,
  userId: string
): Promise<{ hasRelationship: boolean; relationshipType?: string }> {
  return apiHasRelationship(moderatorId, userId);
}

/**
 * Check if moderator has bias indicators
 * (e.g., high reversal rate on appeals for specific user, inconsistent decisions)
 */
export async function hasBiasIndicators(
  moderatorId: string,
  userId: string
): Promise<{ hasBias: boolean; indicators: string[] }> {
  try {
    const decisions = await getDecisionsByModerator(moderatorId, userId);

    if (decisions.length === 0) {
      return { hasBias: false, indicators: [] };
    }

    const indicators: string[] = [];

    // Check for unusual patterns
    const reversalCount = decisions.filter(
      (d) => d.reversed_at !== undefined
    ).length;
    const reversalRate = reversalCount / decisions.length;

    if (reversalRate > 0.5) {
      indicators.push(
        `High reversal rate (${Math.round(reversalRate * 100)}%) for this user`
      );
    }

    // Check for decision time anomalies
    const avgDecisionTimes = decisions
      .map((d) => {
        if (!d.executed_at) return null;
        return (
          new Date(d.executed_at).getTime() - new Date(d.created_at).getTime()
        );
      })
      .filter((t): t is number => t !== null);

    if (avgDecisionTimes.length > 0) {
      const avgTime =
        avgDecisionTimes.reduce((sum, t) => sum + t, 0) /
        avgDecisionTimes.length;

      // Unusually fast decisions might indicate bias
      if (avgTime < 60 * 1000) {
        // Less than 1 minute
        indicators.push('Unusually fast decision times for this user');
      }
    }

    return {
      hasBias: indicators.length > 0,
      indicators,
    };
  } catch (error) {
    console.error(
      `[COI] Failed to fetch decision history for moderator ${moderatorId}, user ${userId}:`,
      error
    );
    // Return safe degraded response
    return { hasBias: false, indicators: [] };
  }
}

/**
 * Comprehensive COI check combining all factors
 */
export async function performComprehensiveCOICheck(params: {
  reportId: string;
  moderatorId: string;
  contentId: string;
  userId: string;
}): Promise<ConflictOfInterest> {
  try {
    const { moderatorId, contentId, userId } = params;
    const reasons: string[] = [];
    const relatedDecisionIds: string[] = [];

    // Check previous decisions
    const { hasDecision, decisionIds } = await hasPreviousDecision(
      moderatorId,
      contentId
    );

    if (hasDecision) {
      reasons.push(
        'Moderator previously made a decision on this content or related content'
      );
      relatedDecisionIds.push(...decisionIds);
    }

    // Check relationships
    const { hasRelationship: hasRel, relationshipType } = await hasRelationship(
      moderatorId,
      userId
    );

    if (hasRel) {
      reasons.push(`Moderator has relationship with user: ${relationshipType}`);
    }

    // Check bias indicators
    const { hasBias, indicators } = await hasBiasIndicators(
      moderatorId,
      userId
    );

    if (hasBias) {
      reasons.push(...indicators);
    }

    // Determine conflict type
    let conflictType: ConflictOfInterest['conflict_type'] | undefined;

    if (hasDecision) {
      conflictType = 'previous_decision';
    } else if (hasRel) {
      conflictType = 'relationship';
    } else if (hasBias) {
      conflictType = 'bias_indicator';
    }

    return {
      has_conflict: reasons.length > 0,
      reasons,
      conflict_type: conflictType,
      related_decision_ids:
        relatedDecisionIds.length > 0 ? relatedDecisionIds : undefined,
    };
  } catch (error) {
    console.error(
      `[COI] Comprehensive COI check failed for moderator ${params.moderatorId}:`,
      error
    );
    return {
      has_conflict: false,
      reasons: ['conflict_check_error'],
      conflict_type: undefined,
      related_decision_ids: undefined,
    };
  }
}

/**
 * Get alternative moderators without COI
 */
export async function getAlternativeModerators(
  reportId: string,
  excludeModeratorIds: string[]
): Promise<string[]> {
  return apiGetAlternativeModerators(reportId, excludeModeratorIds);
}

/**
 * Log COI event for audit trail
 */
export async function logCOIEvent(
  reportId: string,
  moderatorId: string,
  conflict: ConflictOfInterest
): Promise<void> {
  await apiLogCOIEvent(reportId, moderatorId, conflict);
}
