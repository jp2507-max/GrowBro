import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, Switch, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { translate } from '@/lib';
import type { TxKeyPath } from '@/lib/i18n/utils';
import { ConsentService } from '@/lib/privacy/consent-service';
import { telemetryClient } from '@/lib/privacy/telemetry-client';
import {
  getPrivacyConsent,
  type PrivacyConsent,
  setPrivacyConsent,
} from '@/lib/privacy-consent';

type ConsentManagerMode = 'first-run' | 'settings' | 'opt-out';

type Props = {
  mode: ConsentManagerMode;
  isVisible: boolean;
  onComplete?: (consents: PrivacyConsent) => void;
  onDismiss?: () => void;
  testID?: string;
};

type ToggleConfig = {
  key: string; // consent key (privacy or runtime)
  isPrivacy: boolean;
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
    infoTitleTx: 'consent.telemetry.infoTitle' as TxKeyPath,
    infoBodyTx: 'consent.telemetry.infoBody' as TxKeyPath,
    testID: 'consent-telemetry',
  },
  {
    key: 'analytics',
    isPrivacy: true,
    titleTx: 'consent.analytics.title' as TxKeyPath,
    subtitleTx: 'consent.analytics.subtitle' as TxKeyPath,
    impactTx: 'consent.analytics.impact' as TxKeyPath,
    infoTitleTx: 'consent.analytics.infoTitle' as TxKeyPath,
    infoBodyTx: 'consent.analytics.infoBody' as TxKeyPath,
    testID: 'consent-analytics',
  },
  {
    key: 'crashReporting',
    isPrivacy: true,
    titleTx: 'consent.crashReporting.title' as TxKeyPath,
    subtitleTx: 'consent.crashReporting.subtitle' as TxKeyPath,
    impactTx: 'consent.crashReporting.impact' as TxKeyPath,
    infoTitleTx: 'consent.crashReporting.infoTitle' as TxKeyPath,
    infoBodyTx: 'consent.crashReporting.infoBody' as TxKeyPath,
    testID: 'consent-crashReporting',
  },
  {
    key: 'personalizedData',
    isPrivacy: true,
    titleTx: 'consent.personalized.title' as TxKeyPath,
    subtitleTx: 'consent.personalized.subtitle' as TxKeyPath,
    impactTx: 'consent.personalized.impact' as TxKeyPath,
    infoTitleTx: 'consent.personalized.infoTitle' as TxKeyPath,
    infoBodyTx: 'consent.personalized.infoBody' as TxKeyPath,
    testID: 'consent-personalized',
  },
  {
    key: 'sessionReplay',
    isPrivacy: true,
    titleTx: 'consent.sessionReplay.title' as TxKeyPath,
    subtitleTx: 'consent.sessionReplay.subtitle' as TxKeyPath,
    impactTx: 'consent.sessionReplay.impact' as TxKeyPath,
    infoTitleTx: 'consent.sessionReplay.infoTitle' as TxKeyPath,
    infoBodyTx: 'consent.sessionReplay.infoBody' as TxKeyPath,
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
    <View className="mb-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-4">
          <Text
            className="text-base font-medium text-gray-900 dark:text-gray-100"
            onPress={onInfoPress}
            testID={`${testID}-title`}
          >
            {title}
          </Text>
          <Text className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {subtitle}
          </Text>
          {impactText && (
            <Text className="mt-2 text-xs text-gray-500 dark:text-gray-400">
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
  onOptOutAll: () => void;
  onDismiss?: () => void;
}) {
  return (
    <View className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
      <Text className="mb-2 text-sm font-medium text-red-800 dark:text-red-200">
        {translate('consent.quickOptOut.title')}
      </Text>
      <Text className="mb-3 text-xs text-red-600 dark:text-red-300">
        {translate('consent.quickOptOut.description')}
      </Text>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button
            label={translate('consent.optOutAll')}
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
  consentState: any;
  onPrivacyConsentChange: (k: keyof PrivacyConsent, v: boolean) => void;
  onConsentChange: (purpose: string, v: boolean) => void;
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
          ? (privacyConsent as any)[cfg.key]
          : (consentState?.[cfg.key] ?? false);
        const onChange = (v: boolean) =>
          cfg.isPrivacy
            ? onPrivacyConsentChange(cfg.key as keyof PrivacyConsent, v)
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
            ? translate('consent.getStarted')
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
  const [consentState, setConsentState] = useState<any>(null);
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

const RUNTIME_KEYS = [
  'telemetry',
  'experiments',
  'aiTraining',
  'crashDiagnostics',
] as const;

function useOptOut(
  setPrivacyConsentState: React.Dispatch<React.SetStateAction<PrivacyConsent>>,
  setConsentState: React.Dispatch<any>,
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
      setPrivacyConsent(updates as PrivacyConsent);
      setPrivacyConsentState((p) => ({ ...p, ...updates }) as PrivacyConsent);
      for (const k of RUNTIME_KEYS) {
        await ConsentService.setConsent(k as any, false);
      }
      setConsentState({
        telemetry: false,
        experiments: false,
        aiTraining: false,
        crashDiagnostics: false,
      });
      Alert.alert(
        translate('consent.optOutSuccess.title'),
        translate('consent.optOutSuccess.message'),
        [{ text: translate('common.ok') }]
      );
      onComplete?.(updates as PrivacyConsent);
    } catch {
      Alert.alert(
        translate('consent.optOutError.title'),
        translate('consent.optOutError.message'),
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
  setConsentState: React.Dispatch<any>;
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
    async (purpose: string, value: boolean) => {
      setConsentState((prev: any) => ({ ...prev, [purpose]: value }));
      try {
        await ConsentService.setConsent(purpose as any, value);
      } catch {
        // swallow — optimistic update
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
    (value: boolean) => {
      updatePrivacy('analytics', value);
      updatePrivacy('crashReporting', value);
      updatePrivacy('personalizedData', value);
      updatePrivacy('sessionReplay', value);
      RUNTIME_KEYS.forEach((k) => updateRuntime(k, value));
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
        ? 'consent.optOutTitle'
        : 'consent.settingsTitle'
  ) as TxKeyPath;
}

function computeSubtitleKey(mode: ConsentManagerMode): TxKeyPath | null {
  return (
    mode === 'opt-out' ? 'consent.optOutSubtitle' : 'consent.settingsSubtitle'
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
      <Text className="mb-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
        {translate(titleKey)}
      </Text>
      {subtitleKey && (
        <Text className="text-base text-gray-600 dark:text-gray-400">
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
}: any) {
  return (
    <View className="border-t border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
      <ConsentActions
        mode={mode}
        onAcceptAll={() => bulkSet(true)}
        onRejectAll={() => bulkSet(false)}
        onSave={() => save(onComplete)}
        onDismiss={onDismiss}
      />
      <View className="mt-3">
        <Text className="text-xs text-gray-500 dark:text-gray-400">
          {translate('consent.lastUpdated', {
            date: new Date(privacyConsent.lastUpdated).toLocaleDateString(),
          })}
        </Text>
      </View>
    </View>
  );
}

function ConsentManagerView(props: any) {
  const {
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
  } = props;
  return (
    <View className="flex-1 bg-white dark:bg-gray-900" testID={testID}>
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
