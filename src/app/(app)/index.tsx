import { FlashList } from '@shopify/flash-list';
import React from 'react';

import type { Post } from '@/api';
import { usePosts } from '@/api';
import { Card } from '@/components/card';
import { EmptyList, FocusAwareStatusBar, Text, View } from '@/components/ui';

export default function Feed() {
  const { data, isPending, isError } = usePosts();
  const renderItem = React.useCallback(
    ({ item }: { item: Post }) => <Card {...item} />,
    []
  );
  const listData = data ?? [];

  if (isError) {
    return (
      <View>
        <Text> Error Loading data </Text>
      </View>
    );
  }
  return (
    <View className="flex-1 " testID="feed-screen">
      <FocusAwareStatusBar />
      <FlashList
        data={listData}
        renderItem={renderItem}
        keyExtractor={(_, index) => `item-${index}`}
        contentContainerStyle={{ flexGrow: 1 }}
        ListEmptyComponent={<EmptyList isLoading={isPending} />}
      />
    </View>
  );
}
