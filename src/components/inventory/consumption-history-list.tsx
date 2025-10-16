/**
 * Consumption History List Component
 *
 * Filterable list displaying consumption history entries with
 * cost details and task linkage.
 *
 * Requirements:
 * - 6.1: Display consumption entries with dates, quantities, tasks, costs
 * - 9.4: Display quantity and cost with preserved batch valuation
 */

import { FlashList } from '@shopify/flash-list';
import { DateTime } from 'luxon';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Text, View } from '@/components/ui';
import type { ConsumptionHistoryEntry } from '@/lib/inventory/consumption-history';
import { formatCost } from '@/lib/inventory/cost-analysis-service';

type ConsumptionHistoryListProps = {
  entries: ConsumptionHistoryEntry[];
  onEntryPress?: (entry: ConsumptionHistoryEntry) => void;
  testID?: string;
};

type ListEntry = {
  type: 'entry';
  data: ConsumptionHistoryEntry;
};

/**
 * Renders a single consumption history entry
 */
const ConsumptionHistoryItem = ({
  entry,
  onPress,
}: {
  entry: ConsumptionHistoryEntry;
  onPress?: (entry: ConsumptionHistoryEntry) => void;
}) => {
  const { t } = useTranslation();

  const formattedDate = useMemo(() => {
    return DateTime.fromJSDate(entry.createdAt).toFormat('MMM dd, yyyy HH:mm');
  }, [entry.createdAt]);

  return (
    <View
      className="border-b border-neutral-200 bg-white p-4 dark:border-charcoal-800 dark:bg-charcoal-950"
      testID={`consumption-history-item-${entry.id}`}
      onTouchEnd={() => onPress?.(entry)}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="font-inter-semibold text-base text-charcoal-900 dark:text-neutral-100">
            {entry.itemName}
          </Text>
          <Text className="mt-1 text-sm text-charcoal-600 dark:text-neutral-400">
            {entry.quantity.toFixed(2)} {entry.unit}
          </Text>
        </View>

        <View className="items-end">
          <Text className="font-inter-bold text-base text-charcoal-900 dark:text-neutral-100">
            {formatCost(entry.totalCostMinor)}
          </Text>
          <Text className="mt-1 text-xs text-charcoal-600 dark:text-neutral-400">
            {formatCost(entry.costPerUnitMinor)}/{entry.unit}
          </Text>
        </View>
      </View>

      <View className="mt-2 flex-row items-center gap-2">
        <View
          className={`rounded-full px-2 py-1 ${
            entry.type === 'consumption'
              ? 'dark:bg-primary-950 bg-primary-100'
              : 'dark:bg-warning-950 bg-warning-100'
          }`}
        >
          <Text
            className={`font-inter-medium text-xs ${
              entry.type === 'consumption'
                ? 'text-primary-800 dark:text-primary-200'
                : 'text-warning-800 dark:text-warning-200'
            }`}
          >
            {entry.type === 'consumption'
              ? t('inventory.history.consumption')
              : t('inventory.history.adjustment')}
          </Text>
        </View>

        {entry.taskId && (
          <View className="dark:bg-success-950 rounded-full bg-success-100 px-2 py-1">
            <Text className="font-inter-medium text-xs text-success-800 dark:text-success-200">
              {t('inventory.history.linkedToTask')}
            </Text>
          </View>
        )}
      </View>

      <Text className="mt-2 text-xs italic text-charcoal-600 dark:text-neutral-400">
        {entry.reason}
      </Text>

      <Text className="mt-1 text-xs text-charcoal-500 dark:text-neutral-500">
        {formattedDate}
      </Text>
    </View>
  );
};

/**
 * List component displaying consumption history with cost details
 *
 * @example
 * ```tsx
 * <ConsumptionHistoryList
 *   entries={history}
 *   onEntryPress={(entry) => console.log(entry)}
 * />
 * ```
 */
export const ConsumptionHistoryList = ({
  entries,
  onEntryPress,
  testID = 'consumption-history-list',
}: ConsumptionHistoryListProps) => {
  const { t } = useTranslation();

  const listData = useMemo<ListEntry[]>(() => {
    return entries.map((entry) => ({
      type: 'entry' as const,
      data: entry,
    }));
  }, [entries]);

  const renderItem = ({ item }: { item: ListEntry }) => {
    return <ConsumptionHistoryItem entry={item.data} onPress={onEntryPress} />;
  };

  const getItemType = (item: ListEntry) => {
    return item.type;
  };

  if (entries.length === 0) {
    return (
      <View
        className="flex-1 items-center justify-center p-8"
        testID={`${testID}-empty`}
      >
        <Text className="text-center text-sm text-charcoal-600 dark:text-neutral-400">
          {t('inventory.history.noEntries')}
        </Text>
      </View>
    );
  }

  return (
    <FlashList
      data={listData}
      renderItem={renderItem}
      getItemType={getItemType}
      testID={testID}
      keyExtractor={(item) => item.data.id}
    />
  );
};
