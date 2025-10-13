import { FlashList } from '@shopify/flash-list';
import React, { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Pressable, Text, View } from '@/components/ui';
import type { PhEcReading, QualityFlag } from '@/lib/nutrient-engine/types';
import { QualityFlag as QualityFlagEnum } from '@/lib/nutrient-engine/types';
import {
  ecToPpm,
  formatPpmWithScale,
} from '@/lib/nutrient-engine/utils/conversions';

export type PhEcReadingListProps = {
  readonly readings: PhEcReading[];
  readonly isLoading?: boolean;
  readonly onSelect?: (reading: PhEcReading) => void;
  readonly testID?: string;
};

type ReadingListItem = {
  readonly id: string;
  readonly ph: number;
  readonly ec25c: number;
  readonly tempC: number;
  readonly ppmScale: string;
  readonly qualityFlags: QualityFlag[];
  readonly measuredAt: number;
  readonly note?: string;
  readonly source: PhEcReading;
};

/**
 * PhEcReadingList component optimized for FlashList performance
 * Requirements: 2.1, 2.5, 6.2
 *
 * Performance optimizations:
 * - Memoized renderItem to prevent re-creation on every render
 * - Memoized keyExtractor callback
 * - Proper getItemType for heterogeneous cells
 * - Stable ItemSeparatorComponent reference
 * - Test performance in release mode
 */

export function PhEcReadingList({
  readings,
  isLoading = false,
  onSelect,
  testID = 'ph-ec-reading-list',
}: PhEcReadingListProps): React.ReactElement {
  const { t } = useTranslation();

  const items = useMemo(
    () =>
      readings.map(
        (reading): ReadingListItem => ({
          id: reading.id,
          ph: reading.ph,
          ec25c: reading.ec25c,
          tempC: reading.tempC,
          ppmScale: reading.ppmScale,
          qualityFlags: reading.qualityFlags || [],
          measuredAt: reading.measuredAt,
          note: reading.note,
          source: reading,
        })
      ),
    [readings]
  );

  const keyExtractor = useCallback((item: ReadingListItem) => item.id, []);

  const renderItem = useCallback(
    ({ item }: { item: ReadingListItem }) => (
      <ReadingListItemComponent item={item} onSelect={onSelect} />
    ),
    [onSelect]
  );

  // Heterogeneous cell types based on quality flags
  const getItemType = useCallback((item: ReadingListItem) => {
    if (item.qualityFlags.length > 0) {
      return 'reading-with-flags';
    }
    return 'reading-normal';
  }, []);

  const ItemSeparatorComponent = useCallback(
    () => <View className="h-px bg-neutral-200" />,
    []
  );

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center p-4">
        <Text className="text-neutral-500">
          {t('nutrient.loading_readings')}
        </Text>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View className="flex-1 items-center justify-center p-4" testID={testID}>
        <Text className="text-center text-lg text-neutral-700">
          {t('nutrient.no_readings')}
        </Text>
        <Text className="mt-2 text-center text-sm text-neutral-500">
          {t('nutrient.add_first_reading')}
        </Text>
      </View>
    );
  }

  return (
    <FlashList
      data={items}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemType={getItemType}
      ItemSeparatorComponent={ItemSeparatorComponent}
      testID={testID}
    />
  );
}

// ============================================================================
// List Item Component
// ============================================================================

type ReadingListItemProps = {
  readonly item: ReadingListItem;
  readonly onSelect?: (reading: PhEcReading) => void;
};

// Subcomponents split from ReadingListItemComponent to adhere to modularity
// guideline (~80 lines per component). Each subcomponent owns its
// translations and utility calls and is memoized for performance.

type MeasurementDisplayProps = {
  readonly item: ReadingListItem;
};

