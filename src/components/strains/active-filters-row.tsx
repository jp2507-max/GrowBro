import { useColorScheme } from 'nativewind';
import React from 'react';

import type { StrainFilters } from '@/api/strains/types';
import { Pressable, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { X } from '@/components/ui/icons';
import { translate } from '@/lib';
import { haptics } from '@/lib/haptics';
import { hasActiveFilters } from '@/lib/strains/filter-utils';

type Props = {
  filters: StrainFilters;
  onFilterChange: (filters: StrainFilters) => void;
};

const CHIP_STYLE =
  'flex-row items-center gap-1.5 rounded-full bg-neutral-900 dark:bg-white px-3 py-1.5';
const CHIP_TEXT_STYLE = 'text-sm font-medium text-white dark:text-neutral-900';

type FilterChipProps = {
  label: string;
  onClear: () => void;
  testID: string;
  iconColor: string;
};

function FilterChip({
  label,
  onClear,
  testID,
  iconColor,
}: FilterChipProps): React.ReactElement {
  const handlePress = () => {
    haptics.selection();
    onClear();
  };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={handlePress}
      className={CHIP_STYLE}
      testID={testID}
    >
      <Text className={CHIP_TEXT_STYLE}>{label}</Text>
      <X width={14} height={14} color={iconColor} />
    </Pressable>
  );
}

export function ActiveFiltersRow({
  filters,
  onFilterChange,
}: Props): React.ReactElement | null {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const iconColor = isDark ? colors.neutral[900] : colors.white;

  const hasFilters = hasActiveFilters(filters);

  if (!hasFilters) {
    return null;
  }

  return (
    <View className="flex-row flex-wrap gap-2 pb-3">
      {filters.race && (
        <FilterChip
          label={translate(`strains.race.${filters.race}`)}
          onClear={() => onFilterChange({ ...filters, race: undefined })}
          testID="active-filter-race"
          iconColor={iconColor}
        />
      )}
      {filters.difficulty && (
        <FilterChip
          label={translate(`strains.difficulty.${filters.difficulty}`)}
          onClear={() => onFilterChange({ ...filters, difficulty: undefined })}
          testID="active-filter-difficulty"
          iconColor={iconColor}
        />
      )}
      {(filters.effects?.length ?? 0) > 0 && (
        <FilterChip
          label={translate('strains.filters.effects_count', {
            count: filters.effects!.length,
          })}
          onClear={() => onFilterChange({ ...filters, effects: [] })}
          testID="active-filter-effects"
          iconColor={iconColor}
        />
      )}
      {(filters.flavors?.length ?? 0) > 0 && (
        <FilterChip
          label={translate('strains.filters.flavors_count', {
            count: filters.flavors!.length,
          })}
          onClear={() => onFilterChange({ ...filters, flavors: [] })}
          testID="active-filter-flavors"
          iconColor={iconColor}
        />
      )}
    </View>
  );
}
