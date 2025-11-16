/**
 * Onboarding Button Components
 * Extracted to keep OnboardingPager under line limit
 */

import React from 'react';
import type {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
} from 'react-native';
import Animated from 'react-native-reanimated';

import { Button, SafeAreaView, View } from '@/components/ui';
import { translate } from '@/lib/i18n';

import type { OnboardingSlideProps } from './onboarding-pager';

type SkipButtonProps = {
  onPress: () => void;
};

export function SkipButton({ onPress }: SkipButtonProps) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']}>
      <View className="flex-row justify-end px-4 py-2">
        <Button
          variant="ghost"
          label={translate('onboarding.skip')}
          onPress={onPress}
          testID="onboarding-skip-button"
        />
      </View>
    </SafeAreaView>
  );
}

type DoneButtonProps = {
  ctaStyle: AnimatedStyleProp<{ opacity: number }>;
  ctaEnabled: boolean;
  onPress: () => void;
};

export function DoneButton({ ctaStyle, ctaEnabled, onPress }: DoneButtonProps) {
  return (
    <SafeAreaView edges={['bottom', 'left', 'right']}>
      <Animated.View
        style={ctaStyle}
        className="px-6 pb-4"
        pointerEvents={ctaEnabled ? 'auto' : 'none'}
      >
        <Button
          label={translate('onboarding.done')}
          onPress={onPress}
          testID="onboarding-done-button"
          disabled={!ctaEnabled}
        />
      </Animated.View>
    </SafeAreaView>
  );
}

type OnboardingScrollViewProps = {
  scrollRef: React.RefObject<ScrollView | null>;
  width: number;
  slides: React.ComponentType<OnboardingSlideProps>[];
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollEnd: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

export function OnboardingScrollView({
  scrollRef,
  width,
  slides,
  onScroll,
  onScrollEnd,
}: OnboardingScrollViewProps) {
  return (
    <Animated.ScrollView
      ref={scrollRef}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={onScroll}
      onMomentumScrollEnd={onScrollEnd}
      decelerationRate="fast"
      snapToInterval={width}
      snapToAlignment="start"
      contentContainerClassName="flex-grow"
      testID="onboarding-scroll-view"
      accessibilityRole="none"
    >
      {slides.map((SlideComponent, index) => (
        <View
          key={index}
          style={{ width }}
          className="flex-1"
          testID={`onboarding-slide-${index}`}
        >
          <SlideComponent index={index} />
        </View>
      ))}
    </Animated.ScrollView>
  );
}
