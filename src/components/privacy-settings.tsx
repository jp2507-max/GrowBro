import React, { useEffect, useState } from 'react';
import { Alert, Share, Switch, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { translate } from '@/lib';
import { generatePrivacyExportJson } from '@/lib/privacy/export-service';
import {
  getPrivacyConsent,
  type PrivacyConsent,
  setPrivacyConsent,
} from '@/lib/privacy-consent';

interface PrivacySettingsProps {
  onConsentChange?: (consent: PrivacyConsent) => void;
  onDataExport?: () => void;
  onAccountDeletion?: () => void;
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

function showAnalyticsInfo(): void {
  Alert.alert(
    translate('privacy.analytics.title'),
    translate('privacy.analytics.body'),
    [{ text: translate('common.ok') }]
  );
}

function showCrashReportingInfo(): void {
  Alert.alert(
    translate('privacy.crashReporting.title'),
    translate('privacy.crashReporting.body'),
    [{ text: translate('common.ok') }]
  );
}

function PrivacyToggles({
  consent,
  updateConsent,
}: {
  consent: PrivacyConsent;
  updateConsent: (key: AllowedConsentKey, value: boolean) => void;
}): React.ReactElement {
  return (
    <View className="space-y-4">
      <ToggleRow
        title={translate('privacy.crashReporting.title')}
        subtitle={translate('privacy.crashReporting.subtitle')}
        value={consent.crashReporting}
        onChange={(value) => updateConsent('crashReporting', value)}
        onInfoPress={showCrashReportingInfo}
        testID="toggle-crashReporting"
      />

      <ToggleRow
        title={translate('privacy.analytics.title')}
        subtitle={translate('privacy.analytics.subtitle')}
        value={consent.analytics}
        onChange={(value) => updateConsent('analytics', value)}
        onInfoPress={showAnalyticsInfo}
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
  );
}

// eslint-disable-next-line max-lines-per-function
function PrivacyActions({
  updateConsent,
  onDataExport,
  onAccountDeletion,
}: {
  updateConsent: (key: AllowedConsentKey, value: boolean) => void;
  onDataExport?: () => void;
  onAccountDeletion?: () => void;
}): React.ReactElement {
  const handleExport = async () => {
    try {
      const exportData = await generatePrivacyExportJson();

      // Use Share API to let user save or share the export
      await Share.share({
        message: exportData,
        title: translate('privacy.exportData'),
      });

      if (onDataExport) {
        onDataExport();
      }
    } catch {
      Alert.alert(
        translate('privacy.exportError.title'),
        translate('privacy.exportError.message'),
        [{ text: translate('common.ok') }]
      );
    }
  };

  return (
    <View className="mt-4 gap-2">
      <Button
        label={translate('consent.reject_all')}
        onPress={() => {
          updateConsent('crashReporting', false);
          updateConsent('analytics', false);
          updateConsent('personalizedData', false);
          updateConsent('sessionReplay', false);
        }}
        testID="privacy-reject-all-btn"
      />
      <Button
        label={translate('consent.accept_all')}
        onPress={() => {
          updateConsent('crashReporting', true);
          updateConsent('analytics', true);
          updateConsent('personalizedData', true);
          updateConsent('sessionReplay', true);
        }}
        testID="privacy-accept-all-btn"
      />
      <Button
        label={translate('privacy.exportData')}
        onPress={handleExport}
        testID="privacy-export-btn"
      />
      <Button
        label={translate('privacy.deleteAccount')}
        onPress={() => {
          if (onAccountDeletion) onAccountDeletion();
          else
            Alert.alert(
              translate('privacy.deleteAccount'),
              translate('privacy.deleteAccount'),
              [{ text: translate('common.ok') }]
            );
        }}
        testID="privacy-delete-btn"
      />
    </View>
  );
}

function PrivacySettingsContent({
  consent,
  updateConsent,
  onDataExport,
  onAccountDeletion,
}: {
  consent: PrivacyConsent;
  updateConsent: (key: AllowedConsentKey, value: boolean) => void;
  onDataExport?: () => void;
  onAccountDeletion?: () => void;
}) {
  return (
    <View className="space-y-4 p-4" testID="privacy-settings">
      <Text className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        {translate('privacy.title')}
      </Text>

      <PrivacyToggles consent={consent} updateConsent={updateConsent} />

      <Text
        className="mt-4 text-xs text-gray-500 dark:text-gray-400"
        testID="privacy-settings-last-updated"
      >
        {translate('privacy.lastUpdated', {
          date: new Date(consent.lastUpdated).toLocaleDateString(),
        })}
      </Text>

      <PrivacyActions
        updateConsent={updateConsent}
        onDataExport={onDataExport}
        onAccountDeletion={onAccountDeletion}
      />
    </View>
  );
}

export function PrivacySettings({
  onConsentChange,
  onDataExport,
  onAccountDeletion,
}: PrivacySettingsProps) {
  const [consent, setConsentState] =
    useState<PrivacyConsent>(getPrivacyConsent());

  useEffect(() => {
    setConsentState(getPrivacyConsent());
  }, []);

  function updateConsent(key: AllowedConsentKey, value: boolean): void {
    // Create updater object without lastUpdated (it will be set by setPrivacyConsent)
    const updates: Partial<PrivacyConsent> = { [key]: value };
    // Persist the consent changes - setPrivacyConsent will handle lastUpdated
    setPrivacyConsent(updates);
    // Get the persisted object (which now includes the updated lastUpdated)
    const persistedConsent = getPrivacyConsent();
    // Use persisted object as single source of truth for UI state
    setConsentState(persistedConsent);
    onConsentChange?.(persistedConsent);
  }

  return (
    <PrivacySettingsContent
      consent={consent}
      updateConsent={updateConsent}
      onDataExport={onDataExport}
      onAccountDeletion={onAccountDeletion}
    />
  );
}
