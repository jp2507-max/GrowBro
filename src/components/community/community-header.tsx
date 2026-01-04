/**
 * CommunityHeader - "Deep Garden" Identity Header
 *
 * Matches the Home/PlantDashboard architecture:
 * - Large dark green header background (h-[280px])
 * - Large bold "Community" title
 * - Glass-style search/filter row
 * - Content overlaps with negative margin
 */

import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { StyleSheet } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Pressable, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { Search } from '@/components/ui/icons';
import { haptics } from '@/lib/haptics';
import { translate } from '@/lib/i18n';
import { getHeaderColors } from '@/lib/theme-utils';

const HEADER_PADDING_TOP = 12;

const styles = StyleSheet.create({
  header: {
    minHeight: 200,
  },
  segmentedControl: {
    height: 36,
  },
});

type CommunityHeaderProps = {
  insets: EdgeInsets;
  hasActiveFilters: boolean;
  onFilterPress: () => void;
  selectedIndex: number;
  onSegmentChange: (index: number) => void;
  segmentLabels: [string, string];
};

export function CommunityHeader({
  insets,
  hasActiveFilters,
  onFilterPress,
  selectedIndex,
  onSegmentChange,
  segmentLabels,
}: CommunityHeaderProps): React.ReactElement {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const headerColors = getHeaderColors(isDark);

  const handleSegmentChange = React.useCallback(
    (event: { nativeEvent: { selectedSegmentIndex: number } }) => {
      onSegmentChange(event.nativeEvent.selectedSegmentIndex);
    },
    [onSegmentChange]
  );

  const handleFilterPress = React.useCallback(() => {
    haptics.selection();
    onFilterPress();
  }, [onFilterPress]);

  return (
    <View
      className="z-0 px-5 pb-16"
      style={[
        styles.header,
        {
          paddingTop: insets.top + HEADER_PADDING_TOP,
          backgroundColor: headerColors.background,
        },
      ]}
      testID="community-header"
    >
      {/* Top Row: Title + Filter Button */}
      <View className="flex-row items-center justify-between">
        {/* Title */}
        <Text
          className="text-3xl font-bold tracking-tight"
          style={{ color: headerColors.text }}
        >
          {translate('community.title')}
        </Text>

        {/* Filter/Search Button */}
        <View className="relative">
          <Pressable
            onPress={handleFilterPress}
            accessibilityRole="button"
            accessibilityLabel={translate('community.filters_label')}
            accessibilityHint={translate('community.filters_hint')}
            testID="community-filter-button"
            className="size-10 items-center justify-center rounded-full bg-white/15 active:bg-white/25"
          >
            <Search size={20} color={colors.white} />
          </Pressable>
          {/* Active indicator dot */}
          {hasActiveFilters && (
            <View className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-primary-800 bg-terracotta-500" />
          )}
        </View>
      </View>

      {/* Subtitle / Glass Search Bar Placeholder */}
      <View className="mt-4">
        <Pressable
          onPress={handleFilterPress}
          accessibilityRole="button"
          accessibilityLabel={translate('community.filters_label')}
          accessibilityHint={translate('community.filters_hint')}
          testID="community-search-bar"
          className="flex-row items-center gap-3 rounded-2xl bg-white/15 px-4 py-3 active:bg-white/25"
        >
          <Search size={18} color={colors.white} />
          <Text className="flex-1 text-base text-white/70">
            {translate('community.search_placeholder')}
          </Text>
        </Pressable>
      </View>

      {/* Segmented Control for Showcase / Help Station */}
      <View className="mt-4">
        <SegmentedControl
          values={segmentLabels}
          selectedIndex={selectedIndex}
          onChange={handleSegmentChange}
          style={styles.segmentedControl}
          backgroundColor="rgba(255, 255, 255, 0.1)"
          // eslint-disable-next-line react-native/no-inline-styles
          fontStyle={{
            color: 'rgba(255, 255, 255, 0.8)',
            fontWeight: '500',
          }}
          // eslint-disable-next-line react-native/no-inline-styles
          activeFontStyle={{
            color: colors.white,
            fontWeight: '600',
          }}
          testID="community-segment-control"
        />
      </View>
    </View>
  );
}
