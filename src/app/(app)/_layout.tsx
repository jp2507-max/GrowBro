import { Link, Redirect, SplashScreen, Tabs } from 'expo-router';
import React from 'react';

import { CustomTabBar } from '@/components/navigation/custom-tab-bar';
import { SharedHeader } from '@/components/navigation/shared-header';
import { Pressable, Text } from '@/components/ui';
import {
  Feed as FeedIcon,
  Home as HomeIcon,
  Settings as SettingsIcon,
  Style as StyleIcon,
  TopDress as PlantsIcon,
} from '@/components/ui/icons';
import { translate, useAgeGate, useAuth, useIsFirstTime } from '@/lib';
import { AnimatedScrollListProvider } from '@/lib/animations/animated-scroll-list-provider';

const tabScreenOptions = {
  tabBarHideOnKeyboard: true,
  freezeOnBlur: true,
  header: ({ route, options }: { route: { name: string }; options: any }) => (
    <SharedHeader
      rightComponent={options.headerRight?.()}
      showConnectivity={options.showConnectivity ?? true}
      showSync={options.showSync ?? true}
      title={options.headerTitle ?? options.title ?? route.name}
      routeName={route.name}
    />
  ),
  headerStyle: { height: 148 },
};

export default function TabLayout() {
  const status = useAuth.use.status();
  const [isFirstTime] = useIsFirstTime();
  // eslint-disable-next-line react-compiler/react-compiler
  const ageGateStatus = useAgeGate.status();
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
        tabBarIcon: ({ color }) => <HomeIcon color={color} />,
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
  return (
    <Link href="/community/add-post" asChild>
      <Pressable>
        <Text className="px-3 text-primary-300">Create</Text>
      </Pressable>
    </Link>
  );
};

const SettingsLink = () => {
  return (
    <Link href="/(app)/settings" asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={translate('settings.title')}
      >
        <SettingsIcon />
      </Pressable>
    </Link>
  );
};
