/**
 * Conflict of Interest API - DSA Art. 14 Impartiality
 *
 * API endpoints for:
 * - Conflict of interest detection
 * - Relationship checking
 * - Alternative moderator assignment
 * - COI event logging
 *
 * Requirements: 2.5, 4.5
 */

import { client } from '@/api/common';
import type { ConflictOfInterest } from '@/types/moderation';

// ============================================================================
// Types
// ============================================================================

export interface PreviousDecisionCheck {
  hasDecision: boolean;
  decisionIds: string[];
}

export interface RelationshipCheck {
  hasRelationship: boolean;
  relationshipType?: string;
}

export interface BiasIndicatorsCheck {
  hasBias: boolean;
  indicators: string[];
}

export interface COIEventPayload {
  report_id: string;
  moderator_id: string;
  has_conflict: boolean;
  reasons: string[];
  conflict_type?: ConflictOfInterest['conflict_type'];
  timestamp: string;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Check for conflict of interest between moderator and report
 *
 * Requirement: 2.5
 */
export async function apiCheckConflictOfInterest(
  reportId: string,
  moderatorId: string
): Promise<ConflictOfInterest> {
  try {
    const response = await client.get<ConflictOfInterest>(
      `/moderation/reports/${reportId}/conflict-check`,
      {
        params: { moderator_id: moderatorId },
      }
    );
    return response.data;
  } catch (error) {
    console.error('[COIAPI] Failed to check conflict of interest:', error);
    // Safety requirement: block assignments when conflict check fails
    return {
      has_conflict: true,
      reasons: ['conflict_check_unavailable'],
    };
  }
}

/**
 * Check if moderator previously decided on same content
 *
 * Requirement: 2.5
 */
export async function apiHasPreviousDecision(
  moderatorId: string,
  contentId: string
): Promise<PreviousDecisionCheck> {
  try {
    const response = await client.get<any[]>(
      `/moderation/moderators/${moderatorId}/decisions`,
      {
        params: { content_id: contentId },
      }
    );

    const decisions = response.data;
    return {
      hasDecision: decisions.length > 0,
      decisionIds: decisions.map((d) => d.id),
    };
  } catch (error) {
    console.error('[COIAPI] Failed to check previous decisions:', error);
    throw new Error(
      `Failed to check previous decisions for moderator ${moderatorId} and content ${contentId}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Check if moderator has relationship with content creator
 *
 * Requirement: 2.5
 */
export async function apiHasRelationship(
  moderatorId: string,
  userId: string
): Promise<RelationshipCheck> {
  try {
    const response = await client.get<RelationshipCheck>(
      `/moderation/moderators/${moderatorId}/relationships`,
      {
        params: { user_id: userId },
      }
    );
    return response.data;
  } catch (error) {
    console.error('[COIAPI] Failed to check relationships:', error);
    throw new Error(
      `Failed to check relationship between moderator ${moderatorId} and user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get alternative moderators without COI
 *
 * Requirement: 2.5
 */
export async function apiGetAlternativeModerators(
  reportId: string,
  excludeModeratorIds: string[]
): Promise<string[]> {
  try {
    const response = await client.get<string[]>(
      `/moderation/reports/${reportId}/alternative-moderators`,
      {
        params: {
          exclude: excludeModeratorIds.join(','),
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('[COIAPI] Failed to get alternative moderators:', error);
    throw new Error(
      `Failed to get alternative moderators for report ${reportId}: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Log COI event for audit trail
 *
 * Requirement: 4.5
 */
export async function apiLogCOIEvent(
  reportId: string,
  moderatorId: string,
  conflict: ConflictOfInterest
): Promise<void> {
  try {
    const payload: COIEventPayload = {
      report_id: reportId,
      moderator_id: moderatorId,
      has_conflict: conflict.has_conflict,
      reasons: conflict.reasons,
      conflict_type: conflict.conflict_type,
      timestamp: new Date().toISOString(),
    };

    await client.post('/moderation/audit/coi-events', payload);
  } catch (error) {
    console.error('[COIAPI] Failed to log COI event:', error);
    // Don't throw - audit logging failure shouldn't break the flow
  }
}
