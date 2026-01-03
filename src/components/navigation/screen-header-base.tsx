import { router } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React from 'react';
import type { EdgeInsets } from 'react-native-safe-area-context';
import { twMerge } from 'tailwind-merge';

import { Pressable, Text, View } from '@/components/ui';
import { Settings as SettingsIcon } from '@/components/ui/icons';
import { translate } from '@/lib/i18n';
import type { TxKeyPath } from '@/lib/i18n/utils';
import { getHeaderColors } from '@/lib/theme-utils';

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
 * Uses theme-aware background color for proper theming support.
 */
export function ScreenHeaderBase({
  insets,
  topRowLeft,
  topRowRight,
  title,
  children,
  showBottomBorder = false, // Disabled by default - we have rounded corners now
  testID,
}: ScreenHeaderBaseProps): React.ReactElement {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = getHeaderColors(isDark);

  return (
    <View
      className={twMerge(
        'z-0 px-4 pb-6',
        'shadow-lg',
        showBottomBorder &&
          'border-b border-neutral-200 dark:border-charcoal-700'
      )}
      style={{
        paddingTop: insets.top + HEADER_PADDING_TOP,
        backgroundColor: colors.background,
      }}
      testID={testID}
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
          className="text-3xl font-bold tracking-tight"
          style={{ color: colors.text }}
        >
          {title}
        </Text>
      ) : null}

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
    <Text className="text-lg font-medium text-charcoal-900 dark:text-neutral-100">
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
    <Pressable
      onPress={() => router.push('/settings')}
      className="size-10 items-center justify-center rounded-full bg-white/20 active:bg-white/30 dark:bg-black/20 dark:active:bg-black/30"
      accessibilityRole="button"
      accessibilityLabel={settingsLabel}
      accessibilityHint={settingsHint}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <SettingsIcon className="text-white" />
    </Pressable>
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
      {/* Plant count - semi-transparent white pill */}
      <View className="flex-row items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 dark:bg-white/10">
        <Text className="text-base">🌱</Text>
        <Text className="text-sm font-semibold text-white">{plantLabel}</Text>
      </View>
      {/* Task count - terracotta accent for CTA emphasis */}
      {taskCount > 0 && (
        <View className="flex-row items-center gap-1.5 rounded-full bg-terracotta-500/30 px-3 py-1.5 dark:bg-terracotta-500/20">
          <Text className="text-base">📋</Text>
          <Text className="text-sm font-semibold text-terracotta-100">
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
      className={twMerge(
        'size-10 items-center justify-center rounded-full shadow-sm active:bg-neutral-100 dark:active:bg-neutral-800',
        isActive
          ? 'bg-primary-100 dark:bg-primary-900'
          : 'bg-white dark:bg-charcoal-900'
      )}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
    >
      {icon}
    </Pressable>
  );
}
