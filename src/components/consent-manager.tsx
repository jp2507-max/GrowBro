import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Switch, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { translate } from '@/lib';
import type { TxKeyPath } from '@/lib/i18n/utils';
import { ConsentService } from '@/lib/privacy/consent-service';
import {
  type ConsentPurpose,
  type ConsentState,
  RUNTIME_CONSENT_KEYS,
} from '@/lib/privacy/consent-types';
import { telemetryClient } from '@/lib/privacy/telemetry-client';
import {
  getPrivacyConsent,
  type PrivacyConsent,
  setPrivacyConsent,
} from '@/lib/privacy-consent';

// Runtime consent purposes exclude privacy keys to prevent invalid configurations
type RuntimeConsentPurpose = Exclude<ConsentPurpose, keyof PrivacyConsent>;

type ConsentManagerMode = 'first-run' | 'settings' | 'opt-out';

type Props = {
  mode: ConsentManagerMode;
  isVisible: boolean;
  onComplete?: (consents: PrivacyConsent) => void;
  onDismiss?: () => void;
  testID?: string;
};

type ToggleConfig =
  | {
      key: keyof PrivacyConsent;
      isPrivacy: true;
      titleTx: TxKeyPath;
      subtitleTx: TxKeyPath;
      impactTx?: TxKeyPath;
      infoTitleTx?: TxKeyPath;
      infoBodyTx?: TxKeyPath;
      testID: string;
    }
  | {
      key: RuntimeConsentPurpose;
      isPrivacy: false;
      titleTx: TxKeyPath;
      subtitleTx: TxKeyPath;
      impactTx?: TxKeyPath;
      infoTitleTx?: TxKeyPath;
      infoBodyTx?: TxKeyPath;
      testID: string;
    };

// Static toggle configuration (kept outside render to avoid re-creation)
const CONSENT_TOGGLES: ToggleConfig[] = [
  {
    key: 'telemetry',
    isPrivacy: false,
    titleTx: 'consent.telemetry.title' as TxKeyPath,
    subtitleTx: 'consent.telemetry.subtitle' as TxKeyPath,
    impactTx: 'consent.telemetry.impact' as TxKeyPath,
    infoTitleTx: 'consent.telemetry.info_title' as TxKeyPath,
    infoBodyTx: 'consent.telemetry.info_body' as TxKeyPath,
    testID: 'consent-telemetry',
  },
  {
    key: 'experiments',
    isPrivacy: false,
    titleTx: 'consent.experiments.title' as TxKeyPath,
    subtitleTx: 'consent.experiments.subtitle' as TxKeyPath,
    impactTx: 'consent.experiments.impact' as TxKeyPath,
    testID: 'consent-experiments',
  },
  {
    key: 'aiTraining',
    isPrivacy: false,
    titleTx: 'consent.ai_training.title' as TxKeyPath,
    subtitleTx: 'consent.ai_training.subtitle' as TxKeyPath,
    impactTx: 'consent.ai_training.impact' as TxKeyPath,
    testID: 'consent-aiTraining',
  },
  {
    key: 'crashDiagnostics',
    isPrivacy: false,
    titleTx: 'consent.crash_diagnostics.title' as TxKeyPath,
    subtitleTx: 'consent.crash_diagnostics.subtitle' as TxKeyPath,
    impactTx: 'consent.crash_diagnostics.impact' as TxKeyPath,
    testID: 'consent-crashDiagnostics',
  },
  {
    key: 'analytics',
    isPrivacy: true,
    titleTx: 'consent.analytics.title' as TxKeyPath,
    subtitleTx: 'consent.analytics.subtitle' as TxKeyPath,
    impactTx: 'consent.analytics.impact' as TxKeyPath,
    infoTitleTx: 'consent.analytics.info_title' as TxKeyPath,
    infoBodyTx: 'consent.analytics.info_body' as TxKeyPath,
    testID: 'consent-analytics',
  },
  {
    key: 'crashReporting',
    isPrivacy: true,
    titleTx: 'consent.crash_reporting.title' as TxKeyPath,
    subtitleTx: 'consent.crash_reporting.subtitle' as TxKeyPath,
    impactTx: 'consent.crash_reporting.impact' as TxKeyPath,
    infoTitleTx: 'consent.crash_reporting.info_title' as TxKeyPath,
    infoBodyTx: 'consent.crash_reporting.info_body' as TxKeyPath,
    testID: 'consent-crashReporting',
  },
  {
    key: 'personalizedData',
    isPrivacy: true,
    titleTx: 'consent.personalized.title' as TxKeyPath,
    subtitleTx: 'consent.personalized.subtitle' as TxKeyPath,
    impactTx: 'consent.personalized.impact' as TxKeyPath,
    infoTitleTx: 'consent.personalized.info_title' as TxKeyPath,
    infoBodyTx: 'consent.personalized.info_body' as TxKeyPath,
    testID: 'consent-personalized',
  },
  {
    key: 'sessionReplay',
    isPrivacy: true,
    titleTx: 'consent.session_replay.title' as TxKeyPath,
    subtitleTx: 'consent.session_replay.subtitle' as TxKeyPath,
    impactTx: 'consent.session_replay.impact' as TxKeyPath,
    infoTitleTx: 'consent.session_replay.info_title' as TxKeyPath,
    infoBodyTx: 'consent.session_replay.info_body' as TxKeyPath,
    testID: 'consent-sessionReplay',
  },
];

