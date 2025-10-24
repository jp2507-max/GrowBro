/**
 * Content Visibility Hook
 *
 * React hook for checking and subscribing to content visibility changes
 * Integrates moderation decisions, age-gating, and geo-restrictions
 *
 * Requirements:
 * - 1.1: Connect reporting to posts/comments
 * - 8.7: Filter age-restricted content in feeds
 * - 9.4: Connect geo-restrictions to location features
 */

import { useEffect, useState } from 'react';

import { getOptionalAuthenticatedUserId } from '@/lib/auth/user-utils';

import type { ContentVisibilityResult } from './content-visibility-service';
import { contentVisibilityService } from './content-visibility-service';

/**
 * Hook to check content visibility with real-time updates
 *
 * Automatically subscribes to moderation changes and updates visibility status
 */
export function useContentVisibility(
  contentId: string,
  contentType: 'post' | 'comment'
): ContentVisibilityResult & { isLoading: boolean } {
  const [visibility, setVisibility] = useState<
    ContentVisibilityResult & { isLoading: boolean }
  >({
    visible: true,
    isLoading: true,
  });

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | undefined;

    const checkVisibility = async () => {
      try {
        const userId = await getOptionalAuthenticatedUserId();
        const result = await contentVisibilityService.checkContentVisibility(
          contentId,
          contentType,
          userId || undefined
        );

        if (mounted) {
          setVisibility({ ...result, isLoading: false });
        }
      } catch (error) {
        console.error('Error checking content visibility:', error);
        if (mounted) {
          setVisibility({ visible: true, isLoading: false });
        }
      }
    };

    // Initial check
    checkVisibility();

    // Subscribe to real-time updates
    unsubscribe = contentVisibilityService.subscribeToModerationChanges(
      contentId,
      contentType,
      (newVisibility) => {
        if (mounted) {
          setVisibility({ ...newVisibility, isLoading: false });
        }
      }
    );

    return () => {
      mounted = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [contentId, contentType]);

  return visibility;
}

/**
 * Hook to check if user can report content
 *
 * Checks for manifestly unfounded reporter status (DSA Art. 23)
 */
export function useCanReportContent(): {
  canReport: boolean;
  reason?: string;
  isLoading: boolean;
} {
  const [status, setStatus] = useState<{
    canReport: boolean;
    reason?: string;
    isLoading: boolean;
  }>({
    canReport: true,
    isLoading: true,
  });

  useEffect(() => {
    let mounted = true;

    const checkReportPermission = async () => {
      try {
        const userId = await getOptionalAuthenticatedUserId();

        if (!userId) {
          if (mounted) {
            setStatus({ canReport: false, isLoading: false });
          }
          return;
        }

        const { communityIntegration } = await import(
          './community-integration'
        );
        const result = await communityIntegration.canUserReportContent(userId);

        if (mounted) {
          setStatus({
            canReport: result.allowed,
            reason: result.reason,
            isLoading: false,
          });
        }
      } catch (error) {
        console.error('Error checking report permission:', error);
        if (mounted) {
          setStatus({ canReport: true, isLoading: false });
        }
      }
    };

    checkReportPermission();

    return () => {
      mounted = false;
    };
  }, []);

  return status;
}
