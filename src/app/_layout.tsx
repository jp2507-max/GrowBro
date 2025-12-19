// Import  global CSS file
import '../../global.css';

import { Env } from '@env';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { ThemeProvider } from '@react-navigation/native';
import * as Sentry from '@sentry/react-native';
// Setup Buffer polyfill for React Native
import { Buffer } from 'buffer';
import { Stack, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';
import { InteractionManager, StyleSheet, View } from 'react-native';
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
  useAuth,
  useIsFirstTime,
  useSystemThemeListener,
} from '@/lib';
import { NoopAnalytics } from '@/lib/analytics';
import { clearAuthStorage, initAuthStorage } from '@/lib/auth/auth-storage';
import { registerKeyRotationTask } from '@/lib/auth/key-rotation-task';
import {
  useOfflineModeMonitor,
  useRealtimeSessionRevocation,
  useSessionAutoRefresh,
} from '@/lib/auth/session-manager';
import { updateActivity } from '@/lib/auth/session-timeout';
import { useDeepLinking } from '@/lib/auth/use-deep-linking';
import { removeToken } from '@/lib/auth/utils';
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
import { NativeWindThemeProvider } from '@/lib/nativewind-theme-provider';
import {
  initializeSentryPerformance,
  isSentryPerformanceInitialized,
} from '@/lib/performance';
import {
  initializePrivacyConsent,
  setPrivacyConsent,
} from '@/lib/privacy-consent';
import { hydrateFavorites } from '@/lib/strains/use-favorites';
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

// Delay for filesystem initialization after interactions complete
// Ensures FileSystem native module is fully ready before photo janitor setup
const FILESYSTEM_INIT_DELAY_MS = 2000;

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

// Custom hooks to reduce RootLayout function length
function useKeyRotationSetup(): void {
  React.useEffect(() => {
    registerKeyRotationTask().catch((error) => {
      console.warn(
        '[RootLayout] Key rotation task registration failed:',
        error
      );
    });
  }, []);
}

function useGoogleSignInSetup(): void {
  React.useEffect(() => {
    if (!Env.GOOGLE_WEB_CLIENT_ID) return;
    GoogleSignin.configure({
      webClientId: Env.GOOGLE_WEB_CLIENT_ID,
      ...(Env.GOOGLE_IOS_CLIENT_ID
        ? { iosClientId: Env.GOOGLE_IOS_CLIENT_ID }
        : {}),
    });
  }, []);
}

function useAuthInitialization(setIsAuthReady: (ready: boolean) => void): void {
  React.useEffect(() => {
    if (__DEV__) console.log('[RootLayout] useAuthInitialization start');
    initializeAuthAndStates()
      .then(() => {
        if (__DEV__) console.log('[RootLayout] useAuthInitialization success');
        setIsAuthReady(true);
      })
      .catch((error) => {
        console.error(
          '[RootLayout] Auth storage initialization failed:',
          error
        );
        setIsAuthReady(true);
      });
  }, [setIsAuthReady]);
}

function useLegalVersionCheck(
  isAuthReady: boolean,
  router: ReturnType<typeof useRouter>,
  pathname: string
): void {
  // Track if we've already performed the version check to avoid repeated resets
  const hasCheckedRef = React.useRef(false);

  React.useEffect(() => {
    if (!isAuthReady) return;
    // Only check once per app session to prevent reset loops
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    const versionCheck = checkLegalVersionBumps();
    if (versionCheck.needsBlocking) {
      console.log(
        '[RootLayout] Legal version bump detected, resetting onboarding to require re-acceptance'
      );
      resetAgeGate();
      resetLegalAcceptances();
      resetOnboardingState();
      if (pathname !== '/age-gate') {
        router.replace('/age-gate');
      }
    }
  }, [isAuthReady, router, pathname]);
}

