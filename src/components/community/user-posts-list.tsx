/**
 * UserPostsList component
 *
 * Displays paginated list of user's posts with infinite scroll
 */

import { FlashList } from '@shopify/flash-list';
import React from 'react';

import type { Post } from '@/api/community';
import { ActivityIndicator, Text, View } from '@/components/ui';
import { normalizePostUserId } from '@/lib/community/post-utils';
import { translate } from '@/lib/i18n';

import { PostCard } from './post-card';

interface UserPostsListProps {
  posts: Post[];
  isLoading: boolean;
  isFetchingNextPage: boolean;
  hasNextPage: boolean;
  onEndReached: () => void;
  onPostDelete?: (postId: number | string, undoExpiresAt: string) => void;
  testID?: string;
}

export function UserPostsList({
  posts,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  onEndReached,
  onPostDelete,
  testID = 'user-posts-list',
}: UserPostsListProps): React.ReactElement {
  if (isLoading) {
    return (
      <View
        className="flex-1 items-center justify-center p-8"
        testID={`${testID}-loading`}
      >
        <ActivityIndicator />
        <Text className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
          {translate('community.loading')}
        </Text>
      </View>
    );
  }

  if (posts.length === 0) {
    return (
      <View
        className="flex-1 items-center justify-center p-8"
        testID={`${testID}-empty`}
      >
        <Text className="text-center text-base text-neutral-600 dark:text-neutral-400">
          {translate('profile.no_posts')}
        </Text>
      </View>
    );
  }

  return (
    <FlashList
      data={posts}
      renderItem={({ item }) => (
        <PostCard
          post={normalizePostUserId(item)}
          onDelete={onPostDelete}
          testID={`${testID}-post-${item.id}`}
        />
      )}
      onEndReached={hasNextPage ? onEndReached : undefined}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        isFetchingNextPage ? (
          <View className="p-4">
            <ActivityIndicator />
          </View>
        ) : null
      }
      testID={testID}
    />
  );
}
