import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { StyleSheet } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/shared/glass-surface';
import { GlassButton, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { PlatformIcon, Settings as SettingsIcon } from '@/components/ui/icons';
import { translate } from '@/lib/i18n';
import type { TxKeyPath } from '@/lib/i18n/utils';
import { getHeaderColors } from '@/lib/theme-utils';
import { cn } from '@/lib/utils';

// Gradient colors matching Stitch "Organic Tech" design
const HEADER_GRADIENT_COLORS = {
  light: [
    colors.primary[600],
    colors.primary[700],
    colors.primary[800],
  ] as const,
  dark: [
    '#0c0a09', // Deep charcoal base (charcoal-950)
    '#0a1612', // Transitional deep forest
    '#0f2b1d', // Rich forest green accent
  ] as const,
};

const styles = StyleSheet.create({
  statsPill: {
    borderRadius: 999,
  },
  headerContainer: {
    paddingHorizontal: 16,
  },
  headerContainerCompact: {
    paddingBottom: 16,
  },
  headerContainerNormal: {
    paddingBottom: 24,
  },
});

const HEADER_PADDING_TOP = 12;
const HEADER_PADDING_TOP_COMPACT = 8;

type ScreenHeaderBaseProps = {
  /** Safe area insets */
  insets: EdgeInsets;
  /** Top row content: subtitle/greeting on left */
  topRowLeft?: React.ReactNode;
  /** Top row content: icons on right */
  topRowRight?: React.ReactNode;
  /** Main title text */
  title: string;
  /** Content below title (stats pills, search bar, etc.) */
  children?: React.ReactNode;
  /** Whether to show bottom border */
  showBottomBorder?: boolean;
  /** Test ID for the header container */
  testID?: string;
  /** Compact mode for smaller headers (less padding, smaller title) */
  compact?: boolean;
};

/**
 * Base component for screen headers with consistent styling.
 * Uses gradient background matching community header style.
 */
export function ScreenHeaderBase({
  insets,
  topRowLeft,
  topRowRight,
  title,
  children,
  showBottomBorder = false, // Disabled by default
  testID,
  compact = false,
}: ScreenHeaderBaseProps): React.ReactElement {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const headerColors = getHeaderColors(isDark);
  const gradientColors = isDark
    ? HEADER_GRADIENT_COLORS.dark
    : HEADER_GRADIENT_COLORS.light;

  const paddingTop = compact ? HEADER_PADDING_TOP_COMPACT : HEADER_PADDING_TOP;

  const borderStyle = showBottomBorder
    ? {
        borderBottomWidth: 1,
        borderBottomColor: isDark
          ? 'rgba(68, 64, 60, 1)'
          : 'rgba(204, 235, 217, 1)',
      }
    : undefined;

  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      testID={testID}
      style={[
        styles.headerContainer,
        compact ? styles.headerContainerCompact : styles.headerContainerNormal,
        { paddingTop: insets.top + paddingTop },
        borderStyle,
      ]}
    >
      {/* Top Row: Left content + Right icons */}
      {(topRowLeft || topRowRight) && (
        <View className="flex-row items-center justify-between">
          {topRowLeft ?? <View />}
          {topRowRight ?? <View />}
        </View>
      )}

      {/* Main Title */}
      {title ? (
        <Text
          className={cn(
            'font-bold tracking-tight',
            compact ? 'text-2xl' : 'text-3xl'
          )}
          style={{ color: headerColors.text }}
        >
          {title}
        </Text>
      ) : null}

      {/* Content below title */}
      {children && (
        <View className={compact ? 'mt-2' : 'mt-3'}>{children}</View>
      )}
    </LinearGradient>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Reusable Header Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Time-based greeting text for Home screen
 */
export function HeaderGreeting(): React.ReactElement {
  const hour = new Date().getHours();
  let greeting: string;

  if (hour >= 5 && hour < 12) {
    greeting = translate('home.greeting.morning' as TxKeyPath);
  } else if (hour >= 12 && hour < 17) {
    greeting = translate('home.greeting.afternoon' as TxKeyPath);
  } else if (hour >= 17 && hour < 21) {
    greeting = translate('home.greeting.evening' as TxKeyPath);
  } else {
    greeting = translate('home.greeting.night' as TxKeyPath);
  }

  return <Text className="text-lg font-medium text-white/90">{greeting}</Text>;
}

/**
 * Settings icon button linking to settings page
 */
export function HeaderSettingsButton(): React.ReactElement {
  const settingsLabel = translate('home.open_settings' as TxKeyPath);
  const settingsHint = translate(
    'accessibility.home.open_settings_hint' as TxKeyPath
  );

  const { colorScheme } = useColorScheme();
  const colors = getHeaderColors(colorScheme === 'dark');

  return (
    <GlassButton
      onPress={() => router.push('/settings')}
      accessibilityLabel={settingsLabel}
      accessibilityHint={settingsHint}
      fallbackClassName="bg-white/20 dark:bg-black/20"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <PlatformIcon
        iosName="gearshape"
        size={20}
        color={colors.text}
        fallback={<SettingsIcon />}
      />
    </GlassButton>
  );
}

/**
 * Stats pills showing plant count and optional task count
 */
export function HeaderStatsPill({
  plantCount,
  taskCount,
}: {
  plantCount: number;
  taskCount: number;
}): React.ReactElement {
  const plantLabel = translate('home.stats.plants' as TxKeyPath, {
    count: plantCount,
  });
  const taskLabel = translate('home.stats.tasks' as TxKeyPath, {
    count: taskCount,
  });

  return (
    <View className="flex-row items-center gap-3">
      {/* Plant count - glass pill */}
      <GlassSurface
        glassEffectStyle="clear"
        style={styles.statsPill}
        fallbackClassName="bg-white/20 dark:bg-white/10"
      >
        <View className="flex-row items-center gap-1.5 px-3 py-1.5">
          <Text className="text-base">🌱</Text>
          <Text className="text-sm font-semibold text-white">{plantLabel}</Text>
        </View>
      </GlassSurface>
      {/* Task count - terracotta accent for CTA emphasis */}
      {taskCount > 0 && (
        <GlassSurface
          glassEffectStyle="clear"
          style={styles.statsPill}
          fallbackClassName="bg-terracotta-500/30 dark:bg-terracotta-500/20"
        >
          <View className="flex-row items-center gap-1.5 px-3 py-1.5">
            <Text className="text-base">📋</Text>
            <Text className="text-sm font-semibold text-terracotta-100">
              {taskLabel}
            </Text>
          </View>
        </GlassSurface>
      )}
    </View>
  );
}

/**
 * Circular icon button for header actions
 */
export function HeaderIconButton({
  icon,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  testID,
  isActive,
}: {
  icon: React.ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint: string;
  testID?: string;
  isActive?: boolean;
}): React.ReactElement {
  return (
    <GlassButton
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
      fallbackClassName={
        isActive
          ? 'bg-primary-100 dark:bg-primary-900'
          : 'bg-white/80 dark:bg-black/30'
      }
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      {icon}
    </GlassButton>
  );
}
