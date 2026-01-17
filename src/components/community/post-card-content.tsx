/**
 * PostCardContent - Row 4: Caption with "Read More" link
 * Premium "Deep Garden" design with better typography
 */

import React from 'react';

import { Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
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
    <View className="px-4 pb-5">
      <Text
        className="text-sm leading-relaxed text-neutral-800 dark:text-neutral-200"
        testID={`${testID}-body`}
      >
        {displayText}
        {shouldTruncate && (
          <Text
            className="text-sm font-medium"
            style={{ color: colors.primary[600] }}
          >
            {' '}
            {translate('common.read_more')}
          </Text>
        )}
      </Text>
    </View>
  );
}
