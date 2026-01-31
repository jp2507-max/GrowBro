/**
 * CommunityHeader - "Stitch" Design Header
 *
 * Premium immersive header with:
 * - LinearGradient background for rich depth
 * - Glass-style search bar with notification bell
 * - Native SegmentedControl with liquid glass styling
 * - Content overlaps with negative margin (handled by parent)
 */

import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/shared/glass-surface';
import { GlassButton, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { PlatformIcon, Search, SlidersHorizontal } from '@/components/ui/icons';
import { haptics } from '@/lib/haptics';
import { translate } from '@/lib/i18n';

const HEADER_PADDING_TOP = 16;

const styles = StyleSheet.create({
  gradientContainer: {
    minHeight: 220,
  },
  searchPill: {
    borderRadius: 24,
  },
  filterPill: {
    borderRadius: 20,
  },
  notificationDot: {
    shadowColor: colors.neon.lime,
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  gradientFade: {
    height: 40,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  segmentedControl: {
    height: 44,
  },
  segmentedWrapper: {
    borderRadius: 22,
    overflow: 'hidden',
  },
});

// Gradient colors for dark mode - deep forest tones
const GRADIENT_COLORS = {
  light: [
    colors.primary[600],
    colors.primary[700],
    colors.primary[800],
  ] as const,
  dark: [colors.charcoal[950], '#151e13', '#0f1f15'] as const,
};

const SearchBarPlaceholder = React.memo(function SearchBarPlaceholder() {
  return (
    <GlassSurface
      glassEffectStyle="clear"
      style={styles.searchPill}
      fallbackClassName="bg-white/5 border border-white/10"
    >
      <View className="flex-row items-center gap-3 px-4 py-3">
        <PlatformIcon
          iosName="magnifyingglass"
          size={20}
          color="rgba(255, 255, 255, 0.5)"
          fallback={<Search color="rgba(255, 255, 255, 0.5)" size={20} />}
        />
        <Text className="flex-1 text-sm font-medium text-white/40">
          {translate('community.search_placeholder')}
        </Text>
      </View>
    </GlassSurface>
  );
});
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
      <View className="z-0 px-4 pb-16">
        {/* Search Row: Search Bar + Notification Bell */}
        <View className="flex-row items-center gap-3">
          <View className="flex-1">
            <SearchBarPlaceholder />
          </View>

          {/* Filter/Notification Button */}
          <View className="relative">
            <GlassButton
              onPress={handleFilterPress}
              accessibilityLabel={translate('community.filters_label')}
              accessibilityHint={translate('community.filters_hint')}
              testID="community-filter-button"
              fallbackClassName="bg-white/5 border border-white/10"
            >
              <PlatformIcon
                iosName="bell"
                size={20}
                color={colors.white}
                fallback={<SlidersHorizontal color={colors.white} size={20} />}
              />
            </GlassButton>
            {/* Notification indicator dot */}
            {hasActiveFilters && (
              <View
                className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-neon-lime"
                style={styles.notificationDot}
              />
            )}
          </View>
        </View>

        {/* Segmented Control with Glass Background */}
        <View className="mt-6">
          <GlassSurface
            glassEffectStyle="clear"
            style={styles.segmentedWrapper}
            fallbackClassName="bg-white/10 border border-white/15"
          >
            <SegmentedControl
              values={segmentLabels}
              selectedIndex={selectedIndex}
              onChange={(event) => {
                haptics.selection();
                onSegmentChange(event.nativeEvent.selectedSegmentIndex);
              }}
              style={styles.segmentedControl}
              backgroundColor="transparent"
              tintColor={colors.white}
              fontStyle={{
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: 14,
                fontWeight: '500',
              }}
              activeFontStyle={{
                color: colors.primary[900],
                fontSize: 14,
                fontWeight: '700',
              }}
              appearance={Platform.OS === 'ios' ? 'light' : undefined}
            />
          </GlassSurface>
        </View>
      </View>

      {/* Gradient Fade at Bottom */}
      <LinearGradient
        colors={[
          'transparent',
          isDark ? colors.charcoal[950] : colors.primary[800],
        ]}
        style={styles.gradientFade}
        pointerEvents="none"
      />
    </LinearGradient>
  );
}
