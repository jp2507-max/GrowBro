/**
 * CommunityHeader - "Deep Garden" Identity Header
 *
 * Premium immersive header with:
 * - LinearGradient background for rich depth
 * - Glass-style search bar placeholder
 * - Native SegmentedControl for tabs
 * - Content overlaps with negative margin (handled by parent)
 */

import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { StyleSheet } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/shared/glass-surface';
import { GlassButton, Pressable, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { Search } from '@/components/ui/icons';
import { haptics } from '@/lib/haptics';
import { translate } from '@/lib/i18n';

const HEADER_PADDING_TOP = 16;

const styles = StyleSheet.create({
  gradientContainer: {
    minHeight: 220,
  },
  segmentedControl: {
    height: 40,
  },
  searchPill: {
    borderRadius: 20,
  },
});

// Gradient colors for light and dark modes
const GRADIENT_COLORS = {
  light: ['#065F46', '#047857', '#059669'] as const, // primary-800 → primary-700 → primary-600
  dark: ['#022C22', '#064E3B', '#065F46'] as const, // primary-950 → primary-900 → primary-800
};

type SearchBarPlaceholderProps = {
  onPress: () => void;
};

const SearchBarPlaceholder = React.memo<SearchBarPlaceholderProps>(
  ({ onPress }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={translate('community.filters_label')}
      accessibilityHint={translate('community.filters_hint')}
      testID="community-search-bar"
      className="active:opacity-90"
    >
      <GlassSurface
        glassEffectStyle="clear"
        style={styles.searchPill}
        fallbackClassName="bg-white/12"
      >
        <View className="flex-row items-center gap-3 px-5 py-3.5">
          <Search size={20} color="rgba(255, 255, 255, 0.7)" />
          <Text className="flex-1 text-base font-medium text-white/60">
            {translate('community.search_placeholder')}
          </Text>
        </View>
      </GlassSurface>
    </Pressable>
  )
);
SearchBarPlaceholder.displayName = 'SearchBarPlaceholder';

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

  const gradientColors = isDark ? GRADIENT_COLORS.dark : GRADIENT_COLORS.light;

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
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        styles.gradientContainer,
        { paddingTop: insets.top + HEADER_PADDING_TOP },
      ]}
      testID="community-header"
    >
      <View className="z-0 px-5 pb-16">
        {/* Top Row: Title + Filter Button */}
        <View className="flex-row items-center justify-between">
          {/* Title */}
          <Text className="text-3xl font-bold tracking-tight text-white">
            {translate('community.title')}
          </Text>

          {/* Filter/Search Button */}
          <View className="relative">
            <GlassButton
              onPress={handleFilterPress}
              accessibilityLabel={translate('community.filters_label')}
              accessibilityHint={translate('community.filters_hint')}
              testID="community-filter-button"
              fallbackClassName="bg-white/15"
            >
              <Search size={20} color={colors.white} />
            </GlassButton>
            {/* Active indicator dot */}
            {hasActiveFilters && (
              <View className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-primary-800 bg-terracotta-500 dark:border-primary-400" />
            )}
          </View>
        </View>

        {/* Glass Search Bar Placeholder */}
        <View className="mt-5">
          <SearchBarPlaceholder onPress={handleFilterPress} />
        </View>

        {/* Segmented Control for Showcase / Help Station */}
        <View className="mt-5">
          <SegmentedControl
            values={segmentLabels}
            selectedIndex={selectedIndex}
            onChange={handleSegmentChange}
            style={styles.segmentedControl}
            backgroundColor="rgba(255, 255, 255, 0.12)"
            // eslint-disable-next-line react-native/no-inline-styles
            fontStyle={{
              color: 'rgba(255, 255, 255, 0.85)',
              fontWeight: '500',
              fontSize: 14,
            }}
            // eslint-disable-next-line react-native/no-inline-styles
            activeFontStyle={{
              color: isDark ? colors.primary[300] : colors.primary[800],
              fontWeight: '600',
              fontSize: 14,
            }}
            testID="community-segment-control"
          />
        </View>
      </View>
    </LinearGradient>
  );
}
