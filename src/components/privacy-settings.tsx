import React, { useEffect, useState } from 'react';
import { Alert, Switch, Text, View } from 'react-native';

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
    'Personalized Data',
    'This includes IP addresses, user IDs, and other identifying information that helps us provide better error reports and analytics. This data is handled according to our privacy policy.',
    [{ text: 'OK' }]
  );
}

function showSessionReplayInfo(): void {
  Alert.alert(
    'Session Replay',
    'Session replay records your app interactions to help us debug issues. Personal information is automatically filtered out, but you can disable this feature entirely.',
    [{ text: 'OK' }]
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

    const newConsent = { ...consent, [key]: value };
    setConsentState(newConsent);
    setPrivacyConsent({ [key]: value });
    onConsentChange?.(newConsent);
  }

  return (
    <View className="space-y-4 p-4">
      <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        Privacy Settings
      </Text>

      <View className="space-y-4">
        <ToggleRow
          title="Crash Reporting"
          subtitle="Help us fix bugs by sending crash reports"
          value={consent.crashReporting}
          onChange={(value) => updateConsent('crashReporting', value)}
        />

        <ToggleRow
          title="Analytics"
          subtitle="Help us improve the app with usage analytics"
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
