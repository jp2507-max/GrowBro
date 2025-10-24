/**
 * Similar Decisions API - Moderator Context and Consistency
 *
 * API endpoints for:
 * - Finding similar moderation decisions
 * - Getting moderator decision history
 * - Calculating consistency metrics
 * - Analyzing user violation patterns
 *
 * Requirements: 2.2, 2.7
 */

import { client } from '@/api/common';
import type {
  ModerationAction,
  ModerationDecision,
  PriorDecision,
} from '@/types/moderation';

// ============================================================================
// Types
// ============================================================================

export interface ModeratorConsistencyMetrics {
  totalDecisions: number;
  consistencyScore: number; // 0-1
  reversalRate: number; // 0-1
  averageDecisionTime: number; // ms
}

export interface UserViolationPattern {
  totalReports: number;
  violationsByCategory: Record<string, number>;
  actions: Record<ModerationAction, number>;
  escalationTrend: 'improving' | 'stable' | 'worsening';
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Find similar decisions based on content similarity
 *
 * Requirement: 2.2
 */
export async function apiFindSimilarDecisions(
  contentId: string,
  category: string,
  limit = 5
): Promise<PriorDecision[]> {
  try {
    const response = await client.get<PriorDecision[]>(
      '/moderation/similar-decisions',
      {
        params: {
          content_id: contentId,
          category,
          limit,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error(
      '[SimilarDecisionsAPI] Failed to fetch similar decisions:',
      error
    );
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Failed to fetch similar decisions. Please try again.'
    );
  }
}

/**
 * Get decisions by same moderator for COI checking
 *
 * Requirement: 2.5
 */
export async function apiGetDecisionsByModerator(
  moderatorId: string,
  contentUserId: string
): Promise<ModerationDecision[]> {
  try {
    const response = await client.get<ModerationDecision[]>(
      '/moderation/decisions',
      {
        params: {
          moderator_id: moderatorId,
          user_id: contentUserId,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error(
      '[SimilarDecisionsAPI] Failed to fetch moderator decisions:',
      error
    );
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Failed to fetch moderator decisions. Please try again.'
    );
  }
}

/**
 * Get decision consistency metrics for a moderator
 *
 * Requirement: 2.7
 */
export async function apiGetModeratorConsistency(
  moderatorId: string
): Promise<ModeratorConsistencyMetrics> {
  try {
    const response = await client.get<ModeratorConsistencyMetrics>(
      `/moderation/moderators/${moderatorId}/consistency`
    );
    return response.data;
  } catch (error) {
    console.error(
      '[SimilarDecisionsAPI] Failed to fetch moderator consistency:',
      error
    );
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Failed to fetch moderator consistency metrics. Please try again.'
    );
  }
}

/**
 * Get decision pattern analysis for content creator
 *
 * Requirement: 2.2
 */
export async function apiGetUserViolationPattern(
  userId: string
): Promise<UserViolationPattern> {
  try {
    const response = await client.get<UserViolationPattern>(
      `/moderation/users/${userId}/violation-pattern`
    );
    return response.data;
  } catch (error) {
    console.error(
      '[SimilarDecisionsAPI] Failed to fetch user violation pattern:',
      error
    );
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Failed to fetch user violation pattern. Please try again.'
    );
  }
}
