/**
 * Add Batch Screen
 *
 * Create new inventory batch with lot number, expiration date, and cost.
 * Deep linking planned — not yet functional; requires form and routing
 * implementation (e.g., deep link growbro://inventory/items/:id/batches/new)
 *
 * Requirements: 2.1
 */

// import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { FocusAwareStatusBar, Text, View } from '@/components/ui';

export default function AddBatchScreen(): React.ReactElement {
  const { t } = useTranslation();
  // TODO: Implement batch form once AddBatchForm component is available
  // const router = useRouter();
  // const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <View
      className="flex-1 bg-neutral-50 dark:bg-charcoal-950"
      testID="add-batch-screen"
    >
      <FocusAwareStatusBar />
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-center text-lg font-semibold text-charcoal-900 dark:text-neutral-100">
          {t('inventory.add_batch')}
        </Text>
        <Text className="mt-2 text-center text-sm text-neutral-600 dark:text-neutral-400">
          {t('inventory.add_batch_description')}
        </Text>
        {/* AddBatchForm component will be implemented in future tasks */}
      </View>
    </View>
  );
}
