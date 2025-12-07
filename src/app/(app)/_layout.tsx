import { Link, Redirect, SplashScreen, Tabs } from 'expo-router';
import React from 'react';

import { CustomTabBar } from '@/components/navigation/custom-tab-bar';
import { SharedHeader } from '@/components/navigation/shared-header';
import { LegalUpdateBanner } from '@/components/settings/legal-update-banner';
import { RestoreAccountBanner } from '@/components/settings/restore-account-banner';
import { Pressable, Text, View } from '@/components/ui';
import {
  Calendar as CalendarIcon,
  Feed as FeedIcon,
  Home as HomeIcon,
  Inventory as InventoryIcon,
  Settings as SettingsIcon,
  Style as StyleIcon,
  TopDress as PlantsIcon,
} from '@/components/ui/icons';
import { useAgeGate, useAuth, useIsFirstTime } from '@/lib';
import { AnimatedScrollListProvider } from '@/lib/animations/animated-scroll-list-provider';
import { checkLegalVersionBumps } from '@/lib/compliance/legal-acceptances';
import { usePendingDeletion } from '@/lib/hooks/use-pending-deletion';
import { translate } from '@/lib/i18n';
import { useInventoryLowStockCount } from '@/lib/inventory/use-inventory-low-stock-count';
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

function useTabLayoutRedirects() {
  const status = useAuth.use.status();
  const [isFirstTime] = useIsFirstTime();
  // eslint-disable-next-line react-compiler/react-compiler
  const ageGateStatus = useAgeGate.status();

  if (isFirstTime) return '/onboarding';
  // Handle auth status:
  // - 'idle': Auth hydration in progress - redirect to login to prevent protected content flash
  //   The splash screen remains visible until hydration completes, then proper redirect occurs
  // - 'signOut': User explicitly signed out - redirect to login
  // - 'signIn': User authenticated - allow access
  if (status === 'idle' || status === 'signOut') return '/login';
  if (ageGateStatus !== 'verified') return '/age-gate';
  return null;
}

function useSplashScreenHide() {
  const status = useAuth.use.status();
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
}

export default function TabLayout() {
  const theme = useThemeConfig();
  const tabScreenOptions = useTabScreenOptions(theme);
  const redirectTo = useTabLayoutRedirects();
  const { count: lowStockCount } = useInventoryLowStockCount();
  const { pendingDeletion, hasPendingDeletion } = usePendingDeletion();
  useSplashScreenHide();

  // Check for legal version bumps that need notification (minor/patch updates)
  const legalVersionCheck = checkLegalVersionBumps();
  const [showLegalBanner, setShowLegalBanner] = React.useState(false);
  const [showRestoreBanner, setShowRestoreBanner] = React.useState(false);

  React.useEffect(() => {
    // Only show banner for non-blocking updates (minor/patch bumps)
    // Blocking updates (major bumps) are handled in root _layout
    if (
      legalVersionCheck.needsNotification &&
      !legalVersionCheck.needsBlocking
    ) {
      setShowLegalBanner(true);
    }
  }, [legalVersionCheck.needsBlocking, legalVersionCheck.needsNotification]);

  React.useEffect(() => {
    // Show restore banner when pending deletion is detected
    if (hasPendingDeletion) {
      setShowRestoreBanner(true);
    } else {
      setShowRestoreBanner(false);
    }
  }, [hasPendingDeletion]);

  if (redirectTo) return <Redirect href={redirectTo} />;

  return (
    <AnimatedScrollListProvider>
      <View className="flex-1">
        {showRestoreBanner && pendingDeletion && (
          <RestoreAccountBanner
            daysRemaining={pendingDeletion.daysRemaining}
            requestId={pendingDeletion.requestId}
            onDismiss={() => setShowRestoreBanner(false)}
          />
        )}
        {showLegalBanner && (
          <LegalUpdateBanner
            documents={legalVersionCheck.documents}
            onDismiss={() => setShowLegalBanner(false)}
          />
        )}
        <Tabs
          initialRouteName="index"
          screenOptions={tabScreenOptions}
          tabBar={(p) => <CustomTabBar {...p} />}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: translate('tabs.home'),
              tabBarIcon: ({ color }) => <HomeIcon color={color} />,
              headerRight: () => <SettingsLink />,
              tabBarButtonTestID: 'home-tab',
            }}
          />
          <Tabs.Screen
            name="calendar"
            options={{
              title: translate('tabs.calendar'),
              tabBarIcon: ({ color }) => <CalendarIcon color={color} />,
              tabBarButtonTestID: 'calendar-tab',
            }}
          />
          <Tabs.Screen
            name="community"
            options={{
              title: translate('tabs.community'),
              tabBarIcon: ({ color }) => <FeedIcon color={color} />,
              headerRight: () => <CreateNewPostLink />,
              tabBarButtonTestID: 'community-tab',
            }}
          />
          <Tabs.Screen
            name="plants"
            options={{
              title: translate('tabs.plants'),
              tabBarIcon: ({ color }) => <PlantsIcon color={color} />,
              tabBarButtonTestID: 'plants-tab',
            }}
          />
          <Tabs.Screen
            name="inventory"
            options={{
              title: translate('tabs.inventory'),
              tabBarIcon: ({ color }) => <InventoryIcon color={color} />,
              tabBarBadge: lowStockCount > 0 ? lowStockCount : undefined,
              tabBarButtonTestID: 'inventory-tab',
            }}
          />
          <Tabs.Screen
            name="strains"
            options={{
              title: translate('tabs.strains'),
              tabBarIcon: ({ color }) => <StyleIcon color={color} />,
              tabBarButtonTestID: 'strains-tab',
              headerShown: false,
            }}
          />
        </Tabs>
      </View>
    </AnimatedScrollListProvider>
  );
}

// Header right components
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
