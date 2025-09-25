import React from 'react';

import { Button, Text, View } from '@/components/ui';
import { translate } from '@/lib';

type Props = {
  onCreatePress: () => void;
};

export function CommunityEmptyState({
  onCreatePress,
}: Props): React.ReactElement {
  return (
    <View
      testID="community-empty-state"
      className="flex-1 items-center justify-center gap-6 px-6 py-12"
    >
      <View className="items-center gap-3">
        <Text className="text-center text-base text-neutral-600 dark:text-neutral-300">
          {translate('community.empty_state')}
        </Text>
      </View>
      <Button
        label={translate('community.create_post')}
        onPress={onCreatePress}
        accessibilityHint={translate(
          'accessibility.community.create_post_hint'
        )}
        accessibilityRole="button"
        testID="community-empty-state-create"
      />
    </View>
  );
}
