/**
 * Onboarding Screen
 *
 * Main entry point for first-run onboarding experience
 * Features:
 * - Custom pager with horizontal scrolling
 * - Animated slide transitions with Reanimated
 * - Pagination dots
 * - Skip/Done buttons
 * - Integration with onboarding-state for completion tracking
 * - Reduced Motion support
 * - Full a11y support
 */

import { useRouter } from 'expo-router';
import React from 'react';

import {
  CommunitySlide,
  GuidanceSlide,
  OnboardingPager,
  WelcomeSlide,
} from '@/components/onboarding';
import { IntroSlide } from '@/components/onboarding/slides/intro-slide';
import { useIsFirstTime } from '@/lib/hooks';

export default function Onboarding() {
  const [, setIsFirstTime] = useIsFirstTime();
  const router = useRouter();

  const handleComplete = React.useCallback(() => {
    setIsFirstTime(false);
    // Navigate to notification primer after onboarding slides
    router.replace('/notification-primer');
  }, [setIsFirstTime, router]);

  const slides = [IntroSlide, WelcomeSlide, CommunitySlide, GuidanceSlide];

  return (
    <OnboardingPager
      slides={slides}
      onComplete={handleComplete}
      showSkip
      testID="main-onboarding"
    />
  );
}
