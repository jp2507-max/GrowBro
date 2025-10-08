import React, { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { List, Pressable, Text, View } from '@/components/ui';
import type { Harvest, HarvestStage } from '@/types';
import { HarvestStages } from '@/types';

import { HarvestHistoryEmpty } from './harvest-history-empty';

export type HarvestHistoryFilter = {
  readonly plantId?: string;
  readonly status?: 'all' | 'active' | 'completed';
  readonly query?: string;
};

export type HarvestHistoryListProps = {
  readonly harvests: Harvest[];
  readonly filters?: HarvestHistoryFilter;
  readonly isOffline?: boolean;
  readonly isLoading?: boolean;
  readonly onSelect?: (harvest: Harvest) => void;
  readonly onCreateHarvest?: () => void;
  readonly onClearFilters?: () => void;
  readonly testID?: string;
};

type HarvestListItem = {
  readonly id: string;
  readonly stage: HarvestStage;
  readonly plantName?: string;
  readonly updatedAt: Date;
  readonly dryWeight?: number;
  readonly conflictSeen: boolean;
  readonly isCompleted: boolean;
  readonly source: Harvest;
};

const STATUS_PREDICATE: Record<
  NonNullable<HarvestHistoryFilter['status']>,
  (harvest: Harvest) => boolean
> = {
  all: () => true,
  active: (harvest) => harvest.stage !== HarvestStages.INVENTORY,
  completed: (harvest) => harvest.stage === HarvestStages.INVENTORY,
};

/**
 * HarvestHistoryList component optimized for FlashList v2 performance
 * Requirements: 15.3, 15.4 (60fps on mid-tier Android)
 *
 * Performance optimizations:
 * - Memoized renderItem to prevent re-creation on every render
 * - Memoized keyExtractor callback
 * - Stable ItemSeparatorComponent reference
 * - Memoized empty component
 * - Proper data transformation pipeline
 */

export function HarvestHistoryList({
  harvests,
  filters,
  isOffline,
  isLoading,
  onSelect,
  onCreateHarvest,
  onClearFilters,
  testID = 'harvest-history-list',
}: HarvestHistoryListProps): React.ReactElement {
  const { t } = useTranslation();
  const relativeTime = useRelativeTime();

  const filtered = useMemo(
    () => applyFilters(harvests, filters),
    [harvests, filters]
  );
  const items = useMemo(() => filtered.map(mapHarvestToItem), [filtered]);

  const emptyVariant = useMemo(
    () => resolveEmptyVariant(harvests.length, items.length, isOffline),
    [harvests.length, items.length, isOffline]
  );

  const renderItem = useCallback(
    ({ item }: { item: HarvestListItem }) => (
      <HarvestHistoryRow
        item={item}
        relativeTime={relativeTime}
        onPress={onSelect}
        testID={`${testID}-item-${item.id}`}
      />
    ),
    [relativeTime, onSelect, testID]
  );

  const keyExtractor = useCallback((item: HarvestListItem) => item.id, []);

  const emptyComponent = useMemo(
    () => (
      <HarvestHistoryEmpty
        variant={emptyVariant}
        onCreateHarvest={onCreateHarvest}
        onClearFilters={onClearFilters}
        testID={`${testID}-empty`}
      />
    ),
    [emptyVariant, onCreateHarvest, onClearFilters, testID]
  );

  return (
    <List
      data={items}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      maintainVisibleContentPosition={{ autoscrollToTopThreshold: 0 }}
      accessibilityRole="list"
      accessibilityLabel={t('harvest.history.accessibility.list')}
      accessibilityHint={t('harvest.history.accessibility.listHint')}
      ListEmptyComponent={emptyComponent}
      ItemSeparatorComponent={MemoizedSeparator}
      isLoading={isLoading}
      testID={testID}
    />
  );
}

function applyFilters(
  harvests: Harvest[],
  filters?: HarvestHistoryFilter
): Harvest[] {
  if (!filters) return harvests;

  return harvests.filter((harvest) => {
    if (filters.plantId && harvest.plant_id !== filters.plantId) {
      return false;
    }

    if (filters.status && !STATUS_PREDICATE[filters.status](harvest)) {
      return false;
    }

    if (filters.query) {
      const haystack = `${harvest.notes ?? ''} ${harvest.stage}`
        .toLowerCase()
        .trim();
      if (!haystack.includes(filters.query.toLowerCase().trim())) {
        return false;
      }
    }

    return true;
  });
}

function mapHarvestToItem(harvest: Harvest): HarvestListItem {
  return {
    id: harvest.id,
    stage: harvest.stage,
    updatedAt: harvest.updated_at,
    dryWeight: harvest.dry_weight_g ?? undefined,
    conflictSeen: harvest.conflict_seen,
    isCompleted: harvest.stage === HarvestStages.INVENTORY,
    source: harvest,
  };
}

function resolveEmptyVariant(
  total: number,
  filtered: number,
  isOffline?: boolean
): 'default' | 'filtered' | 'offline' {
  if (isOffline && total === 0) {
    return 'offline';
  }
  if (total > 0 && filtered === 0) {
    return 'filtered';
  }
  return 'default';
}

type RowProps = {
  readonly item: HarvestListItem;
  readonly relativeTime: (date: Date) => string;
  readonly onPress?: (harvest: Harvest) => void;
  readonly testID?: string;
};

/**
 * Memoized row component for FlashList v2 performance
 * Prevents re-renders when scrolling through large lists
 */
const HarvestHistoryRow = memo<RowProps>(function HarvestHistoryRow({
  item,
  relativeTime,
  onPress,
  testID,
}: RowProps): React.ReactElement {
  const { t } = useTranslation();

  const handlePress = useCallback(() => {
    if (!onPress) return;

    onPress({
      ...item.source,
    });
  }, [item.source, onPress]);

  const rowLabel = useMemo(
    () =>
      `${t('harvest.history.list.rowLabel', {
        stage: t(`harvest.stages.${item.stage}`),
        time: relativeTime(item.updatedAt),
      })}${item.dryWeight != null ? t('harvest.history.list.rowLabelWeight', { weight: item.dryWeight }) : ''}${item.conflictSeen ? t('harvest.history.list.rowLabelConflict') : ''}`,
    [
      t,
      item.stage,
      item.updatedAt,
      item.dryWeight,
      item.conflictSeen,
      relativeTime,
    ]
  );

  return (
    <Pressable
      className="flex-row items-center justify-between px-4 py-3"
      accessibilityRole="button"
      accessibilityLabel={rowLabel}
      accessibilityHint={t('harvest.history.accessibility.rowHint')}
      testID={testID}
      onPress={handlePress}
    >
      <View className="flex-1 pr-3">
        <Text className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
          {t(`harvest.stages.${item.stage}`)}
        </Text>
        <Text className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
          {t('harvest.history.list.updated', {
            relativeTime: relativeTime(item.updatedAt),
          })}
        </Text>
      </View>
      <View className="items-end">
        {item.dryWeight != null ? (
          <Text className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
            {t('harvest.history.list.weight', { weight: item.dryWeight })}
          </Text>
        ) : null}
        {item.conflictSeen ? (
          <View className="mt-2 rounded-full bg-warning-100 px-2 py-1">
            <Text className="text-xs font-semibold text-warning-700">
              {t('harvest.history.list.conflict_badge')}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
});

/**
 * Memoized separator component for stable reference in FlashList
 */
const Separator = memo(function Separator(): React.ReactElement {
  return <View className="h-px bg-neutral-200 dark:bg-neutral-700" />;
});

const MemoizedSeparator = Separator;

function useRelativeTime(): (date: Date) => string {
  const { t } = useTranslation();

  return React.useCallback(
    (date: Date) => {
      const diff = Date.now() - date.getTime();

      if (diff < 60_000) {
        return t('harvest.history.relative.now');
      }

      const minutes = Math.floor(diff / 60_000);
      if (minutes < 60) {
        return t('harvest.history.relative.minutes', { count: minutes });
      }

      const hours = Math.floor(minutes / 60);
      if (hours < 24) {
        return t('harvest.history.relative.hours', { count: hours });
      }

      const days = Math.floor(hours / 24);
      return t('harvest.history.relative.days', { count: days });
    },
    [t]
  );
}