function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
  onInfoPress,
  testID,
  impactText,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (v: boolean) => void;
  onInfoPress?: () => void;
  testID: string;
  impactText?: string;
}) {
  return (
    <View className="mb-4 rounded-lg border border-neutral-200 bg-white p-4 dark:border-charcoal-700 dark:bg-charcoal-900">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-4">
          <Text
            className="text-base font-medium text-charcoal-900 dark:text-neutral-100"
            onPress={onInfoPress}
            testID={`${testID}-title`}
          >
            {title}
          </Text>
          <Text className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {subtitle}
          </Text>
          {impactText && (
            <Text className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
              {impactText}
            </Text>
          )}
        </View>
        <Switch
          value={value}
          onValueChange={onChange}
          testID={`${testID}-switch`}
        />
      </View>
    </View>
  );
}

// Quick opt-out action component
function QuickOptOutActions({
  onOptOutAll,
  onDismiss,
}: {
  onOptOutAll: () => Promise<void> | void;
  onDismiss?: () => void;
}) {
  return (
    <View className="mb-6 rounded-lg border border-danger-200 bg-danger-50 p-4 dark:border-danger-800 dark:bg-danger-900/20">
      <Text className="mb-2 text-sm font-medium text-danger-800 dark:text-danger-200">
        {translate('consent.quick_opt_out.title')}
      </Text>
      <Text className="mb-3 text-xs text-danger-600 dark:text-danger-300">
        {translate('consent.quick_opt_out.description')}
      </Text>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button
            label={translate('consent.opt_out_all')}
            onPress={onOptOutAll}
            variant="destructive"
            testID="opt-out-all-btn"
          />
        </View>
        {onDismiss && (
          <View className="flex-1">
            <Button
              label={translate('common.cancel')}
              onPress={onDismiss}
              variant="outline"
              testID="cancel-opt-out-btn"
            />
          </View>
        )}
      </View>
    </View>
  );
}

