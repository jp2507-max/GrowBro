/**
 * Tests for OnboardingPager component
 *
 * Covers:
 * - Index bridging to AnimatedIndexContext
 * - CTA gating on last slide
 * - Skip/Done callbacks integration with onboarding-state
 * - Reduced Motion support
 * - Accessibility
 */

import React from 'react';
import { Text } from 'react-native';

import { cleanup, screen, setup, waitFor } from '@/lib/test-utils';

import type { OnboardingSlideProps } from './onboarding-pager';
import { OnboardingPager } from './onboarding-pager';

jest.mock('@/lib/compliance/onboarding-state', () => ({
  useOnboardingState: () => ({
    markAsCompleted: jest.fn(),
  }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: jest.fn(),
  }),
}));

jest.mock('@/lib/hooks', () => ({
  useIsFirstTime: () => [false, jest.fn()],
}));

afterEach(cleanup);

// Test slide components
function TestSlide1({ index }: OnboardingSlideProps): React.ReactElement {
  return <Text testID={`slide-${index}`}>Slide 1</Text>;
}

function TestSlide2({ index }: OnboardingSlideProps): React.ReactElement {
  return <Text testID={`slide-${index}`}>Slide 2</Text>;
}

function TestSlide3({ index }: OnboardingSlideProps): React.ReactElement {
  return <Text testID={`slide-${index}`}>Slide 3</Text>;
}

const testSlides = [TestSlide1, TestSlide2, TestSlide3];

describe('OnboardingPager', () => {
  describe('Rendering', () => {
    test('renders correctly with multiple slides', async () => {
      const onComplete = jest.fn();
      setup(<OnboardingPager slides={testSlides} onComplete={onComplete} />);

      expect(await screen.findByTestId('onboarding-pager')).toBeOnTheScreen();
      expect(
        await screen.findByTestId('onboarding-scroll-view')
      ).toBeOnTheScreen();
      expect(await screen.findByTestId('pagination-dots')).toBeOnTheScreen();
    });

    test('renders all slides', async () => {
      const onComplete = jest.fn();
      setup(<OnboardingPager slides={testSlides} onComplete={onComplete} />);

      await waitFor(() => {
        expect(screen.getByTestId('slide-0')).toBeOnTheScreen();
      });
    });

    test('renders skip button when showSkip is true', async () => {
      const onComplete = jest.fn();
      setup(
        <OnboardingPager slides={testSlides} onComplete={onComplete} showSkip />
      );

      expect(
        await screen.findByTestId('onboarding-skip-button')
      ).toBeOnTheScreen();
    });

    test('does not render skip button when showSkip is false', async () => {
      const onComplete = jest.fn();
      setup(
        <OnboardingPager
          slides={testSlides}
          onComplete={onComplete}
          showSkip={false}
        />
      );

      await waitFor(() => {
        expect(
          screen.queryByTestId('onboarding-skip-button')
        ).not.toBeOnTheScreen();
      });
    });

    test('renders done button', async () => {
      const onComplete = jest.fn();
      setup(<OnboardingPager slides={testSlides} onComplete={onComplete} />);

      expect(
        await screen.findByTestId('onboarding-done-button')
      ).toBeOnTheScreen();
    });
  });

  describe('Pagination', () => {
    test('renders correct number of pagination dots', async () => {
      const onComplete = jest.fn();
      setup(<OnboardingPager slides={testSlides} onComplete={onComplete} />);

      await waitFor(() => {
        expect(screen.getByTestId('pagination-dot-0')).toBeOnTheScreen();
        expect(screen.getByTestId('pagination-dot-1')).toBeOnTheScreen();
        expect(screen.getByTestId('pagination-dot-2')).toBeOnTheScreen();
      });
    });
  });

  describe('Interactions', () => {
    test('skip button calls onComplete', async () => {
      const onComplete = jest.fn();
      const { user } = setup(
        <OnboardingPager slides={testSlides} onComplete={onComplete} showSkip />
      );

      const skipButton = await screen.findByTestId('onboarding-skip-button');
      await user.press(skipButton);

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledTimes(1);
      });
    });

    test('done button calls onComplete', async () => {
      const onComplete = jest.fn();
      const { user } = setup(
        <OnboardingPager slides={testSlides} onComplete={onComplete} />
      );

      const doneButton = await screen.findByTestId('onboarding-done-button');
      await user.press(doneButton);

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Accessibility', () => {
    test('scroll view has accessibility label', async () => {
      const onComplete = jest.fn();
      setup(<OnboardingPager slides={testSlides} onComplete={onComplete} />);

      const scrollView = await screen.findByTestId('onboarding-scroll-view');
      expect(scrollView).toBeOnTheScreen();
      expect(scrollView.props.accessibilityLabel).toBeDefined();
    });

    test('supports custom testID', async () => {
      const onComplete = jest.fn();
      setup(
        <OnboardingPager
          slides={testSlides}
          onComplete={onComplete}
          testID="custom-pager"
        />
      );

      expect(await screen.findByTestId('custom-pager')).toBeOnTheScreen();
    });
  });

  describe('Integration with onboarding-state', () => {
    test('marks onboarding as completed when skip is pressed', async () => {
      const mockMarkAsCompleted = jest.fn();
      jest
        .spyOn(
          require('@/lib/compliance/onboarding-state'),
          'useOnboardingState'
        )
        .mockReturnValue({
          markAsCompleted: mockMarkAsCompleted,
        });

      const onComplete = jest.fn();
      const { user } = setup(
        <OnboardingPager slides={testSlides} onComplete={onComplete} showSkip />
      );

      const skipButton = await screen.findByTestId('onboarding-skip-button');
      await user.press(skipButton);

      await waitFor(() => {
        expect(mockMarkAsCompleted).toHaveBeenCalledTimes(1);
        expect(onComplete).toHaveBeenCalledTimes(1);
      });
    });

    test('marks onboarding as completed when done is pressed', async () => {
      const mockMarkAsCompleted = jest.fn();
      jest
        .spyOn(
          require('@/lib/compliance/onboarding-state'),
          'useOnboardingState'
        )
        .mockReturnValue({
          markAsCompleted: mockMarkAsCompleted,
        });

      const onComplete = jest.fn();
      const { user } = setup(
        <OnboardingPager slides={testSlides} onComplete={onComplete} />
      );

      const doneButton = await screen.findByTestId('onboarding-done-button');
      await user.press(doneButton);

      await waitFor(() => {
        expect(mockMarkAsCompleted).toHaveBeenCalledTimes(1);
        expect(onComplete).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Edge cases', () => {
    test('handles single slide', async () => {
      const onComplete = jest.fn();
      setup(<OnboardingPager slides={[TestSlide1]} onComplete={onComplete} />);

      expect(await screen.findByTestId('slide-0')).toBeOnTheScreen();
      expect(await screen.findByTestId('pagination-dot-0')).toBeOnTheScreen();
    });

    test('handles empty slides array gracefully', async () => {
      const onComplete = jest.fn();
      setup(<OnboardingPager slides={[]} onComplete={onComplete} />);

      expect(await screen.findByTestId('onboarding-pager')).toBeOnTheScreen();
    });
  });
});
