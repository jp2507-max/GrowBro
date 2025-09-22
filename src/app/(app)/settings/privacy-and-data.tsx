import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Linking } from 'react-native';

import { PrivacySettings } from '@/components/privacy-settings';
import {
  Button,
  FocusAwareStatusBar,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import { translate, useAuth } from '@/lib';
import {
  deleteAccountInApp,
  provideWebDeletionUrl,
  requestDataExport,
} from '@/lib/privacy/deletion-manager';

function formatEta(iso?: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString();
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

function useDataExport(): { queueExport: () => void; isExporting: boolean } {
  const [isExporting, setIsExporting] = useState(false);

  const queueExport = useCallback(() => {
    if (isExporting) return;
    setIsExporting(true);
    (async () => {
      try {
        const result = await requestDataExport();
        const eta = formatEta(result.estimatedCompletion);
        Alert.alert(
          translate('privacy.exportQueuedTitle'),
          eta
            ? translate('privacy.exportQueuedBody', { eta })
            : translate('privacy.exportQueuedBodyNoEta')
        );
      } catch (error) {
        Alert.alert(
          translate('privacy.exportErrorTitle'),
          translate('privacy.exportErrorBody', {
            message: extractErrorMessage(error),
          })
        );
      } finally {
        setIsExporting(false);
      }
    })();
  }, [isExporting]);

  return { queueExport, isExporting };
}

function useAccountDeletion(signOut: () => void): {
  queueDeletion: () => void;
  confirmDeletion: () => void;
  isDeleting: boolean;
} {
  const [isDeleting, setIsDeleting] = useState(false);

  const queueDeletion = useCallback(() => {
    if (isDeleting) return;
    setIsDeleting(true);
    (async () => {
      try {
        const result = await deleteAccountInApp();
        const eta = formatEta(result.estimatedCompletion);
        Alert.alert(
          translate('privacy.deleteAccountQueuedTitle'),
          eta
            ? translate('privacy.deleteAccountQueuedBody', { eta })
            : translate('privacy.deleteAccountQueuedBodyNoEta')
        );
        signOut();
      } catch (error) {
        Alert.alert(
          translate('privacy.deleteAccountErrorTitle'),
          translate('privacy.deleteAccountErrorBody', {
            message: extractErrorMessage(error),
          })
        );
      } finally {
        setIsDeleting(false);
      }
    })();
  }, [isDeleting, signOut]);

  const confirmDeletion = useCallback(() => {
    Alert.alert(
      translate('privacy.deleteAccountConfirmTitle'),
      translate('privacy.deleteAccountConfirmBody'),
      [
        {
          text: translate('privacy.deleteAccountConfirmCancel'),
          style: 'cancel',
        },
        {
          text: translate('privacy.deleteAccountConfirmAction'),
          style: 'destructive',
          onPress: () => {
            queueDeletion();
          },
        },
      ]
    );
  }, [queueDeletion]);

  return { queueDeletion, confirmDeletion, isDeleting };
}

function WebDeletionSection(): React.ReactElement | null {
  const webDeletionUrl = useMemo(() => provideWebDeletionUrl(), []);
  const webDeletionLabel = useMemo(
    () => (webDeletionUrl ? webDeletionUrl.replace(/^https?:\/\//, '') : ''),
    [webDeletionUrl]
  );

  if (!webDeletionUrl) {
    return null;
  }

  return (
    <View className="gap-2 rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
      <Text className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        {translate('privacy.webDeletionHeading')}
      </Text>
      <Text className="text-sm text-gray-700 dark:text-gray-300">
        {translate('privacy.webDeletionPrompt', {
          url: webDeletionLabel,
        })}
      </Text>
      <Button
        label={translate('privacy.openWebDeletion')}
        onPress={async () => {
          try {
            if (!webDeletionUrl.startsWith('https://')) {
              Alert.alert(
                translate('privacy.invalidUrlTitle'),
                translate('privacy.invalidUrlBody')
              );
              return;
            }

            const canOpen = await Linking.canOpenURL(webDeletionUrl);
            if (canOpen) {
              await Linking.openURL(webDeletionUrl);
            } else {
              Alert.alert(
                translate('privacy.cannotOpenUrlTitle'),
                translate('privacy.cannotOpenUrlBody')
              );
            }
          } catch (error) {
            console.error('Error opening web deletion URL:', error);
            Alert.alert(
              translate('privacy.urlErrorTitle'),
              translate('privacy.urlErrorBody', {
                message: extractErrorMessage(error),
              })
            );
          }
        }}
      />
    </View>
  );
}

export default function PrivacyAndDataScreen(): React.ReactElement {
  const signOut = useAuth.use.signOut();
  const { queueExport } = useDataExport();
  const { confirmDeletion } = useAccountDeletion(signOut);

  return (
    <>
      <FocusAwareStatusBar />
      <ScrollView>
        <View className="gap-6 px-4 pb-12 pt-16">
          <View className="gap-2">
            <Text className="text-xl font-bold">
              {translate('settings.privacy_and_data')}
            </Text>
            <Text className="text-sm text-gray-600 dark:text-gray-300">
              {translate('privacy.manageDataDescription')}
            </Text>
          </View>

          <PrivacySettings
            onDataExport={queueExport}
            onAccountDeletion={confirmDeletion}
          />

          <WebDeletionSection />
        </View>
      </ScrollView>
    </>
  );
}
