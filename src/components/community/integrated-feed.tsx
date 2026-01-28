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
import type { ViewToken } from 'react-native';

import type { Post as ApiPost } from '@/api/posts';
import { View } from '@/components/ui';
import {
  getCommunityPrefetchUris,
  prefetchCommunityImages,
} from '@/lib/community/image-optimization';
import { getOptimizedFlashListConfig } from '@/lib/flashlist-config';
import { useIntegratedAgeVerification } from '@/lib/moderation/use-integrated-age-verification';
import { useIntegratedGeoRestrictions } from '@/lib/moderation/use-integrated-geo-restrictions';

import { CommunitySkeletonList } from './community-skeleton-list';
import { FeedWithGeoNotice } from './feed-with-geo-notice';
import { useFeedCallbacks } from './use-feed-callbacks';
import { useFilteredPosts } from './use-filtered-posts';

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
  const {
    isAgeVerified,
    isLoading: isAgeLoading,
    verifyAge,
  } = useIntegratedAgeVerification();

  const {
    userCountry,
    isLoading: isGeoLoading,
    checkContentAvailability,
  } = useIntegratedGeoRestrictions();

  const { filteredPosts, isFiltering } = useFilteredPosts({
    posts,
    isAgeVerified,
    userCountry,
    isAgeLoading,
    isGeoLoading,
    checkContentAvailability,
  });

  const handleVerifyPress = useCallback(() => {
    verifyAge().catch((error) => {
      console.error('Error verifying age:', error);
    });
  }, [verifyAge]);

  const { renderItem, keyExtractor, ListEmptyComponent, ListFooterComponent } =
    useFeedCallbacks({
      isAgeVerified,
      onDelete,
      handleVerifyPress,
      testID,
      isFetchingNextPage,
    });
  const flashListConfig = useMemo(() => getOptimizedFlashListConfig(), []);
  const viewabilityConfig = useMemo(
    () => ({ itemVisiblePercentThreshold: 50, minimumViewTime: 80 }),
    []
  );

  const handleViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const visiblePosts = viewableItems
        .map((item) => item.item as ApiPost | undefined)
        .filter((item): item is ApiPost => Boolean(item));

      const indices = viewableItems
        .map((item) => (typeof item.index === 'number' ? item.index : -1))
        .filter((index) => index >= 0);

      const maxIndex = indices.length > 0 ? Math.max(...indices) : -1;
      const nextPosts =
        maxIndex >= 0
          ? filteredPosts.slice(maxIndex + 1, maxIndex + 1 + 6)
          : [];

      const uris = getCommunityPrefetchUris([...visiblePosts, ...nextPosts]);
      if (uris.length > 0) {
        prefetchCommunityImages(uris);
      }
    },
    [filteredPosts]
  );

  if (isLoading || isAgeLoading || isGeoLoading || isFiltering) {
    return <CommunitySkeletonList />;
  }

  if (userCountry && filteredPosts.length < posts.length) {
    const blockedCount = posts.length - filteredPosts.length;
    return (
      <FeedWithGeoNotice
        filteredPosts={filteredPosts}
        blockedCount={blockedCount}
        userCountry={userCountry}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        onEndReached={onEndReached}
        ListEmptyComponent={ListEmptyComponent}
        ListFooterComponent={ListFooterComponent}
        testID={testID}
      />
    );
  }

  return (
    <View testID={testID}>
      <FlashList
        data={filteredPosts}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        onRefresh={onRefresh}
        refreshing={isRefreshing}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        ListEmptyComponent={ListEmptyComponent}
        ListFooterComponent={ListFooterComponent}
        scrollEventThrottle={flashListConfig.scrollEventThrottle}
        removeClippedSubviews={flashListConfig.removeClippedSubviews}
        drawDistance={flashListConfig.drawDistance}
      />
    </View>
  );
}
