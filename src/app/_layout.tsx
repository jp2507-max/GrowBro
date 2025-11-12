// Import  global CSS file
import '../../global.css';

import { Env } from '@env';
/* eslint-disable react-compiler/react-compiler */
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { ThemeProvider } from '@react-navigation/native';
import * as Sentry from '@sentry/react-native';
// Setup Buffer polyfill for React Native
import { Buffer } from 'buffer';
import console from 'console';
import { Stack, usePathname, useRouter } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import FlashMessage from 'react-native-flash-message';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { APIProvider } from '@/api';
import { ConsentModal } from '@/components/consent-modal';
import {
  ConsentService,
  hydrateAgeGate,
  hydrateAuth,
  loadSelectedTheme,
  resetAgeGate,
  SDKGate,
  setAnalyticsClient,
  startAgeGateSession,
  useAgeGate,
  useIsFirstTime,
} from '@/lib';
import { NoopAnalytics } from '@/lib/analytics';
import { initAuthStorage } from '@/lib/auth/auth-storage';
import { registerKeyRotationTask } from '@/lib/auth/key-rotation-task';
import {
  useOfflineModeMonitor,
  useRealtimeSessionRevocation,
  useSessionAutoRefresh,
} from '@/lib/auth/session-manager';
import { updateActivity } from '@/lib/auth/session-timeout';
import { useDeepLinking } from '@/lib/auth/use-deep-linking';
import {
  checkLegalVersionBumps,
  hydrateLegalAcceptances,
  resetLegalAcceptances,
} from '@/lib/compliance/legal-acceptances';
import {
  completeOnboardingStep,
  getOnboardingStatus,
  hydrateOnboardingState,
  ONBOARDING_VERSION,
  resetOnboardingState,
  shouldShowOnboarding,
  useOnboardingState,
} from '@/lib/compliance/onboarding-state';
import { trackOnboardingStart } from '@/lib/compliance/onboarding-telemetry';
import { useRootStartup } from '@/lib/hooks/use-root-startup';
import { initializeJanitor } from '@/lib/media/photo-janitor';
import { getReferencedPhotoUris } from '@/lib/media/photo-storage-helpers';
import {
  initializeSentryPerformance,
  isSentryPerformanceInitialized,
} from '@/lib/performance';
import {
  initializePrivacyConsent,
  setPrivacyConsent,
} from '@/lib/privacy-consent';
// Install AI consent hooks to handle withdrawal cascades
import { installAiConsentHooks } from '@/lib/uploads/ai-images';
import { useThemeConfig } from '@/lib/use-theme-config';
global.Buffer = global.Buffer ?? Buffer;

// Type definitions for Localization API
// Timezone and startup helpers live in `use-root-startup.ts`

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(app)',
};

// Initialize privacy consent cache before Sentry
initializePrivacyConsent();

// Register known SDKs and install a minimal safety net to ensure zero-traffic pre-consent
SDKGate.registerSDK('sentry', 'crashDiagnostics', [
  'sentry.io',
  'ingest.sentry.io',
]);
SDKGate.registerSDK('analytics', 'telemetry', [
  'analytics',
  'segment',
  'amplitude',
]);
SDKGate.installNetworkSafetyNet?.();
installAiConsentHooks();

// Initialize analytics registry with noop client to ensure zero traffic before consent
setAnalyticsClient(NoopAnalytics);

// i18n initialization moved to RootLayout component to prevent race conditions
// where components render with untranslated keys before i18n completes

// Initialize Sentry with performance monitoring
const sentryInitialized = initializeSentryPerformance();

if (sentryInitialized) {
  // Update registry; this is a no-op pre-consent
  void SDKGate.initializeSDK('sentry');

  // Configure auth-specific Sentry filtering for consent-aware error handling
  import('@/lib/auth/auth-telemetry')
    .then(({ configureSentryAuthFilter }) => {
      configureSentryAuthFilter();
    })
    .catch((error) => {
      console.error('auth telemetry configuration failed:', error);
      Sentry.captureException(error);
    });
}

// Initialize auth storage before hydrating auth state
// Moved to RootLayout component to prevent module-level side effects
loadSelectedTheme();
// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();
// Set splash screen animation options at runtime
SplashScreen.setOptions({ duration: 500, fade: true });

