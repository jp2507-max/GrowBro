/**
 * PostCardContent - Row 4: Caption with "Read More" link
 * Premium "Deep Garden" design with better typography
 */

import React from 'react';

import { Text, View } from '@/components/ui';
import { translate } from '@/lib/i18n';

export type PostCardContentProps = {
  body?: string | null;
  testID: string;
};

const MAX_CHARACTERS = 120;

export function PostCardContent({
  body,
  testID,
}: PostCardContentProps): React.ReactElement | null {
  if (!body) return null;

  const shouldTruncate = body.length > MAX_CHARACTERS;
  const displayText = shouldTruncate
    ? `${body.slice(0, MAX_CHARACTERS).trim()}...`
    : body;

  return (
    <View className="flex-1">
      <Text
        className="text-sm leading-relaxed text-neutral-800 dark:text-neutral-200"
        testID={`${testID}-body`}
      >
        {displayText}
      </Text>
      {shouldTruncate && (
        <Text className="mt-2 self-end text-sm font-medium text-primary-600 dark:text-primary-300">
          {translate('common.read_more')}
        </Text>
      )}
    </View>
  );
}
