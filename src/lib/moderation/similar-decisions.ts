/**
 * Similar decisions service for moderator context and consistency
 * Retrieves prior moderation decisions for similar content
 * Requirements: 2.2, 2.7
 */

import type {
  ModerationAction,
  ModerationDecision,
  PriorDecision,
} from '@/types/moderation';

/**
 * Find similar decisions based on content similarity
 */
export async function findSimilarDecisions(
  contentId: string,
  category: string,
  limit = 5
): Promise<PriorDecision[]> {
  // TODO: Replace with actual Supabase query using vector similarity or content hash matching
  const response = await fetch(
    `/api/moderation/similar-decisions?content_id=${encodeURIComponent(contentId)}&category=${encodeURIComponent(category)}&limit=${limit}`,
    {
      headers: {
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch similar decisions: ${response.statusText}`
    );
  }

  const data: PriorDecision[] = await response.json();
  return data;
}

/**
 * Get decisions by same moderator for COI checking
 */
export async function getDecisionsByModerator(
  moderatorId: string,
  contentUserId: string
): Promise<ModerationDecision[]> {
  // TODO: Replace with actual Supabase query
  const response = await fetch(
    `/api/moderation/decisions?moderator_id=${encodeURIComponent(moderatorId)}&user_id=${encodeURIComponent(contentUserId)}`,
    {
      headers: {
        Accept: 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch moderator decisions: ${response.statusText}`
    );
  }

  const data: ModerationDecision[] = await response.json();
  return data;
}

/**
 * Calculate similarity score between two content items
 * Simple implementation - should be replaced with vector similarity or ML model
 */
export function calculateContentSimilarity(
  content1: string,
  content2: string
): number {
  // Normalize and tokenize
  const tokens1 = new Set(
    content1
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );
  const tokens2 = new Set(
    content2
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2)
  );

  // Calculate Jaccard similarity
  const intersection = new Set([...tokens1].filter((t) => tokens2.has(t)));
  const union = new Set([...tokens1, ...tokens2]);

  if (union.size === 0) return 0;

  return intersection.size / union.size;
}

/**
 * Get decision consistency metrics for a moderator
 */
export async function getModeratorConsistency(moderatorId: string): Promise<{
  totalDecisions: number;
  consistencyScore: number; // 0-1
  reversalRate: number; // 0-1
  averageDecisionTime: number; // ms
}> {
  // TODO: Replace with actual Supabase aggregation query
  const response = await fetch(
    `/api/moderation/moderators/${moderatorId}/consistency`
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch moderator consistency: ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * Get decision pattern analysis for content creator
 */
export async function getUserViolationPattern(userId: string): Promise<{
  totalReports: number;
  violationsByCategory: Record<string, number>;
  actions: Record<ModerationAction, number>;
  escalationTrend: 'improving' | 'stable' | 'worsening';
}> {
  // TODO: Replace with actual Supabase aggregation query
  const response = await fetch(
    `/api/moderation/users/${userId}/violation-pattern`
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch user violation pattern: ${response.statusText}`
    );
  }

  return response.json();
}

/**
 * Format similar decision for display in moderator UI
 */
export function formatSimilarDecision(decision: PriorDecision): string {
  const action = decision.action.replace(/_/g, ' ');
  const outcome =
    decision.outcome === 'upheld'
      ? '✓'
      : decision.outcome === 'reversed'
        ? '✗'
        : '⚠';
  const date = new Date(decision.decided_at).toLocaleDateString();

  return `${outcome} ${action} (${date}) - ${Math.round(decision.similarity * 100)}% similar`;
}

/**
 * Group similar decisions by action type
 */
export function groupDecisionsByAction(
  decisions: PriorDecision[]
): Record<ModerationAction, PriorDecision[]> {
  const grouped: Partial<Record<ModerationAction, PriorDecision[]>> = {};

  for (const decision of decisions) {
    if (!grouped[decision.action]) {
      grouped[decision.action] = [];
    }
    grouped[decision.action]!.push(decision);
  }

  return grouped as Record<ModerationAction, PriorDecision[]>;
}

/**
 * Get most common action for similar cases
 */
export function getMostCommonAction(
  decisions: PriorDecision[]
): ModerationAction | null {
  if (decisions.length === 0) return null;

  const actionCounts = new Map<ModerationAction, number>();

  for (const decision of decisions) {
    const count = actionCounts.get(decision.action) || 0;
    actionCounts.set(decision.action, count + 1);
  }

  let maxCount = 0;
  let mostCommon: ModerationAction | null = null;

  actionCounts.forEach((count, action) => {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = action;
    }
  });

  return mostCommon;
}
