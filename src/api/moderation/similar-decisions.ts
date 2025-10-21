/**
 * React Query hooks for similar decisions and conflict-of-interest checking
 * Requirements: 2.2, 2.5, 4.5
 */

import { createQuery } from 'react-query-kit';

import { apiCheckConflictOfInterest } from './conflict-of-interest-api';
import {
  apiFindSimilarDecisions,
  apiGetModeratorConsistency,
  apiGetUserViolationPattern,
} from './similar-decisions-api';

/**
 * Find similar decisions for context
 */
export const useSimilarDecisions = createQuery({
  queryKey: ['moderation', 'similar-decisions'],
  fetcher: (variables: {
    contentId: string;
    category: string;
    limit?: number;
  }) =>
    apiFindSimilarDecisions(
      variables.contentId,
      variables.category,
      variables.limit || 5
    ),
});

/**
 * Check conflict of interest
 */
export const useConflictOfInterest = createQuery({
  queryKey: ['moderation', 'conflict-of-interest'],
  fetcher: (variables: { reportId: string; moderatorId: string }) =>
    apiCheckConflictOfInterest(variables.reportId, variables.moderatorId),
});

/**
 * Get moderator consistency metrics
 */
export const useModeratorConsistency = createQuery({
  queryKey: ['moderation', 'moderator-consistency'],
  fetcher: (variables: { moderatorId: string }) =>
    apiGetModeratorConsistency(variables.moderatorId),
  staleTime: 60 * 1000, // 1 minute
});

/**
 * Get user violation pattern
 */
export const useUserViolationPattern = createQuery({
  queryKey: ['moderation', 'user-violation-pattern'],
  fetcher: (variables: { userId: string }) =>
    apiGetUserViolationPattern(variables.userId),
  staleTime: 5 * 60 * 1000, // 5 minutes
});
