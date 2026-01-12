/**
 * Onboarding Pager Component
 * Based on makeitanimated pattern: routes/onboarding.tsx
 *
 * Custom horizontal pager with:
 * - Animated.ScrollView with pagingEnabled
 * - SharedValue activeIndex bridged to AnimatedIndexContext
 * - Pagination dots
 * - Skip/Next/Done buttons integrated with onboarding-state
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
  // @ts-ignore - Reanimated 4.x type exports issue
  useAnimatedScrollHandler,
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
  NavButton,
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

// Tracking state for onboarding telemetry
type TrackingState = {
  startTime: number;
  slideTimes: Record<number, number>;
  previousIndex: number;
};

// Track step completion for telemetry
function trackStepIfChanged(
  index: number,
  tracking: TrackingState,
  now: number
): void {
  const prev = tracking.previousIndex;
  if (prev !== index && tracking.slideTimes[prev] !== undefined) {
    const duration = now - tracking.slideTimes[prev];
    trackOnboardingStepComplete(`slide_${prev}`, duration);
  }
  tracking.slideTimes[index] = now;
  tracking.previousIndex = index;
}

export function OnboardingPager({
  slides,
  onComplete,
  showSkip = true,
  testID = 'onboarding-pager',
}: OnboardingPagerProps): React.ReactElement {
  const { width } = useWindowDimensions();
  const scrollRef = React.useRef<ScrollView | null>(null);
  const activeIndex = useSharedValue(0);
  const lastIndex = Math.max(slides.length - 1, 0);
  const trackingRef = React.useRef<TrackingState>({
    startTime: Date.now(),
    slideTimes: { 0: Date.now() },
    previousIndex: 0,
  });
  const [currentIndex, setCurrentIndex] = React.useState(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      'worklet';
      const layoutWidth = event?.nativeEvent?.layoutMeasurement?.width ?? NaN;
      const offsetX = event?.nativeEvent?.contentOffset?.x ?? 0;
      if (!isFinite(layoutWidth) || isNaN(layoutWidth) || layoutWidth <= 0)
        return;
      activeIndex.value = offsetX / layoutWidth;
    },
  });

  const handleScrollEnd = React.useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const layoutWidth = event?.nativeEvent?.layoutMeasurement?.width ?? NaN;
      if (!isFinite(layoutWidth) || isNaN(layoutWidth) || layoutWidth <= 0)
        return;
      const index = Math.round(
        (event?.nativeEvent?.contentOffset?.x ?? 0) / layoutWidth
      );
      setCurrentIndex(index);
      trackStepIfChanged(index, trackingRef.current, Date.now());
    },
    []
  );

  const handleDone = React.useCallback(() => {
    const now = Date.now();
    const tracking = trackingRef.current;
    // Track completion of the current/final slide before marking onboarding complete
    trackStepIfChanged(tracking.previousIndex, tracking, now);
    trackOnboardingComplete(now - tracking.startTime, slides.length);
    onComplete();
  }, [onComplete, slides.length]);

  const handleNext = React.useCallback(() => {
    const nextIndex = Math.min(currentIndex + 1, lastIndex);
    scrollRef.current?.scrollTo({ x: nextIndex * width, animated: true });
  }, [currentIndex, lastIndex, width]);

  const handleSkip = React.useCallback(() => {
    const now = Date.now();
    const tracking = trackingRef.current;
    // Track completion of the current slide before marking as skipped
    trackStepIfChanged(tracking.previousIndex, tracking, now);
    trackOnboardingSkipped(
      `slide_${Math.round(activeIndex.value)}`,
      'user_skip'
    );
    onComplete();
  }, [onComplete, activeIndex]);

  const isLastSlide = currentIndex >= lastIndex;

  return (
    <AnimatedIndexProvider activeIndex={activeIndex}>
      <View
        className="flex-1 bg-primary-50 dark:bg-charcoal-950"
        testID={testID}
      >
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
        <NavButton
          isLastSlide={isLastSlide}
          onDone={handleDone}
          onNext={handleNext}
        />
      </View>
    </AnimatedIndexProvider>
  );
}
