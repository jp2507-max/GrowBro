/**
 * Helper hooks and functions for IntegratedFeed
 */

import React, { useCallback, useMemo } from 'react';

import type { Post as ApiPost } from '@/api/posts';

import { CommunityEmptyState } from './community-empty-state';
import { CommunityFooterLoader } from './community-footer-loader';
import { ModeratedPostCard } from './moderated-post-card';

interface UseFeedCallbacksParams {
  isAgeVerified: boolean;
  onDelete?: (postId: number | string, undoExpiresAt: string) => void;
  handleVerifyPress: () => void;
  testID: string;
  isFetchingNextPage: boolean;
}

export function useFeedCallbacks({
  isAgeVerified,
  onDelete,
  handleVerifyPress,
  testID,
  isFetchingNextPage,
}: UseFeedCallbacksParams) {
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

  const ListEmptyComponent = useMemo(() => <CommunityEmptyState />, []);

  const ListFooterComponent = useMemo(() => {
    if (isFetchingNextPage) {
      return <CommunityFooterLoader isVisible={true} />;
    }
    return null;
  }, [isFetchingNextPage]);

  return {
    renderItem,
    keyExtractor,
    ListEmptyComponent,
    ListFooterComponent,
  };
}
