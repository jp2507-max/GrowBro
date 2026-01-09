/**
 * Playbook Onboarding Component
 *
 * First-time user experience for the playbooks feature
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { Button, Text, View } from '@/components/ui';
import { storage } from '@/lib/storage';
import { useAnalytics } from '@/lib/use-analytics';

const ONBOARDING_KEY = 'playbooks_onboarding_completed';

type OnboardingStep = {
  title: string;
  description: string;
  icon: string;
};

export function usePlaybookOnboarding(): {
  showOnboarding: boolean;
  loading: boolean;
  completeOnboarding: () => void;
} {
  const [showOnboarding, setShowOnboarding] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const completed = storage.getBoolean(ONBOARDING_KEY);
        setShowOnboarding(!completed);
      } catch (error) {
        console.error('Failed to check onboarding status:', error);
        setShowOnboarding(false);
      } finally {
        setLoading(false);
      }
    };

    checkOnboarding();
  }, []);

  const completeOnboarding = React.useCallback(() => {
    storage.set(ONBOARDING_KEY, true);
    setShowOnboarding(false);
  }, []);

  return { showOnboarding, loading, completeOnboarding };
}

type PlaybookOnboardingProps = {
  onComplete: () => void;
  onSkip: () => void;
};

function StepIndicator({
  steps,
  currentStep,
  testID = 'step-indicator',
}: {
  steps: OnboardingStep[];
  currentStep: number;
  testID?: string;
}): React.ReactElement {
  return (
    <View testID={testID} className="mb-6 flex-row gap-2">
      {steps.map((_, index) => (
        <View
          key={index}
          testID={`${testID}-dot-${index}`}
          className={`h-2 w-8 rounded-full ${
            index === currentStep
              ? 'bg-primary-600'
              : 'bg-neutral-300 dark:bg-charcoal-700'
          }`}
        />
      ))}
    </View>
  );
}

function StepContent({
  step,
  testID,
}: {
  step: OnboardingStep;
  testID?: string;
}): React.ReactElement {
  return (
    <Animated.View
      testID={testID}
      entering={FadeIn.duration(400).reduceMotion(ReduceMotion.System)}
      className="items-center"
    >
      <Text className="mb-6 text-6xl">{step.icon}</Text>
      <Text className="mb-4 text-center text-3xl font-bold text-neutral-900 dark:text-neutral-100">
        {step.title}
      </Text>
      <Text className="mb-8 text-center text-lg text-neutral-600 dark:text-neutral-400">
        {step.description}
      </Text>
    </Animated.View>
  );
}

function NavigationButtons({
  currentStep,
  totalSteps,
  onNext,
  onSkip,
}: {
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onSkip: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View className="border-t border-neutral-200 bg-white p-4 dark:border-charcoal-800 dark:bg-charcoal-900">
      <Button
        testID="onboarding-next-button"
        label={
          currentStep === totalSteps - 1
            ? t('playbooks.onboarding.get_started')
            : t('playbooks.onboarding.next')
        }
        onPress={onNext}
        className="mb-3 w-full"
      />
      <Button
        testID="onboarding-skip-button"
        label={t('playbooks.onboarding.skip')}
        onPress={onSkip}
        variant="ghost"
        className="w-full"
      />
    </View>
  );
}

function useOnboardingSteps(
  t: ReturnType<typeof useTranslation>['t']
): OnboardingStep[] {
  return React.useMemo(
    () => [
      {
        title: t('playbooks.onboarding.step1.title'),
        description: t('playbooks.onboarding.step1.description'),
        icon: '📅',
      },
      {
        title: t('playbooks.onboarding.step2.title'),
        description: t('playbooks.onboarding.step2.description'),
        icon: '🔔',
      },
      {
        title: t('playbooks.onboarding.step3.title'),
        description: t('playbooks.onboarding.step3.description'),
        icon: '✏️',
      },
      {
        title: t('playbooks.onboarding.step4.title'),
        description: t('playbooks.onboarding.step4.description'),
        icon: '🌱',
      },
    ],
    [t]
  );
}

type OnboardingNavigation = {
  currentStep: number;
  handleNext: () => void;
  handleSkip: () => void;
};

function useOnboardingNavigation(
  steps: OnboardingStep[],
  callbacks: {
    onComplete: () => void;
    onSkip: () => void;
  },
  track: ReturnType<typeof useAnalytics>['track']
): OnboardingNavigation {
  const [currentStep, setCurrentStep] = React.useState(0);

  React.useEffect(() => {
    track('playbook_onboarding_viewed', { step: currentStep });
  }, [currentStep, track]);

  const handleNext = React.useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      track('playbook_onboarding_completed', { totalSteps: steps.length });
      callbacks.onComplete();
    }
  }, [currentStep, steps.length, callbacks, track]);

  const handleSkip = React.useCallback(() => {
    track('playbook_onboarding_skipped', { step: currentStep });
    callbacks.onSkip();
  }, [currentStep, callbacks, track]);

  return { currentStep, handleNext, handleSkip };
}

export function PlaybookOnboarding({
  onComplete,
  onSkip,
}: PlaybookOnboardingProps): React.ReactElement {
  const { t } = useTranslation();
  const { track } = useAnalytics();
  const steps = useOnboardingSteps(t);
  const callbacks = React.useMemo(
    () => ({ onComplete, onSkip }),
    [onComplete, onSkip]
  );
  const { currentStep, handleNext, handleSkip } = useOnboardingNavigation(
    steps,
    callbacks,
    track
  );

  return (
    <View
      testID="playbook-onboarding"
      className="flex-1 bg-neutral-50 dark:bg-charcoal-950"
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-1 justify-center px-6"
      >
        <StepContent step={steps[currentStep]} />
        <StepIndicator steps={steps} currentStep={currentStep} />
      </ScrollView>
      <NavigationButtons
        currentStep={currentStep}
        totalSteps={steps.length}
        onNext={handleNext}
        onSkip={handleSkip}
      />
    </View>
  );
}
