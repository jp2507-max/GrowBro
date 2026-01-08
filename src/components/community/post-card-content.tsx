/**
 * PostCardContent - Row 4: Caption limited to 3 lines
 * Used by PostCard component for the "Instagram Pro" clean design
 */

import React from 'react';

import { Text, View } from '@/components/ui';

export type PostCardContentProps = {
  body?: string | null;
  testID: string;
};

export function PostCardContent({ body, testID }: PostCardContentProps) {
  if (!body) return null;
  return (
    <View className="px-4 pb-5">
      <Text
        numberOfLines={3}
        className="text-sm leading-relaxed text-neutral-800 dark:text-neutral-200"
        testID={`${testID}-body`}
      >
        {body}
      </Text>
    </View>
  );
}
