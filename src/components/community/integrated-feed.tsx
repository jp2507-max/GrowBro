/**
 * Integrated Feed Component
 *
 * Community feed with full moderation integration:
 * - Age-gating enforcement
 * - Geo-restriction filtering
 * - Content reporting
 * - Moderation status display
 *
 * Requirements: 1.1, 8.7, 9.4
 */

import { FlashList } from '@shopify/flash-list';
import React, { useCallback, useMemo } from 'react';

import type { Post as ApiPost } from '@/api/posts';
import { Text, View } from '@/components/ui';
import { translate } from '@/lib/i18n';
import { useIntegratedAgeVerification } from '@/lib/moderation/use-integrated-age-verification';
import { useIntegratedGeoRestrictions } from '@/lib/moderation/use-integrated-geo-restrictions';

import { CommunityEmptyState } from './community-empty-state';
import { CommunityFooterLoader } from './community-footer-loader';
import { CommunitySkeletonList } from './community-skeleton-list';
import { ModeratedPostCard } from './moderated-post-card';

interface IntegratedFeedProps {
  posts: ApiPost[];
  isLoading?: boolean;
  isRefreshing?: boolean;
  isFetchingNextPage?: boolean;
  onRefresh?: () => void;
  onEndReached?: () => void;
  onDelete?: (postId: number | string, undoExpiresAt: string) => void;
  testID?: string;
}

export function IntegratedFeed({
  posts,
  isLoading = false,
  isRefreshing = false,
  isFetchingNextPage = false,
  onRefresh,
  onEndReached,
  onDelete,
  testID = 'integrated-feed',
}: IntegratedFeedProps): React.ReactElement {
  // Age verification integration
  const {
    isAgeVerified,
    isLoading: isAgeLoading,
    verifyAge,
  } = useIntegratedAgeVerification();

  // Geo-restrictions integration
  const {
    userCountry,
    isLoading: isGeoLoading,
    checkContentAvailability,
  } = useIntegratedGeoRestrictions();

  // Filter posts based on moderation, age-gating, and geo-restrictions
  const [filteredPosts, setFilteredPosts] = React.useState<ApiPost[]>([]);
  const [isFiltering, setIsFiltering] = React.useState(false);

  React.useEffect(() => {
    const filterPosts = async () => {
      if (isAgeLoading || isGeoLoading) return;

      setIsFiltering(true);
      try {
        // Apply age-gating filter
        let filtered = posts;
        if (!isAgeVerified) {
          filtered = posts.filter((post) => !post.is_age_restricted);
        }

        // Apply geo-restriction filter
        if (userCountry) {
          const availabilityChecks = await Promise.all(
            filtered.map((post) => checkContentAvailability(String(post.id)))
          );
          filtered = filtered.filter((_, index) => availabilityChecks[index]);
        }

        setFilteredPosts(filtered);
      } catch (error) {
        console.error('Error filtering posts:', error);
        // On error, show all posts to avoid blocking content
        setFilteredPosts(posts);
      } finally {
        setIsFiltering(false);
      }
    };

    filterPosts();
  }, [
    posts,
    isAgeVerified,
    userCountry,
    isAgeLoading,
    isGeoLoading,
    checkContentAvailability,
  ]);

  const handleVerifyPress = useCallback(() => {
    verifyAge().catch((error) => {
      console.error('Error verifying age:', error);
    });
  }, [verifyAge]);

  const renderItem = useCallback(
    ({ item }: { item: ApiPost }) => (
      <ModeratedPostCard
        post={item}
        isAgeVerified={isAgeVerified}
        onDelete={onDelete}
        onVerifyPress={handleVerifyPress}
        testID={`${testID}-post-${item.id}`}
      />
    ),
    [isAgeVerified, onDelete, handleVerifyPress, testID]
  );

  const keyExtractor = useCallback((item: ApiPost) => String(item.id), []);

  const ListEmptyComponent = useMemo(
    () => (
      <CommunityEmptyState
        message={translate('community.no_posts')}
        testID={`${testID}-empty`}
      />
    ),
    [testID]
  );

  const ListFooterComponent = useMemo(
    () =>
      isFetchingNextPage ? (
        <CommunityFooterLoader testID={`${testID}-footer-loader`} />
      ) : null,
    [isFetchingNextPage, testID]
  );

  // Show loading skeleton
  if (isLoading || isAgeLoading || isGeoLoading || isFiltering) {
    return <CommunitySkeletonList testID={`${testID}-skeleton`} />;
  }

  // Show geo-restriction notice if applicable
  if (userCountry && filteredPosts.length < posts.length) {
    const blockedCount = posts.length - filteredPosts.length;
    return (
      <View className="flex-1">
        <View className="dark:bg-warning-950 m-4 rounded-lg border border-warning-300 bg-warning-50 p-4 dark:border-warning-700">
          <Text className="text-sm font-medium text-warning-800 dark:text-warning-200">
            {translate('moderation.geo_restriction_notice', {
              count: blockedCount,
              country: userCountry,
            })}
          </Text>
        </View>
        <FlashList
          data={filteredPosts}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          estimatedItemSize={400}
          onRefresh={onRefresh}
          refreshing={isRefreshing}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={ListEmptyComponent}
          ListFooterComponent={ListFooterComponent}
          testID={testID}
        />
      </View>
    );
  }

  return (
    <FlashList
      data={filteredPosts}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      estimatedItemSize={400}
      onRefresh={onRefresh}
      refreshing={isRefreshing}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={ListEmptyComponent}
      ListFooterComponent={ListFooterComponent}
      testID={testID}
    />
  );
}
