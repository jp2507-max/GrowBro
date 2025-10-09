import React from 'react';

import { Button, Text, View } from '@/components/ui';
import { translate } from '@/lib/i18n';

type EmptyVariant = 'default' | 'filtered' | 'offline';

type Props = {
  readonly variant?: EmptyVariant;
  readonly onCreateHarvest?: () => void;
  readonly onClearFilters?: () => void;
  readonly testID?: string;
};

const VARIANT_KEYS: Record<EmptyVariant, { title: string; body: string }> = {
  default: {
    title: 'harvest.history.empty.default.title',
    body: 'harvest.history.empty.default.body',
  },
  filtered: {
    title: 'harvest.history.empty.filtered.title',
    body: 'harvest.history.empty.filtered.body',
  },
  offline: {
    title: 'harvest.history.empty.offline.title',
    body: 'harvest.history.empty.offline.body',
  },
};

export function HarvestHistoryEmpty({
  variant = 'default',
  onCreateHarvest,
  onClearFilters,
  testID,
}: Props): React.ReactElement {
  const copy = VARIANT_KEYS[variant];

  return (
    <View
      className="flex-1 items-center justify-center gap-4 px-6 py-12"
      accessibilityRole="summary"
      accessibilityLabel={translate('harvest.history.accessibility.summary')}
      accessibilityHint={translate('harvest.history.accessibility.summaryHint')}
      testID={testID}
    >
      <Text className="text-center text-lg font-semibold text-neutral-900 dark:text-neutral-50">
        {translate(copy.title as any)}
      </Text>
      <Text className="text-center text-base text-neutral-600 dark:text-neutral-300">
        {translate(copy.body as any)}
      </Text>

      {variant !== 'offline' && onCreateHarvest ? (
        <Button
          label={translate('harvest.history.actions.create')}
          onPress={onCreateHarvest}
          testID={testID ? `${testID}-create` : undefined}
          accessibilityLabel={translate(
            'harvest.history.accessibility.emptyCreate'
          )}
          accessibilityHint={translate(
            'harvest.history.accessibility.emptyCreateHint'
          )}
        />
      ) : null}

      {variant === 'filtered' && onClearFilters ? (
        <Button
          className="mt-2"
          label={translate('harvest.history.actions.clearFilters')}
          onPress={onClearFilters}
          variant="outline"
          testID={testID ? `${testID}-clear-filters` : undefined}
        />
      ) : null}
    </View>
  );
}
