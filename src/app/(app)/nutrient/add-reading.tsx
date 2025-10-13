import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { showMessage } from 'react-native-flash-message';

import { useCreateReading } from '@/api/ph-ec-readings';
import { PhEcReadingForm } from '@/components/nutrient/ph-ec-reading-form';
import { SafeAreaView, Text, View } from '@/components/ui';
import type { PpmScale } from '@/lib/nutrient-engine/types';

/**
 * Add Reading Screen
 *
 * Allows users to manually log pH/EC measurements
 * Requirements: 2.1, 2.2, 2.7
 */

export default function AddReadingScreen(): React.ReactElement {
  const { t } = useTranslation();
  const router = useRouter();
  const createReading = useCreateReading();
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setIsSubmitting(true);

      try {
        await createReading.mutateAsync({
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
          message: t('nutrient.reading_saved'),
          type: 'success',
          duration: 3000,
        });

        // Navigate back to reading list
        router.back();
      } catch (error) {
        console.error('Failed to save reading:', error);

        showMessage({
          message: t('nutrient.reading_error'),
          type: 'danger',
          duration: 4000,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [createReading, router, t]
  );

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4"
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-4">
          <Text className="text-2xl font-bold text-neutral-900">
            {t('nutrient.add_reading')}
          </Text>
          <Text className="mt-1 text-sm text-neutral-600">
            {t('nutrient.add_reading_description')}
          </Text>
        </View>

        <PhEcReadingForm
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          // TODO: Pass reservoirs from query once reservoir management is implemented
          reservoirs={[]}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
