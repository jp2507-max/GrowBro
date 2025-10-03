import * as React from 'react';

import type { Terpene } from '@/api';
import { Text, View } from '@/components/ui';
import { translate } from '@/lib';

type Props = {
  terpenes: Terpene[];
  testID?: string;
};

export const TerpeneSection = React.memo<Props>(({ terpenes, testID }) => {
  const sortedTerpenes = React.useMemo(() => {
    return [...terpenes]
      .filter((t) => t.percentage !== undefined)
      .sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0))
      .slice(0, 5); // Show top 5
  }, [terpenes]);

  if (sortedTerpenes.length === 0) {
    return null;
  }

  const maxPercentage = Math.max(
    ...sortedTerpenes.map((t) => t.percentage ?? 0)
  );

  return (
    <View
      className="mx-4 mb-4 rounded-2xl bg-white p-4 dark:bg-neutral-900"
      testID={testID}
    >
      <Text className="mb-3 text-base font-semibold text-neutral-900 dark:text-neutral-100">
        {translate('strains.detail.terpenes')}
      </Text>
      <Text className="mb-4 text-xs text-neutral-600 dark:text-neutral-400">
        {translate('strains.detail.terpenes_description')}
      </Text>

      <View className="gap-3">
        {sortedTerpenes.map((terpene, index) => {
          const widthPercentage =
            ((terpene.percentage ?? 0) / maxPercentage) * 100;

          return (
            <View key={index}>
              <View className="mb-1 flex-row items-baseline justify-between">
                <Text className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                  {terpene.name}
                </Text>
                <Text className="text-xs text-neutral-600 dark:text-neutral-400">
                  {terpene.percentage?.toFixed(2)}%
                </Text>
              </View>
              <View className="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                <View
                  className="h-full rounded-full bg-primary-600"
                  style={{ width: `${widthPercentage}%` }}
                />
              </View>
              {terpene.aroma_description ? (
                <Text className="mt-1 text-xs text-neutral-600 dark:text-neutral-400">
                  {terpene.aroma_description}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
});

TerpeneSection.displayName = 'TerpeneSection';
