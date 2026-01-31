import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { DateTime } from 'luxon';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { StyleSheet } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import { GlassButton, Text, View } from '@/components/ui';
import colors from '@/components/ui/colors';
import { PlatformIcon, Settings as SettingsIcon } from '@/components/ui/icons';
import { useAuth } from '@/lib/auth';
import { translate } from '@/lib/i18n';
import type { TxKeyPath } from '@/lib/i18n/utils';
import { fetchProfileFromBackend } from '@/lib/sync/profile-sync';
import { getHeaderColors } from '@/lib/theme-utils';

const HEADER_GRADIENT_COLORS = {
  light: [
    colors.primary[600],
    colors.primary[700],
    colors.primary[800],
  ] as const,
  dark: [
    '#1a1a1a', // Stitch gradient start
    '#151a14', // Mid - smoother transition
    '#112b18', // End - slightly lighter to blend with body
    '#0f2e1a', // Final - exact match with charcoal-950
  ] as const,
};

const GRADIENT_LOCATIONS = {
  light: [0, 0.5, 1] as const,
  dark: [0, 0.35, 0.75, 1] as const,
};

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
});

const HEADER_PADDING_TOP = 12;

type CockpitHeaderProps = {
  insets: EdgeInsets;
};

function useDisplayName(): string | null {
  const user = useAuth.use.user();
  const [displayName, setDisplayName] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!user?.id) {
      setDisplayName(null);
      return;
    }

    let cancelled = false;

    async function loadProfile() {
      try {
        const profile = await fetchProfileFromBackend(user!.id);
        if (!cancelled && profile?.displayName) {
          setDisplayName(profile.displayName);
        }
      } catch (error) {
        console.error('[cockpit-header] Failed to load profile:', error);
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return displayName;
}

function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return translate('home.greeting.morning' as TxKeyPath);
  } else if (hour >= 12 && hour < 17) {
    return translate('home.greeting.afternoon' as TxKeyPath);
  } else if (hour >= 17 && hour < 21) {
    return translate('home.greeting.evening' as TxKeyPath);
  } else {
    return translate('home.greeting.night' as TxKeyPath);
  }
}

function formatCurrentDate(): string {
  const now = DateTime.local();
  return now.toFormat('EEEE, MMM d');
}

function SettingsButton(): React.ReactElement {
  const settingsLabel = translate('home.open_settings' as TxKeyPath);
  const settingsHint = translate(
    'accessibility.home.open_settings_hint' as TxKeyPath
  );

  const { colorScheme } = useColorScheme();
  const headerColors = getHeaderColors(colorScheme === 'dark');

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
        color={headerColors.text}
        fallback={<SettingsIcon />}
      />
    </GlassButton>
  );
}

export function CockpitHeader({
  insets,
}: CockpitHeaderProps): React.ReactElement {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const headerColors = getHeaderColors(isDark);
  const gradientColors = isDark
    ? HEADER_GRADIENT_COLORS.dark
    : HEADER_GRADIENT_COLORS.light;
  const gradientLocations = isDark
    ? GRADIENT_LOCATIONS.dark
    : GRADIENT_LOCATIONS.light;

  const displayName = useDisplayName();
  const greeting = getTimeBasedGreeting();
  const dateString = formatCurrentDate();

  const greetingWithName = displayName
    ? `${greeting}, ${displayName}`
    : greeting;

  return (
    <LinearGradient
      colors={gradientColors}
      locations={gradientLocations}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      testID="cockpit-header"
      style={[
        styles.headerContainer,
        { paddingTop: insets.top + HEADER_PADDING_TOP },
      ]}
    >
      {/* Date Row */}
      <View className="flex-row items-center justify-between">
        <Text
          className="text-sm font-medium text-white/70"
          testID="cockpit-header-date"
        >
          {dateString}
        </Text>
        <SettingsButton />
      </View>

      {/* Greeting */}
      <Text
        className="mt-2 text-3xl font-bold tracking-tight"
        style={{ color: headerColors.text }}
        testID="cockpit-header-greeting"
      >
        {greetingWithName}
      </Text>
    </LinearGradient>
  );
}