// Timezone and startup logic moved to `use-root-startup.ts`

function RootLayout(): React.ReactElement {
  const [isFirstTime] = useIsFirstTime();
  const ageGateStatus = useAgeGate.status();
  const sessionId = useAgeGate.sessionId();
  const onboardingStatus = useOnboardingState.status();
  const [isI18nReady, setIsI18nReady] = React.useState(false);
  const [isAuthReady, setIsAuthReady] = React.useState(false);
  const [showConsent, setShowConsent] = React.useState(false);
  const router = useRouter();
  const pathname = usePathname();
  useRootStartup(setIsI18nReady, isFirstTime);
  useSessionAutoRefresh();
  useOfflineModeMonitor();

  React.useEffect(() => {
    registerKeyRotationTask().catch((error) => {
      console.warn(
        '[RootLayout] Key rotation task registration failed:',
        error
      );
    });
  }, []);

  React.useEffect(() => {
    if (!Env.GOOGLE_WEB_CLIENT_ID) {
      return;
    }

    GoogleSignin.configure({
      webClientId: Env.GOOGLE_WEB_CLIENT_ID,
      ...(Env.GOOGLE_IOS_CLIENT_ID
        ? { iosClientId: Env.GOOGLE_IOS_CLIENT_ID }
        : {}),
    });
  }, []);

  // Initialize auth storage and hydrate auth state
  React.useEffect(() => {
    initializeAuthAndStates()
      .then(() => setIsAuthReady(true))
      .catch((error) => {
        console.error(
          '[RootLayout] Auth storage initialization failed:',
          error
        );
        setIsAuthReady(true);
      });
  }, []);

  // Check for legal version bumps and redirect to age-gate if needed
  React.useEffect(() => {
    if (!isAuthReady) return;

    const versionCheck = checkLegalVersionBumps();
    if (versionCheck.needsBlocking) {
      // Force user to re-accept legal documents by resetting onboarding state
      // This will redirect them to age-gate where they must verify age and accept updated legal documents
      console.log(
        '[RootLayout] Legal version bump detected, resetting onboarding to require re-acceptance'
      );
      resetAgeGate();
      resetLegalAcceptances();
      resetOnboardingState();
      // Navigate to age-gate to force re-acceptance flow, but avoid redirect loops
      if (pathname !== '/age-gate') {
        router.replace('/age-gate');
      }
    }
  }, [isAuthReady, router, pathname]);

  // Onboarding entry guard: route first-time users and version bump re-shows
  React.useEffect(() => {
    if (!isI18nReady || !isAuthReady) return;

    // Skip onboarding routing if we're on excluded paths
    const excludedPaths = ['/age-gate', '/login', '/sign-up'];
    if (excludedPaths.some((path) => pathname.startsWith(path))) return;

    // Check if we should show onboarding
    const needsOnboarding = shouldShowOnboarding();
    const currentStatus = getOnboardingStatus();

    if (needsOnboarding) {
      // Determine the source of onboarding trigger
      const source =
        currentStatus === 'not-started'
          ? 'first_run'
          : currentStatus === 'completed'
            ? 'version_bump'
            : 'first_run';

      // Track onboarding start
      trackOnboardingStart(source);

      console.log(
        `[RootLayout] Onboarding needed (v${ONBOARDING_VERSION}), source: ${source}, status: ${currentStatus}`
      );

      // Navigate to age-gate (first step of onboarding)
      if (pathname !== '/age-gate' && pathname !== '/onboarding') {
        router.replace('/age-gate');
      }
    }
  }, [isI18nReady, isAuthReady, pathname, router, onboardingStatus]);

  // Initialize deep linking for auth flows
  useDeepLinking();

  // Real-time session revocation monitoring
  useRealtimeSessionRevocation();

  React.useEffect(() => {
    if (ageGateStatus === 'verified' && !sessionId) {
      startAgeGateSession();
    }
  }, [ageGateStatus, sessionId]);

  React.useEffect(() => {
    if (ConsentService.isConsentRequired()) setShowConsent(true);
  }, []);

  React.useEffect(() => {
    // Prevent screenshots/screen recordings on iOS to mirror Android FLAG_SECURE
    const setupScreenCapture = async () => {
      if (Platform.OS === 'ios') {
        try {
          await ScreenCapture.preventScreenCaptureAsync();
        } catch (error) {
          console.warn('[RootLayout] Failed to prevent screen capture:', error);
        }
      }
    };

    setupScreenCapture();

    return () => {
      const cleanupScreenCapture = async () => {
        if (Platform.OS === 'ios') {
          try {
            await ScreenCapture.allowScreenCaptureAsync();
          } catch (error) {
            console.warn(
              '[RootLayout] Failed to re-enable screen capture:',
              error
            );
          }
        }
      };

      cleanupScreenCapture();
    };
  }, []);

  // Initialize photo storage janitor on app start
  React.useEffect(() => {
    if (isI18nReady) {
      getReferencedPhotoUris()
        .then((referencedUris) => {
          initializeJanitor(undefined, referencedUris);
        })
        .catch((error) => {
          console.error('[RootLayout] Janitor initialization failed:', error);
        });
    }
  }, [isI18nReady]);

  if (!isI18nReady || !isAuthReady) return <BootSplash />;

  return (
    <Providers>
      {showConsent && (
        <ConsentModal
          isVisible
          mode={isFirstTime ? 'first-run' : 'settings-update'}
          onComplete={(c) => {
            persistConsents(c, isFirstTime);
            setShowConsent(false);
            // After consent during first-run, complete the consent step
            // This will trigger navigation to permission primers
            if (isFirstTime) {
              completeOnboardingStep('consent-modal');
            }
          }}
        />
      )}
      <AppStack />
    </Providers>
  );
}

