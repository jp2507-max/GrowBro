import { Link } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { Button, ScrollView, Text, View } from '@/components/ui';
import { translate } from '@/lib';
import {
  requestDataExport,
  requestDeletionViaWeb,
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

function useWebPortalExport(): {
  queueExport: () => void;
  isExporting: boolean;
} {
  const [isExporting, setIsExporting] = useState(false);

  const queueExport = useCallback(() => {
    if (isExporting) return;
    setIsExporting(true);
    (async () => {
      try {
        const result = await requestDataExport();
        const eta = formatEta(result.estimatedCompletion);
        Alert.alert(
          translate('privacy.export_queued_title'),
          eta
            ? translate('privacy.export_queued_body', { eta })
            : translate('privacy.export_queued_body_no_eta')
        );
      } catch (error) {
        Alert.alert(
          translate('privacy.export_error_title'),
          translate('privacy.export_error_body', {
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

function useWebPortalDeletion(): {
  queueDeletion: () => void;
  isDeleting: boolean;
} {
  const [isDeleting, setIsDeleting] = useState(false);

  const queueDeletion = useCallback(() => {
    if (isDeleting) return;
    setIsDeleting(true);
    (async () => {
      try {
        const result = await requestDeletionViaWeb();
        const eta = formatEta(result.estimatedCompletion);
        Alert.alert(
          translate('privacy.delete_account_queued_title'),
          eta
            ? translate('privacy.delete_account_queued_body', { eta })
            : translate('privacy.delete_account_queued_body_no_eta')
        );
      } catch (error) {
        Alert.alert(
          translate('privacy.delete_account_error_title'),
          translate('privacy.delete_account_error_body', {
            message: extractErrorMessage(error),
          })
        );
      } finally {
        setIsDeleting(false);
      }
    })();
  }, [isDeleting]);

  return { queueDeletion, isDeleting };
}

function PortalIntro(): React.ReactElement {
  return (
    <View className="gap-2">
      <Text className="text-2xl font-bold">
        {translate('privacy.web_portal_title')}
      </Text>
      <Text className="text-base text-charcoal-700">
        {translate('privacy.web_portal_intro')}
      </Text>
      <Text className="text-sm text-charcoal-600">
        {translate('privacy.web_portal_auth_note')}
      </Text>
      <Link href="/login" asChild>
        <Button label={translate('privacy.web_portal_login')} />
      </Link>
    </View>
  );
}

function DeletionSection({
  onPress,
}: {
  onPress: () => void;
}): React.ReactElement {
  return (
    <View className="gap-3 rounded-lg bg-neutral-100 p-4">
      <Text className="text-lg font-semibold">
        {translate('privacy.web_portal_deletion_heading')}
      </Text>
      <Text className="text-sm text-charcoal-700">
        {translate('privacy.web_portal_deletion_copy')}
      </Text>
      <Button
        label={translate('privacy.web_portal_deletion_cta')}
        onPress={onPress}
      />
    </View>
  );
}

function ExportSection({
  onPress,
}: {
  onPress: () => void;
}): React.ReactElement {
  return (
    <View className="gap-3 rounded-lg bg-neutral-100 p-4">
      <Text className="text-lg font-semibold">
        {translate('privacy.web_portal_export_heading')}
      </Text>
      <Text className="text-sm text-charcoal-700">
        {translate('privacy.web_portal_export_copy')}
      </Text>
      <Button
        label={translate('privacy.web_portal_export_cta')}
        onPress={onPress}
      />
    </View>
  );
}

export default function DeleteAccountPortal(): React.ReactElement {
  const { queueExport } = useWebPortalExport();
  const { queueDeletion } = useWebPortalDeletion();

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic">
      <View className="mx-auto w-full max-w-3xl gap-6 px-6 py-16">
        <PortalIntro />
        <DeletionSection onPress={queueDeletion} />
        <ExportSection onPress={queueExport} />
      </View>
    </ScrollView>
  );
}
