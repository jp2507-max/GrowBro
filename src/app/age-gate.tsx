import { useRouter } from 'expo-router';
import * as React from 'react';

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
import { translate } from '@/lib/i18n';

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
  const [birthDay, setBirthDay] = React.useState('');
  const [birthMonth, setBirthMonth] = React.useState('');
  const [birthYear, setBirthYear] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (status === 'verified') router.replace('/(app)');
  }, [router, status]);

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
      router.replace('/(app)');
    } finally {
      setSubmitting(false);
    }
  }, [birthDay, birthMonth, birthYear, router, submitting]);

  return {
    birthDay,
    birthMonth,
    birthYear,
    error,
    submitting,
    setBirthDay,
    setBirthMonth,
    setBirthYear,
    handleSubmit,
  };
}

export default function AgeGateScreen(): React.ReactElement {
  const {
    birthDay,
    birthMonth,
    birthYear,
    error,
    submitting,
    setBirthDay,
    setBirthMonth,
    setBirthYear,
    handleSubmit,
  } = useAgeGateForm();

  return (
    <SafeAreaView className="flex-1 bg-white dark:bg-neutral-900">
      <FocusAwareStatusBar />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View className="flex-1 px-6 py-10">
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
        </View>
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
    </View>
  );
}

function parseNumberValue(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isFinite(parsed)) return parsed;
  return Number.NaN;
}