function useOnboardingRouting(options: {
  isI18nReady: boolean;
  isAuthReady: boolean;
  pathname: string;
  router: ReturnType<typeof useRouter>;
  onboardingStatus: string;
  currentStep: string;
}): void {
  const {
    isI18nReady,
    isAuthReady,
    pathname,
    router,
    onboardingStatus,
    currentStep,
  } = options;
  React.useEffect(() => {
    if (!isI18nReady || !isAuthReady) return;
    const excludedPaths = [
      '/age-gate',
      '/onboarding',
      '/login',
      '/sign-up',
      '/notification-primer',
      '/camera-primer',
    ];
    if (excludedPaths.some((path) => pathname.startsWith(path))) return;

    const needsOnboarding = shouldShowOnboarding();
    const currentStatus = getOnboardingStatus();

    // Skip redirect when consent modal is pending to avoid loop with age-gate routing
    if (needsOnboarding && currentStep !== 'consent-modal') {
      if (currentStatus === 'not-started' || currentStatus === 'completed') {
        const source =
          currentStatus === 'not-started' ? 'first_run' : 'version_bump';
        trackOnboardingStart(source);
        console.log(
          `[RootLayout] Onboarding needed (v${ONBOARDING_VERSION}), source: ${source}, status: ${currentStatus}`
        );
      }
      if (pathname !== '/age-gate') {
        router.replace('/age-gate');
      }
    }
  }, [
    isI18nReady,
    isAuthReady,
    pathname,
    router,
    onboardingStatus,
    currentStep,
  ]);
}

function useAgeGateSession(
  ageGateStatus: string,
  sessionId: string | null
): void {
  React.useEffect(() => {
    if (ageGateStatus === 'verified' && !sessionId) {
      startAgeGateSession();
    }
  }, [ageGateStatus, sessionId]);
}

function useConsentCheck(setShowConsent: (show: boolean) => void): void {
  React.useEffect(() => {
    if (ConsentService.isConsentRequired()) setShowConsent(true);
  }, [setShowConsent]);
}

// NOTE: Screen capture protection (ScreenCapture.preventScreenCaptureAsync) was intentionally
// removed. GrowBro shows only user-owned educational content (grow logs, plant photos, settings)
// with no financial data, visible passwords, or HIPAA-protected info. Blocking screenshots
// hinders development debugging and app store review workflows without meaningful security benefit.

