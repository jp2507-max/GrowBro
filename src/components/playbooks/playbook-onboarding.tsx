/**
 * Playbook Onboarding Component
 *
 * First-time user experience for the playbooks feature
 */

import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Button, Text, View } from '@/components/ui';
import { storage } from '@/lib/storage';
import { useAnalytics } from '@/lib/use-analytics';

const ONBOARDING_KEY = 'playbooks_onboarding_completed';

type OnboardingStep = {
  title: string;
  description: string;
  icon: string;
};

export function usePlaybookOnboarding() {
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
}: {
  steps: OnboardingStep[];
  currentStep: number;
}) {
  return (
    <View className="mb-6 flex-row gap-2">
      {steps.map((_, index) => (
        <View
          key={index}
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

function StepContent({ step }: { step: OnboardingStep }) {
  return (
    <Animated.View entering={FadeIn.duration(400)} className="items-center">
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
}) {
  const { t } = useTranslation();
  return (
    <View className="border-t border-neutral-200 bg-white p-4 dark:border-charcoal-800 dark:bg-charcoal-900">
      <Button
        testID="onboarding-next-button"
        label={
          currentStep === totalSteps - 1
            ? t('playbooks.onboarding.getStarted')
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

export function PlaybookOnboarding({
  onComplete,
  onSkip,
}: PlaybookOnboardingProps) {
  const { t } = useTranslation();
  const { track } = useAnalytics();
  const [currentStep, setCurrentStep] = React.useState(0);

  const steps: OnboardingStep[] = React.useMemo(
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

  React.useEffect(() => {
    track('playbook_onboarding_viewed', { step: currentStep });
  }, [currentStep, track]);

  const handleNext = React.useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      track('playbook_onboarding_completed', { totalSteps: steps.length });
      onComplete();
    }
  }, [currentStep, steps.length, onComplete, track]);

  const handleSkip = React.useCallback(() => {
    track('playbook_onboarding_skipped', { step: currentStep });
    onSkip();
  }, [currentStep, onSkip, track]);

  return (
    <View className="flex-1 bg-neutral-50 dark:bg-charcoal-950">
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
