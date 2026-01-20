import { Redirect, SplashScreen } from 'expo-router';
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import React from 'react';
import { Platform } from 'react-native';

import { LegalUpdateBanner } from '@/components/settings/legal-update-banner';
import { RestoreAccountBanner } from '@/components/settings/restore-account-banner';
import { View } from '@/components/ui';
import { useAgeGate, useAuth, useIsFirstTime } from '@/lib';
import { AnimatedScrollListProvider } from '@/lib/animations/animated-scroll-list-provider';
import { useCommunitySync } from '@/lib/community/use-community-sync';
import { checkLegalVersionBumps } from '@/lib/compliance/legal-acceptances';
import { usePendingDeletion } from '@/lib/hooks/use-pending-deletion';
import { translate } from '@/lib/i18n';

function useTabLayoutRedirects() {
  const status = useAuth.use.status();
  const [isFirstTime] = useIsFirstTime();
  // Zustand createSelectors pattern: .status() calls ARE hooks, but react-compiler
  // misinterprets `useX.propertySelector` as referencing hooks as values.
  // eslint-disable-next-line react-compiler/react-compiler
  const ageGateStatus = useAgeGate.status();

  // IMPORTANT: Age gate must be checked BEFORE onboarding to ensure compliance
  // Users must verify age before seeing any app content, including onboarding
  if (ageGateStatus !== 'verified') return '/age-gate';

  // After age verification, show onboarding for first-time users
  if (isFirstTime) return '/onboarding';

  // Handle auth status:
  // - 'idle': Auth hydration in progress - redirect to login to prevent protected content flash
  //   The splash screen remains visible until hydration completes, then proper redirect occurs
  // - 'signOut': User explicitly signed out - redirect to login
  // - 'signIn': User authenticated - allow access
  if (status === 'idle' || status === 'signOut') return '/login';
  return null;
}

function useSplashScreenHide() {
  const status = useAuth.use.status();
  const hideSplash = React.useCallback(async () => {
    await SplashScreen.hideAsync();
  }, []);

  React.useEffect(() => {
    if (status === 'idle') return;

    const timeoutId = setTimeout(() => {
      void hideSplash();
    }, 1000);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [hideSplash, status]);
}

/**
 * SF Symbol names for each tab.
 * Uses state variants: outline when inactive, filled when active (iOS HIG).
 */
const SF_SYMBOLS = {
  home: { default: 'house', selected: 'house.fill' },
  calendar: { default: 'calendar', selected: 'calendar.circle.fill' },
  community: {
    default: 'bubble.left.and.bubble.right',
    selected: 'bubble.left.and.bubble.right.fill',
  },
  strains: { default: 'leaf', selected: 'leaf.fill' },
} as const;

export default function TabLayout() {
  const redirectTo = useTabLayoutRedirects();

  const { pendingDeletion, hasPendingDeletion } = usePendingDeletion();
  useSplashScreenHide();
  useCommunitySync();

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
        <NativeTabs
          minimizeBehavior={Platform.OS === 'ios' ? 'onScrollDown' : undefined}
        >
          <NativeTabs.Trigger name="index">
            <Icon sf={SF_SYMBOLS.home} />
            <Label>{translate('tabs.home')}</Label>
          </NativeTabs.Trigger>

          <NativeTabs.Trigger name="calendar">
            <Icon sf={SF_SYMBOLS.calendar} />
            <Label>{translate('tabs.calendar')}</Label>
          </NativeTabs.Trigger>

          <NativeTabs.Trigger name="community">
            <Icon sf={SF_SYMBOLS.community} />
            <Label>{translate('tabs.community')}</Label>
          </NativeTabs.Trigger>

          <NativeTabs.Trigger name="strains">
            <Icon sf={SF_SYMBOLS.strains} />
            <Label>{translate('tabs.strains')}</Label>
          </NativeTabs.Trigger>
        </NativeTabs>
      </View>
    </AnimatedScrollListProvider>
  );
}