function persistConsents(
  c: {
    telemetry: boolean;
    experiments: boolean;
    aiTraining: boolean;
    crashDiagnostics: boolean;
  },
  isFirstTime: boolean
): void {
  const meta = {
    uiSurface: isFirstTime ? 'first-run' : 'settings',
    policyVersion: ConsentService.getConsentVersion(),
    controllerIdentity: 'GrowBro',
    lawfulBasis: 'consent-6.1.a',
    justificationId: 'POL-GBR-2025-001',
    region: 'EU',
  } as const;

  void ConsentService.setConsents(
    {
      telemetry: c.telemetry,
      experiments: c.experiments,
      aiTraining: c.aiTraining,
      crashDiagnostics: c.crashDiagnostics,
    },
    meta
  );
  setPrivacyConsent({
    analytics: c.telemetry,
    crashReporting: c.crashDiagnostics,
    personalizedData: false,
    sessionReplay: false,
  });
}

// Helper to initialize auth storage and hydrate states
async function initializeAuthAndStates(): Promise<void> {
  await initAuthStorage();
  await hydrateAuth();
  hydrateAgeGate();
  hydrateLegalAcceptances();
  hydrateOnboardingState();
}

function BootSplash(): React.ReactElement {
  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900" />
  );
}

function AppStack(): React.ReactElement {
  const pathname = usePathname();

  useEffect(() => {
    updateActivity();
  }, [pathname]);

  return (
    <Stack>
      <Stack.Screen name="(app)" options={{ headerShown: false }} />
      <Stack.Screen name="(modals)" options={{ headerShown: false }} />
      <Stack.Screen name="age-gate" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen
        name="notification-primer"
        options={{ headerShown: false }}
      />
      <Stack.Screen name="camera-primer" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
    </Stack>
  );
}

// Avoid wrapping with Sentry when Sentry is not initialized to prevent warnings
export default isSentryPerformanceInitialized()
  ? Sentry.wrap(RootLayout)
  : RootLayout;

interface ProvidersProps {
  children: React.ReactNode;
}

function Providers({ children }: ProvidersProps): React.ReactElement {
  const theme = useThemeConfig();
  return (
    <GestureHandlerRootView
      style={styles.container}
      className={theme.dark ? `dark` : undefined}
    >
      <KeyboardProvider>
        <ThemeProvider value={theme}>
          <APIProvider>
            <BottomSheetModalProvider>
              {children}
              <FlashMessage position="top" />
            </BottomSheetModalProvider>
          </APIProvider>
        </ThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

// (previous helper utilities were moved to use-root-startup.ts)
