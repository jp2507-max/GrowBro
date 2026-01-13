/**
 * Age-Gated Feed Hook
 *
 * React hook for filtering age-restricted content in community feeds
 * Implements DSA Art. 28 age-gating enforcement
 *
 * Requirements:
 * - 8.2: Automatically flag and restrict age-restricted content
 * - 8.3: Redirect unverified users to age verification flow
 * - 8.5: Implement safer defaults for minors
 * - 8.7: Filter age-restricted content in feeds
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Post } from '@/api';
import { getOptionalAuthenticatedUserId } from '@/lib/auth/user-utils';
import { supabase } from '@/lib/supabase';

import { ContentAgeGatingEngine } from './content-age-gating';

interface UseAgeGatedFeedOptions {
  enabled?: boolean;
  onVerificationRequired?: () => void;
}

interface UseAgeGatedFeedResult {
  filterPosts: (posts: Post[]) => Post[];
  isAgeVerified: boolean;
  isLoading: boolean;
  requiresVerification: boolean;
  checkPostAccess: (postId: string) => Promise<boolean>;
}

/**
 * Hook for filtering age-restricted content in community feeds
 */
export function useAgeGatedFeed(
  options: UseAgeGatedFeedOptions = {}
): UseAgeGatedFeedResult {
  const { enabled = true, onVerificationRequired } = options;
  const [userId, setUserId] = useState<string | null>(null);
  const [isAgeVerified, setIsAgeVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [requiresVerification, setRequiresVerification] = useState(false);

  const gatingEngine = useMemo(() => new ContentAgeGatingEngine(supabase), []);

  // Get user ID on mount
  useEffect(() => {
    getOptionalAuthenticatedUserId().then(setUserId);
  }, []);

  // Check user age verification status
  useEffect(() => {
    if (!enabled || !userId) {
      setIsLoading(false);
      return;
    }

    checkAgeStatus(userId, setIsAgeVerified, setRequiresVerification).finally(
      () => setIsLoading(false)
    );
  }, [enabled, userId]);

  const filterPosts = useCallback(
    (posts: Post[]): Post[] => {
      if (!enabled || isAgeVerified || !userId) return posts;
      return posts.filter((post) => !post.is_age_restricted);
    },
    [enabled, isAgeVerified, userId]
  );

  const checkPostAccess = useCallback(
    async (postId: string): Promise<boolean> => {
      if (!enabled || !userId) return true;

      try {
        const result = await gatingEngine.checkAgeGating(
          userId,
          postId,
          'post'
        );
        if (!result.granted && result.requiresVerification) {
          setRequiresVerification(true);
          onVerificationRequired?.();
        }
        return result.granted;
      } catch (error) {
        console.error('Failed to check post access:', error);
        return false;
      }
    },
    [enabled, userId, gatingEngine, onVerificationRequired]
  );

  return {
    filterPosts,
    isAgeVerified,
    isLoading,
    requiresVerification,
    checkPostAccess,
  };
}

async function checkAgeStatus(
  userId: string,
  setIsAgeVerified: (value: boolean) => void,
  setRequiresVerification: (value: boolean) => void
): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('user_age_status')
      .select('is_age_verified')
      .eq('user_id', userId)
      .limit(1);

    if (error) {
      throw error;
    }

    const isVerified = data?.[0]?.is_age_verified ?? false;
    setIsAgeVerified(isVerified);
    setRequiresVerification(!isVerified);
  } catch (error) {
    console.error('Failed to check age status:', error);
    setIsAgeVerified(false);
    setRequiresVerification(true);
  }
}
