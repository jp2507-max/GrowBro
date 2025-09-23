import React, { useState } from 'react';
import { View } from 'react-native';

import { Button, Switch, Text } from '@/components/ui';
import type { TxKeyPath } from '@/lib/i18n/utils';
import { translate } from '@/lib/i18n/utils';
import { ConsentService } from '@/lib/privacy/consent-service';

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
  checked: boolean;
  onChange: (value: boolean) => void;
  testID: string;
};

function ToggleRow({
  title,
  subtitle,
  checked,
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
        checked={checked}
        onChange={onChange}
        // Support tests that dispatch `valueChange` on Switch
        onValueChange={onChange}
        testID={`${testID}-switch`}
        accessibilityLabel={title}
      />
    </View>
  );
}

function useConsentState() {
  /*
   NOTE: Bug & recommended fix
   ----------------------------
   Problem observed (P1): when the consent modal is shown for existing users
   (for example because ConsentService.isConsentRequired() detects a version
   change), every toggle is currently initialised to `false` and no stored
   consent state is loaded before rendering. That means a previously consenting
   user who opens the modal and taps "Save" without changing anything will
   have their stored consents overwritten with all `false` values, effectively
   withdrawing telemetry/crash diagnostics unintentionally.

   Recommendation:
   - Seed the toggle state from the stored consent when the modal becomes
     visible (e.g. call `ConsentService.getPrivacyConsent()` from the parent
     or in an effect when `isVisible` flips true) so the UI reflects prior
     choices instead of forcing an implicit opt-out.
   - Two safe implementation approaches:
     1) Move the data-loading responsibility to the parent `ConsentModal` and
        pass initial values into `useConsentState` (preferred: single source
        of truth, easier to test). For example: `useConsentState(initialConsents)`.
     2) Give `useConsentState` an initializer that accepts a function which
        lazily reads stored consents (so it won't run on every render). If
        using this approach, ensure the hook can be re-seeded when
        `isVisible` changes or when a refresh is required.

   Edge cases to watch:
   - Loading state: render a skeleton or keep modal hidden until stored
     consents are loaded to avoid flashing default values.
   - Race conditions: ensure writes (persistConsents) do not run before the
     stored values are loaded/merged.
   - Backwards compatibility: if stored data schema changes, provide safe
     defaults and migration logic in ConsentService.
  */

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

// Helper hook: loads stored consents when `isVisible` becomes true and uses
// the provided setters to seed local state. Returns `true` when loaded.
function useLoadConsents(
  isVisible: boolean,
  setters: {
    setTelemetry: (v: boolean) => void;
    setExperiments: (v: boolean) => void;
    setAiTraining: (v: boolean) => void;
    setCrashDiagnostics: (v: boolean) => void;
  }
): boolean {
  const [loaded, setLoaded] = useState(false);

  React.useEffect(() => {
    let mounted = true;
    if (!isVisible) return undefined;
    setLoaded(false);
    ConsentService.getConsents()
      .then((c) => {
        if (!mounted) return;
        // null-safe accessor: treat `c` as possibly undefined/null and
        // coerce each key to a boolean.
        const has = (k: string) => !!(c as any)?.[k];
        setters.setTelemetry(has('telemetry'));
        setters.setExperiments(has('experiments'));
        setters.setAiTraining(has('aiTraining'));
        setters.setCrashDiagnostics(has('crashDiagnostics'));
      })
      .catch((error) => {
        // Follow project logging conventions: include context and the error
        console.error('Failed to load consents:', error);
      })
      .finally(() => {
        if (mounted) setLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, [
    isVisible,
    setters,
    setters.setTelemetry,
    setters.setExperiments,
    setters.setAiTraining,
    setters.setCrashDiagnostics,
  ]);

  return loaded;
}

function makeAcceptAll(setters: {
  setTelemetry: (v: boolean) => void;
  setExperiments: (v: boolean) => void;
  setAiTraining: (v: boolean) => void;
  setCrashDiagnostics: (v: boolean) => void;
}) {
  return () => {
    setters.setTelemetry(true);
    setters.setExperiments(true);
    setters.setAiTraining(true);
    setters.setCrashDiagnostics(true);
  };
}

function makeRejectAll(setters: {
  setTelemetry: (v: boolean) => void;
  setExperiments: (v: boolean) => void;
  setAiTraining: (v: boolean) => void;
  setCrashDiagnostics: (v: boolean) => void;
}) {
  return () => {
    setters.setTelemetry(false);
    setters.setExperiments(false);
    setters.setAiTraining(false);
    setters.setCrashDiagnostics(false);
  };
}

function makeComplete(
  onComplete: (consents: ConsentDecisions) => void,
  consents: Omit<ConsentDecisions, 'acceptedAt'>
) {
  return () => {
    onComplete({ ...consents, acceptedAt: new Date() });
  };
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
  const setters = React.useMemo(
    () => ({
      setTelemetry,
      setExperiments,
      setAiTraining,
      setCrashDiagnostics,
    }),
    [setTelemetry, setExperiments, setAiTraining, setCrashDiagnostics]
  );
  const loaded = useLoadConsents(isVisible, setters);

  const titleKey = (
    mode === 'first-run' ? 'consent.first_run_title' : 'consent.title'
  ) as TxKeyPath;

  if (!isVisible || !loaded) return null;

  const acceptAll = makeAcceptAll({
    setTelemetry,
    setExperiments,
    setAiTraining,
    setCrashDiagnostics,
  });

  const rejectAll = makeRejectAll({
    setTelemetry,
    setExperiments,
    setAiTraining,
    setCrashDiagnostics,
  });

  const complete = makeComplete(onComplete, {
    telemetry,
    experiments,
    aiTraining,
    crashDiagnostics,
  });

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
        checked={telemetry}
        onChange={setTelemetry}
        testID="toggle-telemetry"
      />
      <Text className="text-xs text-gray-600 dark:text-gray-400">
        {translate('consent.telemetry.impact')}
      </Text>
      <ToggleRow
        title={translate('consent.experiments.title')}
        subtitle={translate('consent.experiments.subtitle')}
        checked={experiments}
        onChange={setExperiments}
        testID="toggle-experiments"
      />
      <Text className="text-xs text-gray-600 dark:text-gray-400">
        {translate('consent.experiments.impact')}
      </Text>
      <ToggleRow
        title={translate('consent.aiTraining.title')}
        subtitle={translate('consent.aiTraining.subtitle')}
        checked={aiTraining}
        onChange={setAiTraining}
        testID="toggle-aiTraining"
      />
      <Text className="text-xs text-gray-600 dark:text-gray-400">
        {translate('consent.aiTraining.impact')}
      </Text>
      <ToggleRow
        title={translate('consent.crashDiagnostics.title')}
        subtitle={translate('consent.crashDiagnostics.subtitle')}
        checked={crashDiagnostics}
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
