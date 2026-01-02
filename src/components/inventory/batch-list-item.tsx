/**
 * Batch List Item Component
 *
 * Displays batch information with expiration status and FEFO indicators.
 *
 * Requirements: 2.2, 2.6
 */

import { DateTime } from 'luxon';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Text, View } from '@/components/ui';
import type { InventoryBatchWithStatus } from '@/types/inventory';

interface BatchListItemProps {
  batch: InventoryBatchWithStatus;
}

/**
 * Expiration status pill
 */
function ExpiryStatusPill({
  isExpired,
  daysToExpiry,
}: {
  isExpired: boolean;
  daysToExpiry?: number;
}): React.ReactElement {
  const { t } = useTranslation();

  if (isExpired) {
    return (
      <View className="rounded-full bg-danger-100 px-2 py-1 dark:bg-danger-900/30">
        <Text className="text-xs font-medium text-danger-700 dark:text-danger-400">
          {t('inventory.expired')}
        </Text>
      </View>
    );
  }

  if (daysToExpiry !== undefined && daysToExpiry <= 30) {
    return (
      <View className="rounded-full bg-warning-100 px-2 py-1 dark:bg-warning-900/30">
        <Text className="text-xs font-medium text-warning-700 dark:text-warning-400">
          {t('inventory.expires_in', { days: daysToExpiry })}
        </Text>
      </View>
    );
  }

  return <View />;
}

/**
 * Batch list item component
 */
export function BatchListItem({
  batch,
}: BatchListItemProps): React.ReactElement {
  const { t } = useTranslation();

  const formattedDate = batch.expiresOn
    ? DateTime.fromJSDate(batch.expiresOn).toFormat('MMM dd, yyyy')
    : null;

  return (
    <View
      className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-charcoal-700 dark:bg-charcoal-900"
      testID={`batch-item-${batch.id}`}
    >
      <View className="flex-row items-start justify-between">
        {/* Left: Lot number and quantity */}
        <View className="flex-1">
          <Text className="text-base font-semibold text-charcoal-900 dark:text-neutral-100">
            {t('inventory.batch_lot', { lot: batch.lotNumber })}
          </Text>
          <Text className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {t('inventory.batch_quantity_cost', {
              quantity: batch.quantity,
              costPerUnit: (batch.costPerUnitMinor / 100).toFixed(2),
            })}
          </Text>
          {formattedDate && (
            <Text className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
              {t('inventory.expires_on', { date: formattedDate })}
            </Text>
          )}
        </View>

        {/* Right: Expiry status */}
        <ExpiryStatusPill
          isExpired={batch.isExpired}
          daysToExpiry={batch.daysToExpiry}
        />
      </View>
    </View>
  );
}
