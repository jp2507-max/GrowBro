import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Linking } from 'react-native';

import { ReAuthModal, useReAuthModal } from '@/components/auth/re-auth-modal';
import { PrivacySettings } from '@/components/privacy-settings';
import {
  Button,
  FocusAwareStatusBar,
  ScrollView,
  Text,
  View,
} from '@/components/ui';
import { translate, type TxKeyPath, useAuth } from '@/lib';
import {
  deleteAccountInApp,
  provideWebDeletionUrl,
  requestDataExport,
} from '@/lib/privacy/deletion-manager';
import { presentExportViaShareSheet } from '@/lib/settings/export-share';

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

function useDataExport(onRequestExport: () => void): {
  queueExport: () => void;
  isExporting: boolean;
  performExport: () => Promise<void>;
} {
  const [isExporting, setIsExporting] = useState(false);

  const queueExport = useCallback(() => {
    if (isExporting) return;
    // Trigger re-authentication first
    onRequestExport();
  }, [isExporting, onRequestExport]);

  const performExport = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      // First, request the export from the backend
      const result = await requestDataExport();
      const eta = formatEta(result.estimatedCompletion);

      // Then, present the export via share sheet
      const shareResult = await presentExportViaShareSheet();

      if (shareResult.success) {
        Alert.alert(
          translate('privacy.exportReadyTitle' as TxKeyPath),
          translate('privacy.exportReadyBody' as TxKeyPath)
        );
      } else {
        // Fallback to old behavior if share sheet fails
        Alert.alert(
          translate('privacy.exportQueuedTitle'),
          eta
            ? translate('privacy.exportQueuedBody', { eta })
            : translate('privacy.exportQueuedBodyNoEta')
        );
      }
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
  }, [isExporting]);

  return { queueExport, isExporting, performExport };
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
    <View className="gap-2 rounded-lg bg-white p-4 dark:bg-charcoal-900">
      <Text className="text-sm font-semibold text-charcoal-900 dark:text-neutral-100">
        {translate('privacy.webDeletionHeading')}
      </Text>
      <Text className="text-sm text-neutral-600 dark:text-neutral-400">
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
  const { ref: reAuthModalRef, present: presentReAuthModal } = useReAuthModal();

  // Create a ref to store the performExport function
  const performExportRef = React.useRef<(() => Promise<void>) | null>(null);

  const { queueExport, performExport } = useDataExport(() => {
    // Request re-authentication before export
    presentReAuthModal();
  });

  // Store the performExport function in the ref
  React.useEffect(() => {
    performExportRef.current = performExport;
  }, [performExport]);

  const handleReAuthSuccess = () => {
    // User successfully re-authenticated, proceed with export
    if (performExportRef.current) {
      void performExportRef.current();
    }
  };

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
            <Text className="text-sm text-neutral-600 dark:text-neutral-400">
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

      {/* Re-authentication Modal for Data Export */}
      <ReAuthModal
        ref={reAuthModalRef}
        onSuccess={handleReAuthSuccess}
        title={translate('auth.security.confirm_export_title')}
        description={translate('auth.security.confirm_export_description')}
      />
    </>
  );
}
