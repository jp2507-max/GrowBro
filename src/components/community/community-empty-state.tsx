import React from 'react';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { Button, Text, View } from '@/components/ui';
import { translate } from '@/lib';

type Props = {
  onCreatePress?: () => void;
};

export function CommunityEmptyState({
  onCreatePress,
}: Props): React.ReactElement {
  return (
    <View
      testID="community-empty-state"
      className="flex-1 items-center justify-center gap-6 px-6 py-12"
    >
      <Animated.View
        entering={FadeIn.duration(300).reduceMotion(ReduceMotion.System)}
        className="items-center gap-4"
      >
        <Text
          className="text-center text-xl font-semibold text-text-primary"
          tx="community.empty_state_educational.title"
        />

        <View className="w-full gap-4 rounded-2xl border border-border bg-card p-4">
          <Text
            className="text-sm font-medium text-text-primary"
            tx="community.empty_state_educational.moderation_guidance"
          />
        </View>

        <Text className="text-center text-base text-text-secondary">
          {translate('community.empty_state')}
        </Text>
      </Animated.View>

      {onCreatePress && (
        <Animated.View
          entering={FadeIn.duration(300)
            .delay(150)
            .reduceMotion(ReduceMotion.System)}
        >
          <Button
            label={translate('community.empty_state_educational.share_cta')}
            onPress={onCreatePress}
            accessibilityHint={translate(
              'accessibility.community.create_post_hint'
            )}
            accessibilityRole="button"
            testID="community-empty-state-create"
          />
        </Animated.View>
      )}
    </View>
  );
}
