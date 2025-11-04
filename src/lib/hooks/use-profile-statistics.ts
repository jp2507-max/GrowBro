/**
 * Hook to fetch user profile statistics
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.7, 10.8
 *
 * Queries WatermelonDB for account statistics with caching and throttling.
 * Updates automatically when data changes with diff-based updates to avoid jank.
 *
 * eslint-disable-next-line max-lines-per-function -- Complex data aggregation hook
 */

import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@nozbe/watermelondb/react';
import { useCallback, useEffect, useState } from 'react';

import type { PostModel } from '@/lib/watermelon-models/post';
import type { ProfileStatistics } from '@/types/settings';

const THROTTLE_MS = 250;

export interface UseProfileStatisticsResult extends ProfileStatistics {
  isLoading: boolean;
  isSyncing: boolean;
  refresh: () => Promise<void>;
}

// eslint-disable-next-line max-lines-per-function
export function useProfileStatistics(
  userId: string
): UseProfileStatisticsResult {
  const database = useDatabase();
  const [statistics, setStatistics] = useState<ProfileStatistics>({
    plantsCount: 0,
    harvestsCount: 0,
    postsCount: 0,
    likesReceived: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number>(0);

  const fetchStatistics = useCallback(async () => {
    if (!database) {
      setIsLoading(false);
      return;
    }

    try {
      // Throttle updates to avoid jank (max once per 250ms) - Requirement 10.7
      const now = Date.now();
      if (now - lastUpdate < THROTTLE_MS) {
        return;
      }
      setLastUpdate(now);

      // Query plants count (filter by user_id if available)
      const plantsCollection = database.collections.get('plants');
      const plants = await plantsCollection
        .query(Q.where('user_id', userId))
        .fetchCount();

      // Query harvests count
      const harvestsCollection = database.collections.get('harvests');
      const harvests = await harvestsCollection
        .query(Q.where('user_id', userId))
        .fetchCount();

      // Query posts count (if table exists)
      let posts = 0;
      try {
        const postsCollection = database.collections.get('posts');
        posts = await postsCollection
          .query(Q.where('user_id', userId))
          .fetchCount();
      } catch {
        // Table doesn't exist yet, keep posts at 0
      }

      // Query likes received (count likes on user's posts)
      let likesReceived = 0;
      try {
        const postsCollection = database.collections.get('posts');
        const userPosts = await postsCollection
          .query(Q.where('user_id', userId))
          .fetch();

        // Count likes for each post
        for (const post of userPosts) {
          const postLikesCount = await (post as PostModel).likes.fetchCount();
          likesReceived += postLikesCount;
        }
      } catch {
        // Table doesn't exist yet or query failed, keep likes at 0
      }

      setStatistics({
        plantsCount: plants,
        harvestsCount: harvests,
        postsCount: posts,
        likesReceived,
      });
    } catch (error) {
      console.error('Failed to fetch profile statistics:', error);
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, [database, userId, lastUpdate]);

  const refresh = useCallback(async () => {
    setIsSyncing(true);
    await fetchStatistics();
  }, [fetchStatistics]);

  useEffect(() => {
    void fetchStatistics();

    // Set up observables to watch for changes - Requirement 10.4
    if (!database) return;

    const subscriptions: (() => void)[] = [];

    try {
      // Observe plants changes
      const plantsCollection = database.collections.get('plants');
      const plantsSubscription = plantsCollection
        .query()
        .observe()
        .subscribe(() => {
          void fetchStatistics();
        });
      subscriptions.push(() => plantsSubscription.unsubscribe());
    } catch {
      // Table doesn't exist yet
    }

    try {
      // Observe harvests changes
      const harvestsCollection = database.collections.get('harvests');
      const harvestsSubscription = harvestsCollection
        .query()
        .observe()
        .subscribe(() => {
          void fetchStatistics();
        });
      subscriptions.push(() => harvestsSubscription.unsubscribe());
    } catch {
      // Table doesn't exist yet
    }

    try {
      // Observe posts changes
      const postsCollection = database.collections.get('posts');
      const postsSubscription = postsCollection
        .query(Q.where('user_id', userId))
        .observe()
        .subscribe(() => {
          void fetchStatistics();
        });
      subscriptions.push(() => postsSubscription.unsubscribe());
    } catch {
      // Table doesn't exist yet
    }

    try {
      // Observe post_likes changes (affects likes received count)
      const postLikesCollection = database.collections.get('post_likes');
      const postLikesSubscription = postLikesCollection
        .query()
        .observe()
        .subscribe(() => {
          void fetchStatistics();
        });
      subscriptions.push(() => postLikesSubscription.unsubscribe());
    } catch {
      // Table doesn't exist yet
    }

    return () => {
      subscriptions.forEach((unsubscribe) => unsubscribe());
    };
  }, [database, fetchStatistics, userId]);

  return {
    ...statistics,
    isLoading,
    isSyncing, // Requirement 10.8: Show syncing indicator
    refresh,
  };
}
