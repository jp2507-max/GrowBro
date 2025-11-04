import { Env } from '@env';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Linking, Platform } from 'react-native';

import { Item } from '@/components/settings/item';
import { ItemsContainer } from '@/components/settings/items-container';
import { OfflineBadge } from '@/components/settings/offline-badge';
import {
  Button,
  FocusAwareStatusBar,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import { useNetworkStatus } from '@/lib/hooks/use-network-status';
import { translate } from '@/lib/i18n';

type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'up-to-date'
  | 'downloading'
  | 'ready'
  | 'error';

interface UpdateState {
  status: UpdateStatus;
  errorMessage?: string;
  manifest?: Updates.Manifest;
}

const APP_STORE_URL = Platform.select({
  ios: Constants.expoConfig?.ios?.appStoreUrl || 'https://growbro.app',
  android: `https://play.google.com/store/apps/details?id=${Env.PACKAGE}`,
  default: 'https://growbro.app',
});

const WEBSITE_URL = 'https://growbro.app';
const GITHUB_URL = 'https://github.com/jp2507-max/GrowBro';
const COPYRIGHT_TEXT = `© ${new Date().getFullYear()} GrowBro`;

// eslint-disable-next-line max-lines-per-function
export default function AboutScreen() {
  const { isInternetReachable } = useNetworkStatus();
  const isOffline = !isInternetReachable;

  const [updateState, setUpdateState] = useState<UpdateState>({
    status: 'idle',
  });

  const isOTAEnabled = Updates.isEnabled;

  const checkForUpdates = async () => {
    if (!isOTAEnabled) {
      // If OTA is disabled, open the app store listing
      try {
        await Linking.openURL(APP_STORE_URL);
        return;
      } catch (error) {
        console.error('Failed to open app store:', error);
        setUpdateState({
          status: 'error',
          errorMessage:
            error instanceof Error ? error.message : 'Failed to open app store',
        });
        Alert.alert(
          'Error',
          'Failed to open app store. Please try again or check your device settings.'
        );
        return;
      }
    }

    if (isOffline) {
      return;
    }

    setUpdateState({ status: 'checking' });

    try {
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        setUpdateState({
          status: 'available',
          manifest: update.manifest,
        });
      } else {
        setUpdateState({ status: 'up-to-date' });
      }
    } catch (error) {
      setUpdateState({
        status: 'error',
        errorMessage:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  };

  const downloadAndApplyUpdate = async () => {
    setUpdateState({ status: 'downloading' });

    try {
      await Updates.fetchUpdateAsync();
      setUpdateState({ status: 'ready' });
    } catch (error) {
      setUpdateState({
        status: 'error',
        errorMessage:
          error instanceof Error ? error.message : 'Download failed',
      });
    }
  };

  const restartToApply = async () => {
    try {
      await Updates.reloadAsync();
    } catch (error) {
      setUpdateState({
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Restart failed',
      });
    }
  };

  const getUpdateButtonText = (): string => {
    switch (updateState.status) {
      case 'idle':
        return translate('settings.about.check_updates');
      case 'checking':
        return translate('settings.about.checking');
      case 'available':
        return translate('settings.about.download_update');
      case 'downloading':
        return translate('settings.about.downloading');
      case 'ready':
        return translate('settings.about.restart_to_apply');
      case 'up-to-date':
        return translate('settings.about.up_to_date');
      case 'error':
        return translate('settings.about.retry');
      default:
        return translate('settings.about.check_updates');
    }
  };

  const handleUpdateAction = async () => {
    switch (updateState.status) {
      case 'idle':
      case 'error':
        await checkForUpdates();
        break;
      case 'available':
        await downloadAndApplyUpdate();
        break;
      case 'ready':
        await restartToApply();
        break;
      default:
        break;
    }
  };

  const isUpdateButtonDisabled =
    updateState.status === 'checking' ||
    updateState.status === 'downloading' ||
    updateState.status === 'up-to-date' ||
    (isOffline && isOTAEnabled);

  return (
    <>
      <FocusAwareStatusBar />
      <ScrollView>
        <View className="flex-1 px-4 pt-4">
          {/* App Information Section */}
          <ItemsContainer title="settings.about.app_info">
            <Item text="settings.about.app_name" value={Env.NAME} disabled />
            <Item text="settings.about.version" value={Env.VERSION} disabled />
            <Item
              text="settings.about.build_number"
              value={
                Constants.expoConfig?.extra?.buildNumber ||
                Constants.expoConfig?.version ||
                Env.VERSION
              }
              disabled
            />
            <Item
              text="settings.about.environment"
              value={Env.APP_ENV}
              disabled
            />
          </ItemsContainer>

          {/* Update Section */}
          <View className="mt-4">
            <ItemsContainer title="settings.about.updates">
              <View className="px-4 py-3">
                {updateState.status === 'up-to-date' && (
                  <View className="mb-3 rounded-lg bg-success-50 p-3 dark:bg-success-900/20">
                    <Text className="text-center text-sm text-success-700 dark:text-success-300">
                      {translate('settings.about.up_to_date_message')}
                    </Text>
                  </View>
                )}

                {updateState.status === 'available' && updateState.manifest && (
                  <View className="mb-3 rounded-lg bg-primary-50 p-3 dark:bg-primary-900/20">
                    <Text className="text-sm font-semibold text-primary-700 dark:text-primary-300">
                      {translate('settings.about.update_available')}
                    </Text>
                  </View>
                )}

                {updateState.status === 'error' && (
                  <View className="mb-3 rounded-lg bg-danger-50 p-3 dark:bg-danger-900/20">
                    <Text className="text-sm text-danger-700 dark:text-danger-300">
                      {translate('settings.about.error_checking')}
                    </Text>
                    {updateState.errorMessage && (
                      <Text className="mt-1 text-xs text-danger-600 dark:text-danger-400">
                        {updateState.errorMessage}
                      </Text>
                    )}
                  </View>
                )}

                {updateState.status === 'downloading' && (
                  <View className="mb-3 flex-row items-center justify-center rounded-lg bg-primary-50 p-3 dark:bg-primary-900/20">
                    <ActivityIndicator size="small" className="mr-2" />
                    <Text className="text-sm text-primary-700 dark:text-primary-300">
                      Downloading update...
                    </Text>
                  </View>
                )}

                <Button
                  label={getUpdateButtonText()}
                  onPress={handleUpdateAction}
                  disabled={isUpdateButtonDisabled}
                  loading={
                    updateState.status === 'checking' ||
                    updateState.status === 'downloading'
                  }
                  variant={
                    updateState.status === 'ready' ? 'default' : 'outline'
                  }
                />

                {isOffline && isOTAEnabled && (
                  <View className="mt-2 flex-row items-center justify-center">
                    <OfflineBadge />
                    <Text className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">
                      {translate('settings.about.check_updates_offline')}
                    </Text>
                  </View>
                )}

                {!isOTAEnabled && (
                  <Text className="mt-2 text-center text-xs text-neutral-500 dark:text-neutral-400">
                    {translate('settings.about.ota_disabled')}
                  </Text>
                )}
              </View>
            </ItemsContainer>
          </View>

          {/* Links Section */}
          <ItemsContainer title="settings.about.links">
            <Item
              text="settings.about.website"
              onPress={() => Linking.openURL(WEBSITE_URL)}
              rightElement={isOffline ? <OfflineBadge /> : undefined}
              disabled={isOffline}
            />
            <Item
              text="settings.about.github"
              onPress={() => Linking.openURL(GITHUB_URL)}
              rightElement={isOffline ? <OfflineBadge /> : undefined}
              disabled={isOffline}
            />
          </ItemsContainer>

          {/* Copyright Section */}
          <View className="my-8">
            <Text className="text-center text-sm text-neutral-500 dark:text-neutral-400">
              {COPYRIGHT_TEXT}
            </Text>
            <Text className="mt-1 text-center text-xs text-neutral-400 dark:text-neutral-500">
              {translate('settings.about.educational_purpose')}
            </Text>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
