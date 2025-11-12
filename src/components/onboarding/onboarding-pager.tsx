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
  const startTimeRef = React.useRef<number>(Date.now());
  const slideTimesRef = React.useRef<Record<number, number>>({});
  const previousIndexRef = React.useRef<number>(0);
  const [currentIndex, setCurrentIndex] = React.useState(0);

  React.useEffect(() => {
    slideTimesRef.current[0] = Date.now();
  }, []);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event: any) => {
      'worklet';
      activeIndex.value = event.contentOffset.x / event.layoutMeasurement.width;
    },
  });

  const ctaStyle = useAnimatedStyle(() => {
    'worklet';
    const opacity = interpolate(
      activeIndex.value,
      [Math.max(lastIndex - 1, 0), lastIndex],
      [0, 1]
    );
    return { opacity };
  });

  const handleScrollEnd = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(event.nativeEvent.contentOffset.x / width);
      setCurrentIndex(index);
      const now = Date.now();
      const indexLeft = previousIndexRef.current;
      if (
        indexLeft !== index &&
        slideTimesRef.current[indexLeft] !== undefined
      ) {
        const duration = now - slideTimesRef.current[indexLeft];
        trackOnboardingStepComplete(`slide_${indexLeft}`, duration);
      }
      slideTimesRef.current[index] = now;
      previousIndexRef.current = index;
    },
    [width]
  );

  const handleDone = React.useCallback(() => {
    const now = Date.now();
    const currentSlideIndex = previousIndexRef.current;
    if (slideTimesRef.current[currentSlideIndex] !== undefined) {
      const duration = now - slideTimesRef.current[currentSlideIndex];
      trackOnboardingStepComplete(`slide_${currentSlideIndex}`, duration);
    }
    const totalDuration = now - startTimeRef.current;
    trackOnboardingComplete(totalDuration, slides.length);
    onComplete();
  }, [onComplete, slides.length]);

  const handleSkip = React.useCallback(() => {
    const now = Date.now();
    const currentSlideIndex = previousIndexRef.current;
    if (slideTimesRef.current[currentSlideIndex] !== undefined) {
      const duration = now - slideTimesRef.current[currentSlideIndex];
      trackOnboardingStepComplete(`slide_${currentSlideIndex}`, duration);
    }
    const currentSlide = Math.round(activeIndex.value);
    trackOnboardingSkipped(`slide_${currentSlide}`, 'user_skip');
    onComplete();
  }, [onComplete, activeIndex]);

  const ctaEnabled = currentIndex >= lastIndex - 0.001;

  return (
    <AnimatedIndexProvider activeIndex={activeIndex}>
      <View className="flex-1 bg-white dark:bg-charcoal-950" testID={testID}>
        <FocusAwareStatusBar />
        {showSkip && <SkipButton onPress={handleSkip} />}
        <OnboardingScrollView
          scrollRef={scrollRef}
          width={width}
          slides={slides}
          onScroll={onScroll}
          onScrollEnd={handleScrollEnd}
        />
        <PaginationDots count={slides.length} activeIndex={activeIndex} />
        <DoneButton
          ctaStyle={ctaStyle}
          ctaEnabled={ctaEnabled}
          onPress={handleDone}
        />
      </View>
    </AnimatedIndexProvider>
  );
}
