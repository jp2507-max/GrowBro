/**
 * Batch List Component
 *
 * Displays batches with FEFO ordering and expiration status pills.
 *
 * Requirements: 2.2, 2.6
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

import { BatchListItem } from '@/components/inventory/batch-list-item';
import { Text, View } from '@/components/ui';
import type { InventoryBatchWithStatus } from '@/types/inventory';

interface BatchListProps {
  batches: InventoryBatchWithStatus[];
  itemId: string;
  testID?: string;
}

/**
 * Batch list with FEFO ordering
 */
export function BatchList({
  batches,
  itemId: _itemId,
  testID = 'batch-list',
}: BatchListProps): React.ReactElement {
  const { t } = useTranslation();

  if (batches.length === 0) {
    return (
      <View
        className="items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 p-6 dark:border-charcoal-700 dark:bg-charcoal-800"
        testID={`${testID}-empty`}
      >
        <Text className="text-sm text-neutral-600 dark:text-neutral-400">
          {t('inventory.no_batches')}
        </Text>
      </View>
    );
  }

  return (
    <View testID={testID} className="gap-2">
      {batches.map((batch) => (
        <BatchListItem key={batch.id} batch={batch} />
      ))}
    </View>
  );
}
