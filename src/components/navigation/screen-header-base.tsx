import { Link } from 'expo-router';
import React from 'react';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { Pressable, Text, View } from '@/components/ui';
import { Settings as SettingsIcon } from '@/components/ui/icons';
import { translate } from '@/lib/i18n';
import type { TxKeyPath } from '@/lib/i18n/utils';
import { useThemeConfig } from '@/lib/use-theme-config';

const HEADER_PADDING_TOP = 12;

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
};

/**
 * Base component for screen headers with consistent styling.
 * Used by Home and Strains screens for unified header design.
 */
export function ScreenHeaderBase({
  insets,
  topRowLeft,
  topRowRight,
  title,
  children,
  showBottomBorder = true,
  testID,
}: ScreenHeaderBaseProps): React.ReactElement {
  const theme = useThemeConfig();

  const borderClass = showBottomBorder ? 'border-b border-border' : '';

  return (
    <View
      className={`px-4 pb-4 ${borderClass}`}
      style={{
        paddingTop: insets.top + HEADER_PADDING_TOP,
        backgroundColor: theme.colors.background,
      }}
      testID={testID}
    >
      {/* Top Row: Left content + Right icons */}
      {(topRowLeft || topRowRight) && (
        <View className="mb-2 flex-row items-center justify-between">
          {topRowLeft ?? <View />}
          {topRowRight ?? <View />}
        </View>
      )}

      {/* Main Title */}
      <Text className="text-3xl font-bold tracking-tight text-text-primary">
        {title}
      </Text>

      {/* Content below title */}
      {children && <View className="mt-3">{children}</View>}
    </View>
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

  return (
    <Text className="text-lg font-medium text-neutral-600 dark:text-neutral-400">
      {greeting}
    </Text>
  );
}

/**
 * Settings icon button linking to settings page
 */
export function HeaderSettingsButton(): React.ReactElement {
  const settingsLabel = translate('home.open_settings' as TxKeyPath);
  const settingsHint = translate(
    'accessibility.home.open_settings_hint' as TxKeyPath
  );

  return (
    <Link href="/settings" asChild>
      <Pressable
        className="size-10 items-center justify-center rounded-full bg-white/80 dark:bg-charcoal-800/80"
        accessibilityRole="button"
        accessibilityLabel={settingsLabel}
        accessibilityHint={settingsHint}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <SettingsIcon />
      </Pressable>
    </Link>
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
      <View className="flex-row items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 dark:border-neutral-700 dark:bg-charcoal-850">
        <Text className="text-base">🌱</Text>
        <Text className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
          {plantLabel}
        </Text>
      </View>
      {taskCount > 0 && (
        <View className="flex-row items-center gap-1.5 rounded-full border border-warning-200 bg-warning-50 px-3 py-1.5 dark:border-warning-700 dark:bg-warning-900/30">
          <Text className="text-base">📋</Text>
          <Text className="text-sm font-semibold text-warning-800 dark:text-warning-200">
            {taskLabel}
          </Text>
        </View>
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
    <Pressable
      onPress={onPress}
      className={`size-10 items-center justify-center rounded-full shadow-sm active:bg-neutral-100 dark:active:bg-neutral-800 ${
        isActive
          ? 'bg-primary-100 dark:bg-primary-900'
          : 'bg-white dark:bg-neutral-900'
      }`}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
    >
      {icon}
    </Pressable>
  );
}