function usePhotoJanitorSetup(isI18nReady: boolean): void {
  React.useEffect(() => {
    if (!isI18nReady) return;

    // Use AbortController for proper cancellation of async operations
    const abortController = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    // Defer janitor initialization until after all interactions complete
    // This ensures FileSystem native module is fully initialized
    const task = InteractionManager.runAfterInteractions(() => {
      // Check abort status before scheduling timeout
      if (abortController.signal.aborted) return;

      // Add additional delay to ensure FileSystem is ready
      timeoutId = setTimeout(() => {
        // Check abort status again before executing async work
        if (abortController.signal.aborted) return;

        getReferencedPhotoUris()
          .then((referencedUris) => {
            // Final abort check before initialization
            if (abortController.signal.aborted) return;
            initializeJanitor(undefined, referencedUris);
          })
          .catch((error) => {
            // Only log if not aborted to avoid noise during cleanup
            if (!abortController.signal.aborted) {
              console.error(
                '[RootLayout] Janitor initialization failed:',
                error
              );
            }
          });
      }, FILESYSTEM_INIT_DELAY_MS);
    });

    // Cleanup on abort - clear timeout immediately when aborted
    const abortHandler = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };
    abortController.signal.addEventListener('abort', abortHandler);

    return () => {
      // Abort first to signal all pending operations to stop
      abortController.abort();
      // Cancel the interaction task if it hasn't started yet
      task?.cancel?.();
      // Clear timeout as backup (abort handler should have done this already)
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, [isI18nReady]);
}

function RootLayout(): React.ReactElement {
  const [isFirstTime] = useIsFirstTime();

  // eslint-disable-next-line react-compiler/react-compiler -- createSelectors generates hooks as methods
  const ageGateStatus = useAgeGate.status();
  // eslint-disable-next-line react-compiler/react-compiler -- createSelectors generates hooks as methods
  const sessionId = useAgeGate.sessionId();
  // eslint-disable-next-line react-compiler/react-compiler -- createSelectors generates hooks as methods
  const onboardingStatus = useOnboardingState.status();
  // eslint-disable-next-line react-compiler/react-compiler -- createSelectors generates hooks as methods
  const currentOnboardingStep = useOnboardingState.currentStep();
  const [isI18nReady, setIsI18nReady] = React.useState(false);
  const [isAuthReady, setIsAuthReady] = React.useState(false);
  const [showConsent, setShowConsent] = React.useState(false);
  const hasHiddenSplashRef = React.useRef(false);
  const router = useRouter();
  const pathname = usePathname();

  if (__DEV__) {
    console.log('[RootLayout] render', {
      isI18nReady,
      isAuthReady,
      pathname,
    });
  }

  useRootStartup(setIsI18nReady, isFirstTime);
  useSessionAutoRefresh();
  useOfflineModeMonitor();
  useDeepLinking();
  useRealtimeSessionRevocation();
  useKeyRotationSetup();
  useGoogleSignInSetup();
  useAuthInitialization(setIsAuthReady);
  useLegalVersionCheck(isAuthReady, router, pathname);
  useOnboardingRouting({
    isI18nReady,
    isAuthReady,
    pathname,
    router,
    onboardingStatus,
    currentStep: currentOnboardingStep,
  });
  useAgeGateSession(ageGateStatus, sessionId);
  useConsentCheck(setShowConsent);
  usePhotoJanitorSetup(isI18nReady);

  React.useEffect(() => {
    if (!isI18nReady || !isAuthReady || hasHiddenSplashRef.current) return;

    hasHiddenSplashRef.current = true;
    void SplashScreen.hideAsync().catch((error) => {
      console.warn('[RootLayout] Failed to hide splash screen:', error);
    });
  }, [isI18nReady, isAuthReady]);

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
            // Only advance onboarding if we're currently in the consent-modal step
            // This prevents rewinding onboarding when re-confirming consent from Settings
            if (currentOnboardingStep === 'consent-modal') {
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

// Timeout for auth hydration - 5s is generous for token check + signIn
const HYDRATE_AUTH_TIMEOUT_MS = 5000;

// Helper to initialize auth storage and hydrate states
async function initializeAuthAndStates(): Promise<void> {
  if (__DEV__) console.log('[RootLayout] initializeAuthAndStates: start');
  await initAuthStorage();
  if (__DEV__) console.log('[RootLayout] after initAuthStorage');

  const abortController = new AbortController();

  // Cleanup helper - clears auth state if not already signed in
  const executeCleanup = async (reason: string): Promise<void> => {
    if (useAuth.getState().status === 'signIn') {
      if (__DEV__) console.log(`[RootLayout] ${reason} but signed in, skip`);
      return;
    }
    console.warn(`[RootLayout] ${reason}; clearing auth state`);
    await clearAuthStorage();
    removeToken();
  };

  // Hydration promise - aborts timeout on completion (success or failure)
  const hydratePromise = (async () => {
    try {
      await hydrateAuth();
      if (__DEV__) console.log('[RootLayout] hydrateAuth completed');
    } catch (error) {
      console.error('[RootLayout] hydrateAuth error', error);
      await executeCleanup('hydrateAuth failed');
    } finally {
      abortController.abort();
    }
  })();

  // Timeout promise - runs cleanup if hydration takes too long
  const timeoutPromise = new Promise<void>((resolve) => {
    const timeoutId = setTimeout(async () => {
      if (abortController.signal.aborted) {
        resolve();
        return;
      }
      await executeCleanup(
        `hydrateAuth timeout after ${HYDRATE_AUTH_TIMEOUT_MS}ms`
      );
      resolve();
    }, HYDRATE_AUTH_TIMEOUT_MS);

    // Cancel timeout if hydration completes first
    abortController.signal.addEventListener('abort', () => {
      clearTimeout(timeoutId);
      resolve();
    });
  });

  // Race hydration against timeout - unblocks startup on whichever finishes first
  await Promise.race([hydratePromise, timeoutPromise]);
  if (__DEV__) console.log('[RootLayout] after hydrateAuth (race)');

  hydrateAgeGate();
  hydrateLegalAcceptances();
  hydrateOnboardingState();

  // Hydrate favorites from local DB so heart icons show correctly on first render
  await hydrateFavorites();
  if (__DEV__) console.log('[RootLayout] initializeAuthAndStates: done');
}

function BootSplash(): React.ReactElement {
  return <View className="flex-1 items-center justify-center bg-background" />;
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
      <Stack.Screen name="plants" options={{ headerShown: false }} />
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
  // Listen for device theme changes when user has 'system' mode selected
  useSystemThemeListener();
  return (
    <GestureHandlerRootView
      style={styles.container}
      className={theme.dark ? `dark` : undefined}
    >
      <NativeWindThemeProvider>
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
      </NativeWindThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

// (previous helper utilities were moved to use-root-startup.ts)
