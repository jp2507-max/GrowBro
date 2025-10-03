import * as React from 'react';

import type { StrainFilters } from '@/api/strains/types';
import { Pressable, Text, View } from '@/components/ui';
import { translate } from '@/lib/i18n';

interface FilterChipsProps {
  filters: StrainFilters;
  onClearAll: () => void;
  onRemoveFilter: (filterKey: keyof StrainFilters) => void;
  testID?: string;
}

function FilterChip({
  label,
  onRemove,
  testID,
}: {
  label: string;
  onRemove: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onRemove}
      className="flex-row items-center gap-1 rounded-full bg-primary-100 px-3 py-1 dark:bg-primary-900"
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={translate('strains.filters.removeLabel', { label })}
      accessibilityHint={translate('strains.filters.removeHint')}
    >
      <Text className="text-sm text-primary-700 dark:text-primary-300">
        {label}
      </Text>
      <Text className="text-xs text-primary-600 dark:text-primary-400">✕</Text>
    </Pressable>
  );
}

export function FilterChips({
  filters,
  onClearAll,
  onRemoveFilter,
  testID = 'filter-chips',
}: FilterChipsProps) {
  const hasFilters = Object.keys(filters).some((key) => {
    const value = filters[key as keyof StrainFilters];
    return Array.isArray(value) ? value.length > 0 : value !== undefined;
  });

  if (!hasFilters) return null;

  return (
    <View
      className="mb-3 flex-row flex-wrap items-center gap-2"
      testID={testID}
    >
      {filters.race && (
        <FilterChip
          label={translate(`strains.race.${filters.race}` as any)}
          onRemove={() => onRemoveFilter('race')}
          testID={`${testID}-race`}
        />
      )}

      {filters.difficulty && (
        <FilterChip
          label={translate(`strains.difficulty.${filters.difficulty}` as any)}
          onRemove={() => onRemoveFilter('difficulty')}
          testID={`${testID}-difficulty`}
        />
      )}

      {filters.effects && filters.effects.length > 0 && (
        <FilterChip
          label={translate('strains.filters.effects_count', {
            count: filters.effects.length,
          })}
          onRemove={() => onRemoveFilter('effects')}
          testID={`${testID}-effects`}
        />
      )}

      {filters.flavors && filters.flavors.length > 0 && (
        <FilterChip
          label={translate('strains.filters.flavors_count', {
            count: filters.flavors.length,
          })}
          onRemove={() => onRemoveFilter('flavors')}
          testID={`${testID}-flavors`}
        />
      )}

      <Pressable
        onPress={onClearAll}
        className="rounded-full border border-neutral-300 px-3 py-1 dark:border-neutral-700"
        testID={`${testID}-clear-all`}
        accessibilityRole="button"
        accessibilityLabel={translate('strains.filters.clearAllLabel')}
        accessibilityHint={translate('strains.filters.clearAllHint')}
      >
        <Text className="text-sm text-neutral-700 dark:text-neutral-300">
          {translate('strains.filters.clear_all')}
        </Text>
      </Pressable>
    </View>
  );
}
