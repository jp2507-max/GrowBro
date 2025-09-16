import React, { useMemo, useState } from 'react';
import { Switch } from 'react-native';

import { Button, Text, View } from '@/components/ui';
import { translate } from '@/lib';
import type { TxKeyPath } from '@/lib/i18n/utils';

type ConsentDecisions = {
  telemetry: boolean;
  experiments: boolean;
  aiTraining: boolean;
  crashDiagnostics: boolean;
  acceptedAt: Date;
};

type Props = {
  isVisible: boolean;
  onComplete: (consents: ConsentDecisions) => void;
  mode: 'first-run' | 'settings-update';
  locale?: 'en' | 'de';
};

type ToggleRowProps = {
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (value: boolean) => void;
  testID: string;
};

function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
  testID,
}: ToggleRowProps) {
  return (
    <View
      className="flex-row items-center justify-between py-2"
      testID={testID}
    >
      <View className="flex-1 pr-4">
        <Text className="text-base font-medium text-gray-900 dark:text-gray-100">
          {title}
        </Text>
        <Text className="text-sm text-gray-600 dark:text-gray-400">
          {subtitle}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        testID={`${testID}-switch`}
      />
    </View>
  );
}

function useConsentState() {
  const [telemetry, setTelemetry] = useState(false);
  const [experiments, setExperiments] = useState(false);
  const [aiTraining, setAiTraining] = useState(false);
  const [crashDiagnostics, setCrashDiagnostics] = useState(false);
  return {
    telemetry,
    setTelemetry,
    experiments,
    setExperiments,
    aiTraining,
    setAiTraining,
    crashDiagnostics,
    setCrashDiagnostics,
  } as const;
}

function Actions({
  onAcceptAll,
  onRejectAll,
  onSave,
}: {
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onSave: () => void;
}): React.ReactElement {
  return (
    <>
      <View className="mt-6 flex-row gap-3">
        <View className="flex-1">
          <Button
            label={translate('consent.reject_all')}
            onPress={onRejectAll}
            testID="reject-all-btn"
          />
        </View>
        <View className="flex-1">
          <Button
            label={translate('consent.accept_all')}
            onPress={onAcceptAll}
            testID="accept-all-btn"
          />
        </View>
      </View>
      <View className="mt-2">
        <Button
          label={translate('consent.save')}
          onPress={onSave}
          testID="save-btn"
        />
      </View>
    </>
  );
}

export function ConsentModal({ isVisible, onComplete, mode }: Props) {
  const {
    telemetry,
    setTelemetry,
    experiments,
    setExperiments,
    aiTraining,
    setAiTraining,
    crashDiagnostics,
    setCrashDiagnostics,
  } = useConsentState();

  const titleKey = useMemo<TxKeyPath>(
    () =>
      (mode === 'first-run'
        ? 'consent.first_run_title'
        : 'consent.title') as TxKeyPath,
    [mode]
  );

  if (!isVisible) return null;

  const acceptAll = () => {
    setTelemetry(true);
    setExperiments(true);
    setAiTraining(true);
    setCrashDiagnostics(true);
  };

  const rejectAll = () => {
    setTelemetry(false);
    setExperiments(false);
    setAiTraining(false);
    setCrashDiagnostics(false);
  };

  const complete = () => {
    onComplete({
      telemetry,
      experiments,
      aiTraining,
      crashDiagnostics,
      acceptedAt: new Date(),
    });
  };

  return (
    <View className="p-4" testID="consent-modal">
      <ConsentHeader titleKey={titleKey} />
      <ConsentSections
        telemetry={telemetry}
        setTelemetry={setTelemetry}
        experiments={experiments}
        setExperiments={setExperiments}
        aiTraining={aiTraining}
        setAiTraining={setAiTraining}
        crashDiagnostics={crashDiagnostics}
        setCrashDiagnostics={setCrashDiagnostics}
      />
      <Actions
        onAcceptAll={acceptAll}
        onRejectAll={rejectAll}
        onSave={complete}
      />
    </View>
  );
}

function ConsentHeader({
  titleKey,
}: {
  titleKey: TxKeyPath;
}): React.ReactElement {
  return (
    <Text className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
      {translate(titleKey)}
    </Text>
  );
}

function ConsentSections(props: {
  telemetry: boolean;
  setTelemetry: (v: boolean) => void;
  experiments: boolean;
  setExperiments: (v: boolean) => void;
  aiTraining: boolean;
  setAiTraining: (v: boolean) => void;
  crashDiagnostics: boolean;
  setCrashDiagnostics: (v: boolean) => void;
}): React.ReactElement {
  const {
    telemetry,
    setTelemetry,
    experiments,
    setExperiments,
    aiTraining,
    setAiTraining,
    crashDiagnostics,
    setCrashDiagnostics,
  } = props;
  return (
    <View className="space-y-4">
      <ToggleRow
        title={translate('consent.telemetry.title')}
        subtitle={translate('consent.telemetry.subtitle')}
        value={telemetry}
        onChange={setTelemetry}
        testID="toggle-telemetry"
      />
      <Text className="text-xs text-gray-600 dark:text-gray-400">
        {translate('consent.telemetry.impact')}
      </Text>
      <ToggleRow
        title={translate('consent.experiments.title')}
        subtitle={translate('consent.experiments.subtitle')}
        value={experiments}
        onChange={setExperiments}
        testID="toggle-experiments"
      />
      <Text className="text-xs text-gray-600 dark:text-gray-400">
        {translate('consent.experiments.impact')}
      </Text>
      <ToggleRow
        title={translate('consent.aiTraining.title')}
        subtitle={translate('consent.aiTraining.subtitle')}
        value={aiTraining}
        onChange={setAiTraining}
        testID="toggle-aiTraining"
      />
      <Text className="text-xs text-gray-600 dark:text-gray-400">
        {translate('consent.aiTraining.impact')}
      </Text>
      <ToggleRow
        title={translate('consent.crashDiagnostics.title')}
        subtitle={translate('consent.crashDiagnostics.subtitle')}
        value={crashDiagnostics}
        onChange={setCrashDiagnostics}
        testID="toggle-crashDiagnostics"
      />
      <Text className="text-xs text-gray-600 dark:text-gray-400">
        {translate('consent.crashDiagnostics.impact')}
      </Text>
    </View>
  );
}

export default ConsentModal;
