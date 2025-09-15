import React, { useEffect, useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';

import { translate } from '@/lib';
import {
  getPrivacyConsent,
  type PrivacyConsent,
  setPrivacyConsent,
} from '@/lib/privacy-consent';

interface PrivacySettingsProps {
  onConsentChange?: (consent: PrivacyConsent) => void;
}

type AllowedConsentKey = Exclude<keyof PrivacyConsent, 'lastUpdated'>;

// Small, reusable toggle row to keep components modular (Project rule: Component Modularity)
type ToggleRowProps = {
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (value: boolean) => void;
  onInfoPress?: () => void;
  testID?: string;
};

function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
  onInfoPress,
  testID,
}: ToggleRowProps) {
  return (
    <View
      className="flex-row items-center justify-between py-2"
      testID={testID}
    >
      <View className="flex-1 pr-4">
        <Text
          className="text-base font-medium text-gray-900 dark:text-gray-100"
          onPress={onInfoPress}
          testID={testID ? `${testID}-title` : undefined}
        >
          {title}
        </Text>
        <Text className="text-sm text-gray-600 dark:text-gray-400">
          {subtitle}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        testID={testID ? `${testID}-switch` : undefined}
      />
    </View>
  );
}

function showPersonalizedDataInfo(): void {
  Alert.alert(
    translate('privacy.personalized.title'),
    translate('privacy.personalized.body'),
    [{ text: translate('common.ok') }]
  );
}

function showSessionReplayInfo(): void {
  Alert.alert(
    translate('privacy.sessionReplay.title'),
    translate('privacy.sessionReplay.body'),
    [{ text: translate('common.ok') }]
  );
}

function PrivacySettingsContent({
  consent,
  updateConsent,
}: {
  consent: PrivacyConsent;
  updateConsent: (key: AllowedConsentKey, value: boolean) => void;
}) {
  return (
    <View className="space-y-4 p-4" testID="privacy-settings">
      <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        {translate('privacy.title')}
      </Text>

      <View className="space-y-4">
        <ToggleRow
          title={translate('privacy.crashReporting.title')}
          subtitle={translate('privacy.crashReporting.subtitle')}
          value={consent.crashReporting}
          onChange={(value) => updateConsent('crashReporting', value)}
          testID="toggle-crashReporting"
        />

        <ToggleRow
          title={translate('privacy.analytics.title')}
          subtitle={translate('privacy.analytics.subtitle')}
          value={consent.analytics}
          onChange={(value) => updateConsent('analytics', value)}
          testID="toggle-analytics"
        />

        <ToggleRow
          title={translate('privacy.personalized.title')}
          subtitle={translate('privacy.personalized.subtitle')}
          value={consent.personalizedData}
          onChange={(value) => updateConsent('personalizedData', value)}
          onInfoPress={showPersonalizedDataInfo}
          testID="toggle-personalizedData"
        />

        <ToggleRow
          title={translate('privacy.sessionReplay.title')}
          subtitle={translate('privacy.sessionReplay.subtitle')}
          value={consent.sessionReplay}
          onChange={(value) => updateConsent('sessionReplay', value)}
          onInfoPress={showSessionReplayInfo}
          testID="toggle-sessionReplay"
        />
      </View>

      <Text
        className="mt-4 text-xs text-gray-500 dark:text-gray-400"
        testID="privacy-settings-last-updated"
      >
        {translate('privacy.lastUpdated', {
          date: new Date(consent.lastUpdated).toLocaleDateString(),
        })}
      </Text>
    </View>
  );
}

export function PrivacySettings({ onConsentChange }: PrivacySettingsProps) {
  const [consent, setConsentState] =
    useState<PrivacyConsent>(getPrivacyConsent());

  useEffect(() => {
    setConsentState(getPrivacyConsent());
  }, []);

  function updateConsent(key: AllowedConsentKey, value: boolean): void {
    // Create updater object without lastUpdated (it will be set by setPrivacyConsent)
    const updates = { [key]: value };
    // Persist the consent changes - setPrivacyConsent will handle lastUpdated
    setPrivacyConsent(updates);
    // Get the persisted object (which now includes the updated lastUpdated)
    const persistedConsent = getPrivacyConsent();
    // Use persisted object as single source of truth for UI state
    setConsentState(persistedConsent);
    onConsentChange?.(persistedConsent);
  }

  return (
    <PrivacySettingsContent consent={consent} updateConsent={updateConsent} />
  );
}