function ConsentSections({
  privacyConsent,
  consentState,
  onPrivacyConsentChange,
  onConsentChange,
}: {
  privacyConsent: PrivacyConsent;
  consentState: ConsentState | null;
  onPrivacyConsentChange: (k: keyof PrivacyConsent, v: boolean) => void;
  onConsentChange: (purpose: RuntimeConsentPurpose, v: boolean) => void;
}) {
  const showInfo = useCallback((t?: TxKeyPath, b?: TxKeyPath) => {
    if (t && b)
      Alert.alert(translate(t), translate(b), [
        { text: translate('common.ok') },
      ]);
  }, []);

  return (
    <View className="space-y-2">
      {CONSENT_TOGGLES.map((cfg) => {
        const value = cfg.isPrivacy
          ? privacyConsent[cfg.key]
          : (consentState?.[cfg.key] ?? false);
        const onChange = (v: boolean) =>
          cfg.isPrivacy
            ? onPrivacyConsentChange(cfg.key, v)
            : onConsentChange(cfg.key, v);
        return (
          <ToggleRow
            key={cfg.key}
            title={translate(cfg.titleTx)}
            subtitle={translate(cfg.subtitleTx)}
            value={Boolean(value)}
            onChange={onChange}
            onInfoPress={() => showInfo(cfg.infoTitleTx, cfg.infoBodyTx)}
            impactText={cfg.impactTx ? translate(cfg.impactTx) : undefined}
            testID={cfg.testID}
          />
        );
      })}
    </View>
  );
}

// Action buttons component
function ConsentActions({
  mode,
  onAcceptAll,
  onRejectAll,
  onSave,
  onDismiss,
}: {
  mode: ConsentManagerMode;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  onSave: () => void;
  onDismiss?: () => void;
}) {
  const isFirstRun = mode === 'first-run';
  const isOptOut = mode === 'opt-out';

  return (
    <View className="mt-6 space-y-3">
      {!isOptOut && (
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Button
              label={translate('consent.reject_all')}
              onPress={onRejectAll}
              variant="outline"
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
      )}

      <Button
        label={
          isFirstRun
            ? translate('consent.get_started')
            : translate('consent.save')
        }
        onPress={onSave}
        testID="save-consent-btn"
      />

      {!isFirstRun && onDismiss && (
        <Button
          label={translate('common.cancel')}
          onPress={onDismiss}
          variant="ghost"
          testID="dismiss-consent-btn"
        />
      )}
    </View>
  );
}

