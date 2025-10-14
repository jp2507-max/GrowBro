import * as FileSystem from 'expo-file-system';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, Share, Switch, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { showErrorMessage } from '@/components/ui/utils';
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

async function handleDataExport(): Promise<void> {
  let tempFileUri: string | null = null;
  try {
    const exportData = await generatePrivacyExportJson();

    // For large JSON exports, write to temporary file to avoid truncation
    // Use the documentDirectory exposed on the FileSystem namespace. Some
    // versions of the `expo-file-system` types don't declare these runtime
    // constants, so cast to `any` to read them at runtime safely.
    const fsAny = FileSystem as any;
    const docDir = fsAny.documentDirectory ?? fsAny.cacheDirectory ?? '';

    // Abort export if no valid directory is available to prevent invalid paths
    if (!docDir) {
      console.error(
        '[PrivacySettings] No valid file system directory available for export'
      );
      showErrorMessage(translate('privacy.exportError.message'));
      return;
    }

    tempFileUri = `${docDir}privacy-export-${Date.now()}.json`;
    await FileSystem.writeAsStringAsync(tempFileUri, exportData);

    // Use Share API to let user save or share the export file
    const shareOptions =
      Platform.OS === 'ios'
        ? {
            url: tempFileUri,
            title: translate('privacy.exportData'),
          }
        : {
            message: tempFileUri,
            title: translate('privacy.exportData'),
          };

    const shareResult = await Share.share(shareOptions);

    // Handle user cancellation via Share.dismissedAction
    if (shareResult.action === Share.dismissedAction) {
      return; // User cancelled, silently return
    }

    // Only call onDataExport if the user actually shared
    if (shareResult.action === Share.sharedAction) {
      // Note: onDataExport callback removed as it's not used in this context
    }
  } catch (error) {
    // Only suppress alerts for genuine platform-specific cancellation indicators
    const isPlatformCancellation =
      (error as any)?.code === 'ECANCELLED' || // iOS specific
      (error as any)?.domain === 'com.apple.ShareSheet' || // iOS ShareSheet cancellation
      ((error as any)?.message?.includes('cancelled by user') &&
        (error as any)?.code === 3); // Android specific

    if (!isPlatformCancellation) {
      console.error('[PrivacySettings] Data export failed:', error);
      Alert.alert(
        translate('privacy.exportError.title'),
        translate('privacy.exportError.message'),
        [{ text: translate('common.ok') }]
      );
    }
    // If user cancelled via platform-specific cancellation, silently ignore
  } finally {
    // Clean up temporary file regardless of success/failure
    if (tempFileUri) {
      await FileSystem.deleteAsync(tempFileUri, { idempotent: true });
    }
  }
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

function PrivacyActions({
  updateConsent,
  onDataExport,
  onAccountDeletion,
}: {
  updateConsent: (key: AllowedConsentKey, value: boolean) => void;
  onDataExport?: () => void;
  onAccountDeletion?: () => void;
}): React.ReactElement {
  const handleExportWithCallback = async (): Promise<void> => {
    await handleDataExport();
    // Call onDataExport callback if provided
    if (onDataExport) onDataExport();
  };

  const handleRejectAll = (): void => {
    updateConsent('crashReporting', false);
    updateConsent('analytics', false);
    updateConsent('personalizedData', false);
    updateConsent('sessionReplay', false);
  };

  const handleAcceptAll = (): void => {
    updateConsent('crashReporting', true);
    updateConsent('analytics', true);
    updateConsent('personalizedData', true);
    updateConsent('sessionReplay', true);
  };

  const handleDeleteAccount = (): void => {
    if (onAccountDeletion) onAccountDeletion();
    else
      Alert.alert(
        translate('privacy.deleteAccount'),
        translate('privacy.deleteAccount'),
        [{ text: translate('common.ok') }]
      );
  };

  return (
    <View className="mt-4 gap-2">
      {}
      <Button
        label={translate('consent.reject_all')}
        onPress={handleRejectAll}
        testID="privacy-reject-all-btn"
      />
      {}
      <Button
        label={translate('consent.accept_all')}
        onPress={handleAcceptAll}
        testID="privacy-accept-all-btn"
      />
      {}
      <Button
        label={translate('privacy.exportData')}
        onPress={handleExportWithCallback}
        testID="privacy-export-btn"
      />
      {}
      <Button
        label={translate('privacy.deleteAccount')}
        onPress={handleDeleteAccount}
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
