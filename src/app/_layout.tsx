// Import  global CSS file
import '../../global.css';

import { Env } from '@env';
/* eslint-disable react-compiler/react-compiler */
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { ThemeProvider } from '@react-navigation/native';
import * as Sentry from '@sentry/react-native';
import { reactNavigationIntegration } from '@sentry/react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React from 'react';
import { StyleSheet, View } from 'react-native';
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
  SDKGate,
  startAgeGateSession,
  useAgeGate,
  useIsFirstTime,
} from '@/lib';
import {
  hasConsent,
  initializePrivacyConsent,
  setPrivacyConsent,
} from '@/lib/privacy-consent';
import { beforeSendHook } from '@/lib/sentry-utils';
// Install AI consent hooks to handle withdrawal cascades
import { installAiConsentHooks } from '@/lib/uploads/ai-images';
import { useThemeConfig } from '@/lib/use-theme-config';

import { useRootStartup } from './use-root-startup';

// Module-scoped flag to prevent multiple Sentry initializations
let sentryInitialized = false;

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

// i18n initialization moved to RootLayout component to prevent race conditions
// where components render with untranslated keys before i18n completes

// Only initialize Sentry if DSN is provided and user has consented to crash reporting
// Also guard against multiple initializations
if (Env.SENTRY_DSN && hasConsent('crashReporting') && !sentryInitialized) {
  sentryInitialized = true; // Set flag to prevent re-initialization

  const integrations: any[] = [];

  // Always add React Navigation integration for performance (TTID/TTFD)
  // SLO: TTID p95 ≤ 2s on mid-tier Android devices
  integrations.push(
    reactNavigationIntegration({ enableTimeToInitialDisplay: true })
  );

  // Only add replay/feedback if enabled AND user consented to session replay
  if (Env.SENTRY_ENABLE_REPLAY && hasConsent('sessionReplay')) {
    integrations.push(Sentry.mobileReplayIntegration());
    integrations.push(Sentry.feedbackIntegration());
  }

  Sentry.init({
    dsn: Env.SENTRY_DSN,
    // Privacy-focused: only send PII if explicitly enabled via environment
    sendDefaultPii: Env.SENTRY_SEND_DEFAULT_PII ?? false,
    // Privacy-focused: default to 0 for replay sampling, only enable via environment
    replaysSessionSampleRate: Env.SENTRY_REPLAYS_SESSION_SAMPLE_RATE ?? 0,
    replaysOnErrorSampleRate: Env.SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE ?? 0,
    integrations,
    // Scrub sensitive data before sending to Sentry
    beforeSend: beforeSendHook,
    // Explicitly set environment and release so Sentry groups events by deployment and app version.
    // Prefer CI-provided env vars, fall back to the runtime Env values.
    // Use Env.VERSION (set from app.config) as the app version/release.
    environment: process.env.SENTRY_ENV || Env.APP_ENV || process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE || String(Env.VERSION),
    // Dist helps Sentry distinguish build variants within the same release.
    // Prefer CI-provided SENTRY_DIST; can be set to EAS_BUILD_ID in CI.
    dist: process.env.SENTRY_DIST,
    // Performance & profiling sampling (env-aware)
    tracesSampleRate: Env.APP_ENV === 'production' ? 0.2 : 1.0,
    profilesSampleRate: Env.APP_ENV === 'production' ? 0.1 : 1.0,
    // uncomment the line below to enable Spotlight (https://spotlightjs.com)
    // spotlight: __DEV__,
  });

  // Update registry; this is a no-op pre-consent
  void SDKGate.initializeSDK('sentry');
}

hydrateAuth();
hydrateAgeGate();
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
  const [isI18nReady, setIsI18nReady] = React.useState(false);
  const [showConsent, setShowConsent] = React.useState(false);
  useRootStartup(setIsI18nReady, isFirstTime);

  React.useEffect(() => {
    if (ageGateStatus === 'verified' && !sessionId) {
      startAgeGateSession();
    }
  }, [ageGateStatus, sessionId]);
  React.useEffect(() => {
    if (ConsentService.isConsentRequired()) setShowConsent(true);
  }, []);

  if (!isI18nReady) return <BootSplash />;

  return (
    <Providers>
      {showConsent && (
        <ConsentModal
          isVisible
          mode={isFirstTime ? 'first-run' : 'settings-update'}
          onComplete={(c) => {
            persistConsents(c, isFirstTime);
            setShowConsent(false);
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

function BootSplash(): React.ReactElement {
  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900" />
  );
}

function AppStack(): React.ReactElement {
  return (
    <Stack>
      <Stack.Screen name="(app)" options={{ headerShown: false }} />
      <Stack.Screen name="age-gate" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
    </Stack>
  );
}

// Avoid wrapping with Sentry when Sentry is not initialized to prevent warnings
export default sentryInitialized ? Sentry.wrap(RootLayout) : RootLayout;

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
