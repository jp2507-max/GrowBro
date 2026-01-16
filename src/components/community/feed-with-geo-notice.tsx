/**
 * Feed with Geo-Restriction Notice Component
 */

import { FlashList } from '@shopify/flash-list';
import React from 'react';

import type { Post as ApiPost } from '@/api/posts';
import { Text, View } from '@/components/ui';
import { translate } from '@/lib/i18n';

interface FeedWithGeoNoticeProps {
  filteredPosts: ApiPost[];
  blockedCount: number;
  userCountry: string;
  renderItem: ({ item }: { item: ApiPost }) => React.ReactElement;
  keyExtractor: (item: ApiPost) => string;
  onRefresh?: () => void;
  isRefreshing: boolean;
  onEndReached?: () => void;
  ListEmptyComponent: React.ReactElement;
  ListFooterComponent: React.ReactElement | null;
  testID: string;
}

export function FeedWithGeoNotice({
  filteredPosts,
  blockedCount,
  userCountry,
  renderItem,
  keyExtractor,
  onRefresh,
  isRefreshing,
  onEndReached,
  ListEmptyComponent,
  ListFooterComponent,
  testID,
}: FeedWithGeoNoticeProps): React.ReactElement {
  return (
    <View className="flex-1">
      <View className="m-4 rounded-lg border border-warning-300 bg-warning-50 p-4 dark:border-warning-700 dark:bg-warning-950">
        <Text className="text-sm font-medium text-warning-800 dark:text-warning-200">
          {translate('moderation.geo_restriction_notice', {
            count: blockedCount,
            country: userCountry,
          })}
        </Text>
      </View>
      <View testID={testID}>
        <FlashList
          data={filteredPosts}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          onRefresh={onRefresh}
          refreshing={isRefreshing}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={ListEmptyComponent}
          ListFooterComponent={ListFooterComponent}
        />
      </View>
    </View>
  );
}