// Main ConsentManager component
function usePrivacyConsentState(isVisible: boolean) {
  const [privacyConsent, setPrivacyConsentState] =
    useState<PrivacyConsent>(getPrivacyConsent());
  const [consentState, setConsentState] = useState<ConsentState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    if (!isVisible) return;
    let cancelled = false;
    (async () => {
      try {
        const [privacy, consent] = await Promise.all([
          Promise.resolve(getPrivacyConsent()),
          ConsentService.getConsents(),
        ]);
        if (!cancelled) {
          setPrivacyConsentState(privacy);
          setConsentState(consent);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isVisible]);
  return {
    privacyConsent,
    consentState,
    setPrivacyConsentState,
    setConsentState,
    isLoading,
  } as const;
}

function useOptOut(
  setPrivacyConsentState: React.Dispatch<React.SetStateAction<PrivacyConsent>>,
  setConsentState: React.Dispatch<React.SetStateAction<ConsentState | null>>,
  onComplete?: (c: PrivacyConsent) => void
) {
  return useCallback(async () => {
    try {
      await telemetryClient.clearQueue();
      const updates: Partial<PrivacyConsent> = {
        analytics: false,
        crashReporting: false,
        personalizedData: false,
        sessionReplay: false,
      };
      // Persist the partial updates (the helper accepts Partial and will merge)
      setPrivacyConsent(updates);
      // Merge the partial updates into local React state safely
      setPrivacyConsentState((p) => ({ ...p, ...updates }));
      for (const k of RUNTIME_CONSENT_KEYS) {
        await ConsentService.setConsent(k, false);
      }
      setConsentState((prevState) => {
        if (!prevState) return prevState; // Guard against null prevState
        return {
          ...prevState, // Preserve required fields like version and locale
          telemetry: false,
          experiments: false,
          cloudProcessing: false,
          aiTraining: false,
          aiModelImprovement: false,
          crashDiagnostics: false,
          timestamp: new Date().toISOString(),
        };
      });
      Alert.alert(
        translate('consent.opt_out_success.title'),
        translate('consent.opt_out_success.message'),
        [{ text: translate('common.ok') }]
      );
      // Construct a complete PrivacyConsent object by merging persisted
      // consent with the partial updates and a fresh timestamp. This
      // ensures callers always receive a fully-formed PrivacyConsent
      // instead of a Partial which would require unsafe assertions.
      const persisted = getPrivacyConsent();
      const fullConsent: PrivacyConsent = {
        ...persisted,
        ...updates,
        lastUpdated: Date.now(),
      };
      onComplete?.(fullConsent);
    } catch {
      Alert.alert(
        translate('consent.opt_out_error.title'),
        translate('consent.opt_out_error.message'),
        [{ text: translate('common.ok') }]
      );
    }
  }, [onComplete, setConsentState, setPrivacyConsentState]);
}

function useConsentActions({
  privacyConsent,
  setPrivacyConsentState,
  setConsentState,
  onComplete,
}: {
  privacyConsent: PrivacyConsent;
  setPrivacyConsentState: React.Dispatch<React.SetStateAction<PrivacyConsent>>;
  setConsentState: React.Dispatch<React.SetStateAction<ConsentState | null>>;
  onComplete?: (c: PrivacyConsent) => void;
}) {
  const updatePrivacy = useCallback(
    (key: keyof PrivacyConsent, value: boolean) => {
      setPrivacyConsentState((prev) => {
        const updated = { ...prev, [key]: value };
        setPrivacyConsent(updated);
        return updated;
      });
    },
    [setPrivacyConsentState]
  );

  const updateRuntime = useCallback(
    async (purpose: RuntimeConsentPurpose, value: boolean) => {
      let shouldCallService = false;
      setConsentState((prev) => {
        if (!prev) return prev;
        shouldCallService = true;
        return { ...prev, [purpose]: value };
      });
      if (shouldCallService) {
        try {
          await ConsentService.setConsent(purpose, value);
        } catch {
          // swallow — optimistic update
        }
      }
    },
    [setConsentState]
  );

  const optOutAll = useOptOut(
    setPrivacyConsentState,
    setConsentState,
    onComplete
  );

  const bulkSet = useCallback(
    async (value: boolean) => {
      updatePrivacy('analytics', value);
      updatePrivacy('crashReporting', value);
      updatePrivacy('personalizedData', value);
      updatePrivacy('sessionReplay', value);
      // Await all runtime consent updates to prevent race conditions
      await Promise.all(
        RUNTIME_CONSENT_KEYS.map((k) => updateRuntime(k, value))
      );
    },
    [updatePrivacy, updateRuntime]
  );

  const save = useCallback(
    (cb?: (c: PrivacyConsent) => void) => cb?.(privacyConsent),
    [privacyConsent]
  );

  return { updatePrivacy, updateRuntime, optOutAll, bulkSet, save } as const;
}

function computeTitleKey(mode: ConsentManagerMode): TxKeyPath {
  return (
    mode === 'first-run'
      ? 'consent.first_run_title'
      : mode === 'opt-out'
        ? 'consent.opt_out_title'
        : 'consent.settings_title'
  ) as TxKeyPath;
}

function computeSubtitleKey(mode: ConsentManagerMode): TxKeyPath | null {
  return (
    mode === 'opt-out'
      ? 'consent.opt_out_subtitle'
      : 'consent.settings_subtitle'
  ) as TxKeyPath;
}

function ConsentHeader({
  titleKey,
  subtitleKey,
}: {
  titleKey: TxKeyPath;
  subtitleKey: TxKeyPath | null;
}) {
  return (
    <View className="mb-6">
      <Text className="mb-2 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
        {translate(titleKey)}
      </Text>
      {subtitleKey && (
        <Text className="text-base text-neutral-500 dark:text-neutral-400">
          {translate(subtitleKey)}
        </Text>
      )}
    </View>
  );
}

function ConsentFooter({
  privacyConsent,
  mode,
  bulkSet,
  save,
  onComplete,
  onDismiss,
}: {
  privacyConsent: PrivacyConsent;
  mode: ConsentManagerMode;
  bulkSet: (value: boolean) => Promise<void>;
  save: (cb?: (c: PrivacyConsent) => void) => void;
  onComplete?: (c: PrivacyConsent) => void;
  onDismiss?: () => void;
}) {
  return (
    <View className="border-t border-neutral-200 bg-white p-4 dark:border-white/10 dark:bg-charcoal-900">
      <ConsentActions
        mode={mode}
        onAcceptAll={async () => await bulkSet(true)}
        onRejectAll={async () => await bulkSet(false)}
        onSave={() => save(onComplete)}
        onDismiss={onDismiss}
      />
      <View className="mt-3">
        <Text className="text-xs text-neutral-500 dark:text-neutral-400">
          {translate('consent.last_updated', {
            date: new Date(privacyConsent.lastUpdated).toLocaleDateString(),
          })}
        </Text>
      </View>
    </View>
  );
}

function ConsentManagerView({
  mode,
  testID,
  titleKey,
  subtitleKey,
  privacyConsent,
  consentState,
  updatePrivacy,
  updateRuntime,
  optOutAll,
  bulkSet,
  save,
  onComplete,
  onDismiss,
}: {
  mode: ConsentManagerMode;
  testID: string;
  titleKey: TxKeyPath;
  subtitleKey: TxKeyPath | null;
  privacyConsent: PrivacyConsent;
  consentState: ConsentState | null;
  updatePrivacy: (key: keyof PrivacyConsent, value: boolean) => void;
  updateRuntime: (
    purpose: RuntimeConsentPurpose,
    value: boolean
  ) => Promise<void>;
  optOutAll: () => Promise<void>;
  bulkSet: (value: boolean) => Promise<void>;
  save: (cb?: (c: PrivacyConsent) => void) => void;
  onComplete?: (c: PrivacyConsent) => void;
  onDismiss?: () => void;
}) {
  return (
    <View className="flex-1 bg-neutral-50 dark:bg-charcoal-950" testID={testID}>
      <ScrollView className="flex-1 p-4">
        <ConsentHeader titleKey={titleKey} subtitleKey={subtitleKey} />
        {mode === 'opt-out' && (
          <QuickOptOutActions onOptOutAll={optOutAll} onDismiss={onDismiss} />
        )}
        <ConsentSections
          privacyConsent={privacyConsent}
          consentState={consentState}
          onPrivacyConsentChange={updatePrivacy}
          onConsentChange={updateRuntime}
        />
      </ScrollView>
      <ConsentFooter
        privacyConsent={privacyConsent}
        mode={mode}
        bulkSet={bulkSet}
        save={save}
        onComplete={onComplete}
        onDismiss={onDismiss}
      />
    </View>
  );
}

export function ConsentManager({
  mode,
  isVisible,
  onComplete,
  onDismiss,
  testID = 'consent-manager',
}: Props) {
  const {
    privacyConsent,
    consentState,
    setPrivacyConsentState,
    setConsentState,
    isLoading,
  } = usePrivacyConsentState(isVisible);
  const { updatePrivacy, updateRuntime, optOutAll, bulkSet, save } =
    useConsentActions({
      privacyConsent,
      setPrivacyConsentState,
      setConsentState,
      onComplete,
    });

  const hidden = !isVisible || isLoading;

  const titleKey = useMemo(() => computeTitleKey(mode), [mode]);
  const subtitleKey = useMemo(() => computeSubtitleKey(mode), [mode]);

  if (hidden) return null;
  return (
    <ConsentManagerView
      mode={mode}
      testID={testID}
      titleKey={titleKey}
      subtitleKey={subtitleKey}
      privacyConsent={privacyConsent}
      consentState={consentState}
      updatePrivacy={updatePrivacy}
      updateRuntime={updateRuntime}
      optOutAll={optOutAll}
      bulkSet={bulkSet}
      save={save}
      onComplete={onComplete}
      onDismiss={onDismiss}
    />
  );
}

export default ConsentManager;