const MeasurementDisplay = memo(function MeasurementDisplay({
  item,
}: MeasurementDisplayProps) {
  const { t } = useTranslation();

  const dateStr = useMemo(
    () => new Date(item.measuredAt).toLocaleString(),
    [item.measuredAt]
  );

  const ppmDisplay = useMemo(() => {
    const ppm = ecToPpm(item.ec25c, item.ppmScale as '500' | '700');
    return formatPpmWithScale(ppm, item.ppmScale as '500' | '700');
  }, [item.ec25c, item.ppmScale]);

  return (
    <>
      <View className="flex-row items-baseline gap-3">
        <View>
          <Text className="text-xs text-neutral-500">{t('nutrient.ph')}</Text>
          <Text className="text-lg font-semibold text-neutral-900">
            {item.ph.toFixed(2)}
          </Text>
        </View>

        <View>
          <Text className="text-xs text-neutral-500">
            {t('nutrient.ec_at_temp', { temp: item.tempC.toFixed(1) })}
          </Text>
          <Text className="text-lg font-semibold text-neutral-900">
            {item.ec25c.toFixed(2)} {t('units.ms_per_cm')}
          </Text>
        </View>

        <View>
          <Text className="text-xs text-neutral-500">{t('nutrient.ppm')}</Text>
          <Text className="text-sm font-medium text-neutral-700">
            {ppmDisplay}
          </Text>
        </View>
      </View>

      <Text className="mt-2 text-xs text-neutral-500">{dateStr}</Text>

      {item.note && (
        <Text className="mt-1 text-sm text-neutral-600" numberOfLines={2}>
          {item.note}
        </Text>
      )}
    </>
  );
});
MeasurementDisplay.displayName = 'MeasurementDisplay';

type QualityIndicatorProps = {
  readonly item: ReadingListItem;
};

const QualityIndicator = memo(function QualityIndicator({
  item,
}: QualityIndicatorProps) {
  const { t } = useTranslation();

  const hasQualityFlags = item.qualityFlags.length > 0;

  return (
    <>
      <Text className="text-xs text-neutral-500">
        {item.tempC.toFixed(1)}
        {t('units.celsius')}
      </Text>

      {hasQualityFlags && (
        <View className="mt-1 rounded bg-warning-100 px-2 py-1">
          <Text className="text-xs text-warning-700">⚠️</Text>
        </View>
      )}
    </>
  );
});
QualityIndicator.displayName = 'QualityIndicator';

type QualityFlagDetailsProps = {
  readonly qualityFlags: QualityFlag[];
};

const QualityFlagDetails = memo(function QualityFlagDetails({
  qualityFlags,
}: QualityFlagDetailsProps) {
  const { t } = useTranslation();

  if (qualityFlags.length === 0) return null;

  return (
    <View className="mt-2 gap-1">
      {qualityFlags.includes(QualityFlagEnum.NO_ATC) && (
        <Text className="text-xs text-warning-700">
          • {t('nutrient.no_atc_warning')}
        </Text>
      )}
      {qualityFlags.includes(QualityFlagEnum.TEMP_HIGH) && (
        <Text className="text-xs text-warning-700">
          • {t('nutrient.temp_high_warning')}
        </Text>
      )}
      {qualityFlags.includes(QualityFlagEnum.CAL_STALE) && (
        <Text className="text-xs text-warning-700">
          • {t('nutrient.cal_stale_warning')}
        </Text>
      )}
    </View>
  );
});
QualityFlagDetails.displayName = 'QualityFlagDetails';

const ReadingListItemComponent = memo(function ReadingListItemComponent({
  item,
  onSelect,
}: ReadingListItemProps) {
  const handlePress = useCallback(() => {
    onSelect?.(item.source);
  }, [item.source, onSelect]);

  const hasQualityFlags = item.qualityFlags.length > 0;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={handlePress}
      className="bg-white p-4"
      testID={`reading-item-${item.id}`}
    >
      <View className="flex-row items-start justify-between">
        {/* Left: Measurements */}
        <View className="flex-1">
          <MeasurementDisplay item={item} />
        </View>

        {/* Right: Quality indicators */}
        <View className="ml-2">
          <QualityIndicator item={item} />
        </View>
      </View>

      {/* Quality flags details */}
      {hasQualityFlags && (
        <QualityFlagDetails qualityFlags={item.qualityFlags} />
      )}
    </Pressable>
  );
});

ReadingListItemComponent.displayName = 'ReadingListItemComponent';
