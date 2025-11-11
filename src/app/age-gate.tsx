import { useRouter } from 'expo-router';
import * as React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { LegalConfirmationModal } from '@/components/legal-confirmation-modal';
import {
  Button,
  FocusAwareStatusBar,
  Input,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import {
  startAgeGateSession,
  useAgeGate,
  verifyAgeGate,
} from '@/lib/compliance/age-gate';
import {
  completeOnboardingStep,
  useOnboardingState,
} from '@/lib/compliance/onboarding-state';
import { translate } from '@/lib/i18n';
import type { LegalAcceptances } from '@/types/settings';

const CURRENT_YEAR = new Date().getFullYear();

type BirthDateInputsProps = {
  day: string;
  month: string;
  year: string;
  onDayChange: (value: string) => void;
  onMonthChange: (value: string) => void;
  onYearChange: (value: string) => void;
};

function useAgeGateForm() {
  const router = useRouter();
  const status = useAgeGate.status();
  const currentStep = useOnboardingState.currentStep();
  const [birthDay, setBirthDay] = React.useState('');
  const [birthMonth, setBirthMonth] = React.useState('');
  const [birthYear, setBirthYear] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [showLegalModal, setShowLegalModal] = React.useState(false);

  React.useEffect(() => {
    // If age is verified and legal confirmation is completed, navigate to app
    if (status === 'verified' && currentStep === 'consent-modal') {
      router.replace('/(app)');
    }
  }, [router, status, currentStep]);

  const handleSubmit = React.useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const result = verifyAgeGate({
        birthYear: parseNumberValue(birthYear),
        birthMonth: parseNumberValue(birthMonth),
        birthDay: parseNumberValue(birthDay),
      });
      if (!result.ok) {
        const messageKey =
          result.reason === 'underage'
            ? 'cannabis.age_gate_error_underage'
            : 'cannabis.age_gate_error_invalid';
        setError(translate(messageKey));
        return;
      }
      setError(null);
      startAgeGateSession();
      completeOnboardingStep('age-gate');
      // Show legal confirmation modal instead of navigating directly
      setShowLegalModal(true);
    } finally {
      setSubmitting(false);
    }
  }, [birthDay, birthMonth, birthYear, submitting]);

  const handleLegalAccept = React.useCallback(
    (_acceptances: LegalAcceptances) => {
      completeOnboardingStep('legal-confirmation');
      setShowLegalModal(false);
      // User will see consent modal next or app if consent already given
      router.replace('/(app)');
    },
    [router]
  );

  const handleLegalDecline = React.useCallback(() => {
    // Reset age gate and close legal modal
    setShowLegalModal(false);
    setError(translate('cannabis.legal_confirmation_all_required'));
  }, []);

  return {
    birthDay,
    birthMonth,
    birthYear,
    error,
    submitting,
    showLegalModal,
    setBirthDay,
    setBirthMonth,
    setBirthYear,
    handleSubmit,
    handleLegalAccept,
    handleLegalDecline,
  };
}

export default function AgeGateScreen(): React.ReactElement {
  const {
    birthDay,
    birthMonth,
    birthYear,
    error,
    submitting,
    showLegalModal,
    setBirthDay,
    setBirthMonth,
    setBirthYear,
    handleSubmit,
    handleLegalAccept,
    handleLegalDecline,
  } = useAgeGateForm();

  // Show legal confirmation modal if age verification passed
  if (showLegalModal) {
    return (
      <LegalConfirmationModal
        isVisible={showLegalModal}
        onAccept={handleLegalAccept}
        onDecline={handleLegalDecline}
      />
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900">
      <FocusAwareStatusBar />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        className="flex-1"
        contentContainerStyle={styles.scrollContent}
      >
        <Animated.View
          entering={FadeIn.duration(220).reduceMotion(ReduceMotion.System)}
          className="flex-1 px-6 py-10"
        >
          <AgeGateCopy />
          <BirthDateInputs
            day={birthDay}
            month={birthMonth}
            year={birthYear}
            onDayChange={setBirthDay}
            onMonthChange={setBirthMonth}
            onYearChange={setBirthYear}
          />
          {error && (
            <Text
              className="mt-2 text-sm text-danger-500"
              testID="age-gate-error"
            >
              {error}
            </Text>
          )}
          <Button
            className="mt-8"
            label={translate('cannabis.age_gate_submit')}
            onPress={handleSubmit}
            loading={submitting}
            testID="age-gate-submit"
          />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

function BirthDateInputs({
  day,
  month,
  year,
  onDayChange,
  onMonthChange,
  onYearChange,
}: BirthDateInputsProps): React.ReactElement {
  return (
    <View className="mt-8 flex-row gap-3">
      <View className="flex-1">
        <Input
          label={translate('cannabis.age_gate_day')}
          value={day}
          onChangeText={onDayChange}
          keyboardType="number-pad"
          placeholder="01"
          maxLength={2}
          testID="age-gate-day"
        />
      </View>
      <View className="flex-1">
        <Input
          label={translate('cannabis.age_gate_month')}
          value={month}
          onChangeText={onMonthChange}
          keyboardType="number-pad"
          placeholder="01"
          maxLength={2}
          testID="age-gate-month"
        />
      </View>
      <View className="flex-1">
        <Input
          label={translate('cannabis.age_gate_year')}
          value={year}
          onChangeText={onYearChange}
          keyboardType="number-pad"
          placeholder={String(CURRENT_YEAR - 18)}
          maxLength={4}
          testID="age-gate-year"
        />
      </View>
    </View>
  );
}

function AgeGateCopy(): React.ReactElement {
  return (
    <View>
      <Text className="text-3xl font-semibold text-neutral-900 dark:text-neutral-50">
        {translate('cannabis.age_gate_title')}
      </Text>
      <Text className="mt-3 text-base text-neutral-700 dark:text-neutral-200">
        {translate('cannabis.age_gate_body')}
      </Text>
      <Text className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
        {translate('cannabis.age_gate_disclaimer')}
      </Text>
      <Text className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
        {translate('cannabis.age_gate_secondary_disclaimer')}
      </Text>
      <Text className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
        {translate('cannabis.age_gate_re_verification')}
      </Text>
    </View>
  );
}

function parseNumberValue(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isFinite(parsed)) return parsed;
  return Number.NaN;
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
});
