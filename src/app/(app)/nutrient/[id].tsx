import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView } from 'react-native';
import { showMessage } from 'react-native-flash-message';

import {
  AccessDeniedError,
  useFetchReading,
  useUpdateReading,
} from '@/api/ph-ec-readings';
import { useFetchReservoirs } from '@/api/reservoirs';
import { PhEcReadingForm } from '@/components/nutrient/ph-ec-reading-form';
import { Text, View } from '@/components/ui';
import type { PpmScale } from '@/lib/nutrient-engine/types';

// Error handling component for reading detail screen
function ReadingDetailError({ error }: { error: AccessDeniedError | Error }) {
  const { t } = useTranslation();

  if (error instanceof AccessDeniedError) {
    return (
      <View
        testID="reading-detail-access-denied"
        className="flex-1 items-center justify-center bg-white p-4 dark:bg-charcoal-950"
      >
        <Text className="text-center text-neutral-600">
          {t('nutrient.access_denied')}
        </Text>
      </View>
    );
  }

  return (
    <View
      testID="reading-detail-error"
      className="flex-1 items-center justify-center bg-white p-4 dark:bg-charcoal-950"
    >
      <Text className="text-center text-neutral-600">
        {t('nutrient.error_loading_reading')}
      </Text>
    </View>
  );
}

// Loading component
function ReadingDetailLoading() {
  return (
    <View
      testID="reading-detail-loading"
      className="flex-1 items-center justify-center bg-white dark:bg-charcoal-950"
    >
      <ActivityIndicator size="large" />
    </View>
  );
}

// Not found component
function ReadingDetailNotFound() {
  const { t } = useTranslation();

  return (
    <View
      testID="reading-detail-not-found"
      className="flex-1 items-center justify-center bg-white p-4 dark:bg-charcoal-950"
    >
      <Text className="text-center text-neutral-600">
        {t('nutrient.reading_not_found')}
      </Text>
    </View>
  );
}

export default function ReadingDetailScreen(): React.ReactElement {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const updateReading = useUpdateReading();

  // Fetch existing reading
  const { data: reading, isLoading, error: _error } = useFetchReading(id!);
  const { data: reservoirsData } = useFetchReservoirs();

  const handleSubmit = useCallback(
    async (data: {
      ph: number;
      ecRaw: number;
      ec25c: number;
      tempC: number;
      atcOn: boolean;
      ppmScale: string;
      reservoirId?: string;
      plantId?: string;
      meterId?: string;
      note?: string;
    }) => {
      if (!id) return;

      try {
        await updateReading.mutateAsync({
          id,
          ph: data.ph,
          ecRaw: data.ecRaw,
          ec25c: data.ec25c,
          tempC: data.tempC,
          atcOn: data.atcOn,
          ppmScale: data.ppmScale as PpmScale,
          reservoirId: data.reservoirId,
          plantId: data.plantId,
          meterId: data.meterId,
          note: data.note,
        });

        showMessage({
          message: t('nutrient.reading_updated'),
          type: 'success',
          duration: 3000,
        });

        router.back();
      } catch (error) {
        console.error('Failed to update reading:', error);

        showMessage({
          message: t('nutrient.reading_update_error'),
          type: 'danger',
          duration: 4000,
        });
      }
    },
    [updateReading, router, t, id]
  );

  const defaultValues = useMemo(() => {
    if (!reading) return undefined;
    return {
      ph: reading.ph,
      ecRaw: reading.ecRaw,
      ec25c: reading.ec25c,
      tempC: reading.tempC,
      atcOn: reading.atcOn,
      ppmScale: reading.ppmScale,
      reservoirId: reading.reservoirId,
      plantId: reading.plantId,
      meterId: reading.meterId,
      note: reading.note,
    };
  }, [reading]);

  if (isLoading) {
    return <ReadingDetailLoading />;
  }

  if (_error) {
    return <ReadingDetailError error={_error} />;
  }

  if (!reading) {
    return <ReadingDetailNotFound />;
  }

  return (
    <View
      testID="reading-detail-screen"
      className="flex-1 bg-white dark:bg-charcoal-950"
    >
      <ScrollView
        testID="reading-detail-scroll"
        className="flex-1"
        contentContainerClassName="p-4"
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-4">
          <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-50">
            {t('nutrient.edit_reading')}
          </Text>
        </View>

        <PhEcReadingForm
          onSubmit={handleSubmit}
          isSubmitting={updateReading.isPending}
          defaultValues={defaultValues}
          reservoirs={reservoirsData?.data || []}
        />
      </ScrollView>
    </View>
  );
}
