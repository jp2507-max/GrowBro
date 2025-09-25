import { Link, Redirect, SplashScreen, Tabs } from 'expo-router';
import React from 'react';

import { CustomTabBar } from '@/components/navigation/custom-tab-bar';
import { SharedHeader } from '@/components/navigation/shared-header';
import { Pressable, Text } from '@/components/ui';
import {
  Calendar as CalendarIcon,
  Feed as FeedIcon,
  Home as HomeIcon,
  Settings as SettingsIcon,
  Style as StyleIcon,
  TopDress as PlantsIcon,
} from '@/components/ui/icons';
import { useAgeGate, useAuth, useIsFirstTime } from '@/lib';
import { AnimatedScrollListProvider } from '@/lib/animations/animated-scroll-list-provider';
import { translate } from '@/lib/i18n';
import { useThemeConfig } from '@/lib/use-theme-config';

type HeaderOptions = {
  route: { name: string };
  options: Record<string, unknown>;
};

function resolveBooleanOption(
  options: Record<string, unknown>,
  key: 'showConnectivity' | 'showSync'
): boolean {
  if (Object.prototype.hasOwnProperty.call(options, key)) {
    return Boolean(options[key]);
  }
  return true;
}

function renderSharedHeader({
  route,
  options,
}: HeaderOptions): React.ReactElement {
  const rightComponent =
    typeof options.headerRight === 'function'
      ? (options.headerRight as () => React.ReactNode)()
      : undefined;
  const title =
    (options.headerTitle as string) ?? (options.title as string) ?? route.name;

  return (
    <SharedHeader
      rightComponent={rightComponent}
      showConnectivity={resolveBooleanOption(options, 'showConnectivity')}
      showSync={resolveBooleanOption(options, 'showSync')}
      title={title}
      routeName={route.name}
    />
  );
}

function useTabScreenOptions(theme: ReturnType<typeof useThemeConfig>) {
  return React.useMemo(
    () => ({
      tabBarHideOnKeyboard: true,
      freezeOnBlur: true,
      detachInactiveScreens: true,
      header: renderSharedHeader,
      headerStyle: {
        height: 148,
        backgroundColor: theme.colors.card,
      },
      sceneStyle: {
        backgroundColor: theme.colors.background,
      },
    }),
    [theme.colors.background, theme.colors.card]
  );
}

export default function TabLayout() {
  const status = useAuth.use.status();
  const [isFirstTime] = useIsFirstTime();
  // eslint-disable-next-line react-compiler/react-compiler
  const ageGateStatus = useAgeGate.status();
  const theme = useThemeConfig();
  const tabScreenOptions = useTabScreenOptions(theme);
  const hideSplash = React.useCallback(async () => {
    await SplashScreen.hideAsync();
  }, []);
  React.useEffect(() => {
    if (status !== 'idle') {
      setTimeout(() => {
        hideSplash();
      }, 1000);
    }
  }, [hideSplash, status]);

  if (isFirstTime) return <Redirect href="/onboarding" />;
  if (status === 'signOut') return <Redirect href="/login" />;
  if (ageGateStatus !== 'verified') return <Redirect href="/age-gate" />;

  return (
    <AnimatedScrollListProvider>
      <Tabs
        initialRouteName="index"
        screenOptions={tabScreenOptions}
        tabBar={(p) => <CustomTabBar {...p} />}
      >
        <HomeTab />
        <CalendarTab />
        <CommunityTab />
        <PlantsTab />
        <StrainsTab />
      </Tabs>
    </AnimatedScrollListProvider>
  );
}

function HomeTab(): React.ReactElement {
  return (
    <Tabs.Screen
      name="index"
      options={{
        title: translate('tabs.home'),
        tabBarIcon: ({ color }) => <HomeIcon color={color} />,
        headerRight: () => <SettingsLink />,
        tabBarButtonTestID: 'home-tab',
      }}
    />
  );
}

function CalendarTab(): React.ReactElement {
  return (
    <Tabs.Screen
      name="calendar"
      options={{
        title: translate('tabs.calendar'),
        tabBarIcon: ({ color }) => <CalendarIcon color={color} />,
        tabBarButtonTestID: 'calendar-tab',
      }}
    />
  );
}

function CommunityTab(): React.ReactElement {
  return (
    <Tabs.Screen
      name="community"
      options={{
        title: translate('tabs.community'),
        tabBarIcon: ({ color }) => <FeedIcon color={color} />,
        headerRight: () => <CreateNewPostLink />,
        tabBarButtonTestID: 'community-tab',
      }}
    />
  );
}

function PlantsTab(): React.ReactElement {
  return (
    <Tabs.Screen
      name="plants"
      options={{
        title: translate('tabs.plants'),
        tabBarIcon: ({ color }) => <PlantsIcon color={color} />,
        tabBarButtonTestID: 'plants-tab',
      }}
    />
  );
}

function StrainsTab(): React.ReactElement {
  return (
    <Tabs.Screen
      name="strains"
      options={{
        title: translate('tabs.strains'),
        tabBarIcon: ({ color }) => <StyleIcon color={color} />,
        tabBarButtonTestID: 'strains-tab',
      }}
    />
  );
}

const CreateNewPostLink = () => {
  const createPostLabel = translate('community.create_post');
  const createPostHint = translate('accessibility.community.create_post_hint');
  return (
    <Link href="/add-post" asChild>
      <Pressable
        className="ml-3 h-12 flex-row items-center rounded-full bg-primary-600 px-5"
        accessibilityRole="button"
        accessibilityLabel={createPostLabel}
        accessibilityHint={createPostHint}
        testID="community-header-create"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text className="text-sm font-semibold text-neutral-50">
          {createPostLabel}
        </Text>
      </Pressable>
    </Link>
  );
};
const SettingsLink = () => {
  const settingsLabel = translate('home.open_settings');
  const settingsHint = translate('accessibility.home.open_settings_hint');
  return (
    <Link href="/settings" asChild>
      <Pressable
        className="ml-3 size-12 items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel={settingsLabel}
        accessibilityHint={settingsHint}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <SettingsIcon />
      </Pressable>
    </Link>
  );
};
