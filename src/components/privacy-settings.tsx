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

// Small, reusable toggle row to keep components modular (Project rule: Component Modularity)
type ToggleRowProps = {
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (value: boolean) => void;
  onInfoPress?: () => void;
};

function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
  onInfoPress,
}: ToggleRowProps) {
  return (
    <View className="flex-row items-center justify-between py-2">
      <View className="flex-1 pr-4">
        <Text
          className="text-base font-medium text-gray-900 dark:text-gray-100"
          onPress={onInfoPress}
        >
          {title}
        </Text>
        <Text className="text-sm text-gray-600 dark:text-gray-400">
          {subtitle}
        </Text>
      </View>
      <Switch value={value} onValueChange={onChange} />
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

export function PrivacySettings({ onConsentChange }: PrivacySettingsProps) {
  const [consent, setConsentState] =
    useState<PrivacyConsent>(getPrivacyConsent());

  useEffect(() => {
    setConsentState(getPrivacyConsent());
  }, []);

  function updateConsent(key: keyof PrivacyConsent, value: boolean): void {
    if (key === 'lastUpdated') return; // Don't allow manual update of timestamp

    const now = Date.now();
    const newConsent = { ...consent, [key]: value, lastUpdated: now };
    // Update local state immediately so the UI reflects the new timestamp
    setConsentState(newConsent);
    // Persist the full consent object so reads are canonical; pass the same
    // object to onConsentChange so consumers get the updated timestamp too.
    setPrivacyConsent(newConsent);
    onConsentChange?.(newConsent);
  }

  return (
    <View className="space-y-4 p-4">
      <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        Privacy Settings
      </Text>

      <View className="space-y-4">
        <ToggleRow
          title={translate('privacy.crashReporting.title')}
          subtitle={translate('privacy.crashReporting.subtitle')}
          value={consent.crashReporting}
          onChange={(value) => updateConsent('crashReporting', value)}
        />

        <ToggleRow
          title={translate('privacy.analytics.title')}
          subtitle={translate('privacy.analytics.subtitle')}
          value={consent.analytics}
          onChange={(value) => updateConsent('analytics', value)}
        />

        <ToggleRow
          title="Personalized Data ℹ️"
          subtitle="Include identifying information in reports"
          value={consent.personalizedData}
          onChange={(value) => updateConsent('personalizedData', value)}
          onInfoPress={showPersonalizedDataInfo}
        />

        <ToggleRow
          title="Session Replay ℹ️"
          subtitle="Record app interactions for debugging"
          value={consent.sessionReplay}
          onChange={(value) => updateConsent('sessionReplay', value)}
          onInfoPress={showSessionReplayInfo}
        />
      </View>

      <Text className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        Last updated: {new Date(consent.lastUpdated).toLocaleDateString()}
      </Text>
    </View>
  );
}
