/**
 * Harvest Modal Route
 *
 * Native modal screen for recording harvest data. Uses Expo Router's native
 * modal presentation for swipe-to-dismiss behavior on iOS.
 *
 * Route params:
 * - plantId: string (required) - The plant to create a harvest for
 */

import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  HarvestForm,
  type HarvestFormSubmitData,
} from '@/components/harvest/harvest-form';
import { View } from '@/components/ui';
import { translate } from '@/lib';

export default function HarvestModalScreen(): React.ReactElement {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ plantId: string }>();
  const insets = useSafeAreaInsets();
  const plantId = params.plantId;

  // Validate required params
  React.useEffect(() => {
    if (!plantId) {
      console.warn('[HarvestModalScreen] Missing required plantId param');
      router.back();
    }
  }, [plantId, router]);

  const handleSubmit = React.useCallback(
    (_data: HarvestFormSubmitData) => {
      // The form handles the actual creation - we just need to close the modal
      router.back();
    },
    [router]
  );

  const handleCancel = React.useCallback(() => {
    router.back();
  }, [router]);

  if (!plantId) {
    return <View className="flex-1" />;
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: translate('harvest.modal.title'),
          presentation: 'modal',
          headerShown: true,
          headerBackTitle: t('common.cancel'),
        }}
      />
      <View
        className="flex-1 bg-neutral-50 dark:bg-charcoal-950"
        style={{ paddingBottom: insets.bottom }}
      >
        <HarvestForm
          plantId={plantId}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </View>
    </>
  );
}
