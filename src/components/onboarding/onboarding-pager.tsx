/**
 * Onboarding Pager Component
 * Based on makeitanimated pattern: routes/onboarding.tsx
 *
 * Custom horizontal pager with:
 * - Animated.ScrollView with pagingEnabled
 * - SharedValue activeIndex bridged to AnimatedIndexContext
 * - Pagination dots
 * - Skip/Done buttons integrated with onboarding-state
 * - Reduced Motion support
 * - Full a11y with TalkBack/VoiceOver support
 */

import React from 'react';
import type {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
} from 'react-native';
import { useWindowDimensions } from 'react-native';
import {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { FocusAwareStatusBar, View } from '@/components/ui';
import { AnimatedIndexProvider } from '@/lib/animations/index-context';
import { useOnboardingState } from '@/lib/compliance/onboarding-state';
import {
  trackOnboardingComplete,
  trackOnboardingSkipped,
  trackOnboardingStepComplete,
} from '@/lib/compliance/onboarding-telemetry';

import {
  DoneButton,
  OnboardingScrollView,
  SkipButton,
} from './onboarding-buttons';
import { PaginationDots } from './pagination-dots';

export type OnboardingSlideProps = {
  index: number;
};

type OnboardingPagerProps = {
  slides: React.ComponentType<OnboardingSlideProps>[];
  onComplete: () => void;
  showSkip?: boolean;
  testID?: string;
};

export function OnboardingPager({
  slides,
  onComplete,
  showSkip = true,
  testID = 'onboarding-pager',
}: OnboardingPagerProps): React.ReactElement {
  const { width } = useWindowDimensions();
  const scrollRef = React.useRef<ScrollView | null>(null);
  const activeIndex = useSharedValue(0);
  const lastIndex = slides.length - 1;
  const markAsCompleted = useOnboardingState.markAsCompleted();
  const startTimeRef = React.useRef<number>(Date.now());
  const slideTimesRef = React.useRef<Record<number, number>>({});

  // Track scroll position and update activeIndex
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event: any) => {
      'worklet';
      const x = event.contentOffset.x;
      activeIndex.value = x / width;
    },
  });

  // Handle scroll end for analytics and state tracking
  const handleScrollEnd = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = event.nativeEvent.contentOffset.x;
      const index = Math.round(x / width);

      // Update React state for CTA button enablement
      setCurrentIndex(index);

      // Track slide view with duration
      const now = Date.now();
      const previousTime = slideTimesRef.current[index] ?? now;
      const duration = now - previousTime;
      slideTimesRef.current[index] = now;

      trackOnboardingStepComplete(`slide_${index}`, duration);
    },
    [width]
  );

  // CTA button animated style (fades in on last slide)
  const ctaStyle = useAnimatedStyle(() => {
    'worklet';
    const opacity = interpolate(
      activeIndex.value,
      [Math.max(lastIndex - 1, 0), lastIndex],
      [0, 1]
    );
    return { opacity };
  });

  // CTA button enabled state derived from React state
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const ctaEnabled = currentIndex >= lastIndex - 0.001;

  const handleDone = React.useCallback(() => {
    const totalDuration = Date.now() - startTimeRef.current;
    trackOnboardingComplete(totalDuration, slides.length);
    markAsCompleted();
    onComplete();
  }, [markAsCompleted, onComplete, slides.length]);

  const handleSkip = React.useCallback(() => {
    const currentSlide = Math.round(activeIndex.value);
    trackOnboardingSkipped(`slide_${currentSlide}`, 'user_skip');
    markAsCompleted();
    onComplete();
  }, [markAsCompleted, onComplete, activeIndex]);

  return (
    <AnimatedIndexProvider activeIndex={activeIndex}>
      <View className="flex-1 bg-white dark:bg-charcoal-950" testID={testID}>
        <FocusAwareStatusBar />

        {/* Skip button */}
        {showSkip && <SkipButton onPress={handleSkip} />}

        {/* Horizontal pager */}
        <OnboardingScrollView
          scrollRef={scrollRef}
          width={width}
          slides={slides}
          onScroll={onScroll}
          onScrollEnd={handleScrollEnd}
        />

        {/* Pagination dots */}
        <PaginationDots count={slides.length} activeIndex={activeIndex} />

        {/* Done button (appears on last slide) */}
        <DoneButton
          ctaStyle={ctaStyle}
          ctaEnabled={ctaEnabled}
          onPress={handleDone}
        />
      </View>
    </AnimatedIndexProvider>
  );
}
