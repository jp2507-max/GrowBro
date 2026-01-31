import * as React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Pressable, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { translate } from '@/lib';
import { haptics } from '@/lib/haptics';

export type RaceFilterValue =
  | 'all'
  | 'indica'
  | 'sativa'
  | 'hybrid'
  | 'highCbd';

type RaceFilterChipsProps = {
  value: RaceFilterValue;
  onChange: (value: RaceFilterValue) => void;
  testID?: string;
};

const CHIP_LABELS: Record<RaceFilterValue, string> = {
  all: 'All',
  indica: 'Indica',
  sativa: 'Sativa',
  hybrid: 'Hybrid',
  highCbd: 'High CBD',
};

const CHIPS: RaceFilterValue[] = [
  'all',
  'indica',
  'sativa',
  'hybrid',
  'highCbd',
];

type FilterChipProps = {
  label: string;
  isActive: boolean;
  onPress: () => void;
  testID?: string;
};

const FilterChip = React.memo<FilterChipProps>(
  ({ label, isActive, onPress, testID }) => {
    return (
      <Pressable
        onPress={onPress}
        testID={testID}
        accessibilityRole="tab"
        accessibilityState={{ selected: isActive }}
        accessibilityLabel={label}
        accessibilityHint={
          isActive ? undefined : translate('strains.filters.tap_to_filter')
        }
        className="shrink-0"
      >
        <View
          style={[
            styles.chip,
            isActive ? styles.chipActive : styles.chipInactive,
          ]}
          className="h-10 items-center justify-center rounded-full px-6"
        >
          <Text
            style={isActive ? styles.chipTextActive : styles.chipTextInactive}
            className="text-sm font-medium tracking-wide"
          >
            {label}
          </Text>
        </View>
      </Pressable>
    );
  }
);
FilterChip.displayName = 'FilterChip';

/**
 * Horizontal scrolling race filter chips for quick strain filtering.
 * Matches the luxury dark theme design with neon lime active state.
 */
export function RaceFilterChips({
  value,
  onChange,
  testID = 'race-filter-chips',
}: RaceFilterChipsProps): React.ReactElement {
  const handlePress = React.useCallback(
    (chipValue: RaceFilterValue) => {
      haptics.selection();
      onChange(chipValue);
    },
    [onChange]
  );

  return (
    <View testID={testID} className="w-full">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {CHIPS.map((chip) => (
          <FilterChip
            key={chip}
            label={CHIP_LABELS[chip]}
            isActive={value === chip}
            onPress={() => handlePress(chip)}
            testID={`${testID}-${chip}`}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 12,
    flexDirection: 'row',
  },
  chip: {
    borderWidth: 1,
  },
  chipActive: {
    backgroundColor: 'transparent',
    borderColor: colors.neon.lime,
    // Subtle glow effect
    shadowColor: colors.neon.lime,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  chipInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  chipTextActive: {
    color: colors.neon.lime,
    fontWeight: '700',
    // Text shadow for neon effect
    textShadowColor: 'rgba(148, 250, 46, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  chipTextInactive: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
});
