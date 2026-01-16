/**
 * Hook to fetch user profile statistics
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.7, 10.8
 *
 * Queries WatermelonDB for account statistics with caching and throttling.
 * Updates automatically when data changes with diff-based updates to avoid jank.
 *
 * eslint-disable-next-line max-lines-per-function -- Complex data aggregation hook
 */

import type { Database } from '@nozbe/watermelondb';
import { Q } from '@nozbe/watermelondb';
import { useDatabase } from '@nozbe/watermelondb/react';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ProfileStatistics } from '@/types/settings';

const THROTTLE_MS = 250;

async function queryUserCounts(
  database: Database,
  userId: string
): Promise<Pick<ProfileStatistics, 'plantsCount' | 'harvestsCount'>> {
  let plantsCount = 0;
  let harvestsCount = 0;

  try {
    const plantsCollection = database.collections.get('plants');
    plantsCount = await plantsCollection
      .query(Q.where('user_id', userId), Q.where('deleted_at', null))
      .fetchCount();

    const harvestsCollection = database.collections.get('harvests');
    harvestsCount = await harvestsCollection
      .query(Q.where('user_id', userId), Q.where('deleted_at', null))
      .fetchCount();
  } catch {
    // Table doesn't exist yet, keep defaults at 0
  }

  return { plantsCount, harvestsCount };
}

async function queryPostsAndLikes(
  database: Database,
  userId: string
): Promise<Pick<ProfileStatistics, 'postsCount' | 'likesReceived'>> {
  let postsCount = 0;
  let likesReceived = 0;

  try {
    const postsCollection = database.collections.get('posts');
    const userPostIds = await postsCollection
      .query(
        Q.where('user_id', userId),
        Q.where('deleted_at', null),
        Q.where('hidden_at', null)
      )
      .fetchIds();

    postsCount = userPostIds.length;

    if (postsCount > 0) {
      const postLikesCollection = database.collections.get('post_likes');
      likesReceived = await postLikesCollection
        .query(Q.where('post_id', Q.oneOf(userPostIds)))
        .fetchCount();
    }
  } catch {
    // Table doesn't exist yet, keep defaults at 0
  }

  return { postsCount, likesReceived };
}

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
  const lastUpdateRef = useRef<number>(0);
  const inFlightRef = useRef<Promise<boolean> | null>(null);
  const pendingRef = useRef(false);
  const rerunTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runStatisticsQuery = useCallback(async (): Promise<boolean> => {
    // Throttle updates to avoid jank (max once per 250ms) - Requirement 10.7
    const now = Date.now();
    if (now - lastUpdateRef.current < THROTTLE_MS) {
      return false;
    }
    lastUpdateRef.current = now;

    const [userCounts, postsAndLikes] = await Promise.all([
      queryUserCounts(database, userId),
      queryPostsAndLikes(database, userId),
    ]);

    setStatistics({
      ...userCounts,
      ...postsAndLikes,
    });
    return true;
  }, [database, userId]);

  const fetchStatistics = useCallback(async () => {
    if (!database) {
      setIsLoading(false);
      return;
    }

    // Coalesce callers while an update is already in flight.
    // This avoids piling up concurrent WatermelonDB queries during large sync bursts.
    if (inFlightRef.current) {
      pendingRef.current = true;
      await inFlightRef.current;
      return;
    }

    const run = runStatisticsQuery();
    inFlightRef.current = run;

    try {
      const didRun = await run;
      if (!didRun) {
        pendingRef.current = true;
      }
    } catch (error) {
      console.error('Failed to fetch profile statistics:', error);
    } finally {
      inFlightRef.current = null;
      setIsLoading(false);
      setIsSyncing(false);

      if (pendingRef.current) {
        pendingRef.current = false;
        if (rerunTimeoutRef.current) {
          clearTimeout(rerunTimeoutRef.current);
          rerunTimeoutRef.current = null;
        }

        const delayMs = Math.max(
          0,
          THROTTLE_MS - (Date.now() - lastUpdateRef.current)
        );
        rerunTimeoutRef.current = setTimeout(() => {
          rerunTimeoutRef.current = null;
          void fetchStatistics();
        }, delayMs);
      }
    }
  }, [database, runStatisticsQuery]);

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
        .query(Q.where('user_id', userId))
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
        .query(Q.where('user_id', userId))
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
      // Note: Observes ALL likes since WatermelonDB can't filter by user's posts
      // in a subscription. Throttling mitigates the performance impact.
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
      if (rerunTimeoutRef.current) {
        clearTimeout(rerunTimeoutRef.current);
        rerunTimeoutRef.current = null;
      }
      pendingRef.current = false;
    };
  }, [database, fetchStatistics, userId]);

  return {
    ...statistics,
    isLoading,
    isSyncing, // Requirement 10.8: Show syncing indicator
    refresh,
  };
}
