// Import  global CSS file
import '../../global.css';

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { ThemeProvider } from '@react-navigation/native';
import * as Sentry from '@sentry/react-native';
import * as Localization from 'expo-localization';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React from 'react';
import { StyleSheet } from 'react-native';
import FlashMessage from 'react-native-flash-message';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { APIProvider } from '@/api';
import {
  hydrateAuth,
  loadSelectedTheme,
  useIsFirstTime,
  useSyncPrefs,
} from '@/lib';
import { NoopAnalytics } from '@/lib/analytics';
import { Env } from '@/lib/env';
import { registerNotificationMetrics } from '@/lib/notification-metrics';
import { hasConsent, initializePrivacyConsent } from '@/lib/privacy-consent';
import { beforeSendHook } from '@/lib/sentry-utils';
import { registerBackgroundTask } from '@/lib/sync/background-sync';
import { setupSyncTriggers } from '@/lib/sync/sync-triggers';
import { TaskNotificationService } from '@/lib/task-notifications';
import { useThemeConfig } from '@/lib/use-theme-config';

// Module-scoped flag to prevent multiple Sentry initializations
let sentryInitialized = false;

// Type definitions for Localization API
type Calendar = {
  timeZone?: string;
  [key: string]: unknown;
};

type Locale = {
  timeZone?: string;
  [key: string]: unknown;
};

// Type guards for validation
function isValidCalendarArray(calendars: unknown): calendars is Calendar[] {
  return Array.isArray(calendars) && calendars.length > 0;
}

function isValidLocaleArray(locales: unknown): locales is Locale[] {
  return Array.isArray(locales) && locales.length > 0;
}

function hasValidTimeZone(
  obj: Calendar | Locale
): obj is Calendar & { timeZone: string } {
  return typeof obj.timeZone === 'string' && obj.timeZone.length > 0;
}

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(app)',
};

// Initialize privacy consent cache before Sentry
initializePrivacyConsent();

// Only initialize Sentry if DSN is provided and user has consented to crash reporting
// Also guard against multiple initializations
if (Env.SENTRY_DSN && hasConsent('crashReporting') && !sentryInitialized) {
  sentryInitialized = true; // Set flag to prevent re-initialization

  const integrations: any[] = [];

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
    // uncomment the line below to enable Spotlight (https://spotlightjs.com)
    // spotlight: __DEV__,
  });
}

hydrateAuth();
loadSelectedTheme();
// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();
// Set splash screen animation options at runtime
SplashScreen.setOptions({ duration: 500, fade: true });

function getCurrentTimeZone(): string {
  try {
    const calendars = Localization.getCalendars?.();
    if (isValidCalendarArray(calendars) && hasValidTimeZone(calendars[0])) {
      return calendars[0].timeZone;
    }
  } catch (error) {
    console.warn('Failed to get timezone from calendars:', error);
  }

  try {
    const locales = Localization.getLocales?.();
    if (isValidLocaleArray(locales) && hasValidTimeZone(locales[0])) {
      return locales[0].timeZone;
    }
  } catch (error) {
    console.warn('Failed to get timezone from locales:', error);
  }

  // Try to read Localization.timezone as additional fallback
  try {
    const timezone = (Localization as any).timezone;
    if (typeof timezone === 'string' && timezone.length > 0) {
      // Optional: Basic validation for plausible timezone format
      // Common formats: 'America/New_York', 'UTC', 'GMT+1', 'Europe/London', etc.
      const timezonePattern = /^[A-Za-z][A-Za-z0-9/_+-]+$/;
      if (timezonePattern.test(timezone)) {
        return timezone;
      } else {
        console.warn(
          'Invalid timezone format from Localization.timezone:',
          timezone
        );
      }
    } else {
      console.warn(
        'Localization.timezone is not a valid non-empty string:',
        timezone
      );
    }
  } catch (error) {
    console.warn('Failed to read Localization.timezone:', error);
  }

  // Fallback to 'UTC' if nothing else available
  return 'UTC';
}

function RootLayout(): React.ReactElement {
  const [isFirstTime] = useIsFirstTime();
  // Hydrate sync preferences once
  const hydratePrefs = useSyncPrefs.use.hydrate();
  React.useEffect(() => {
    // hydrate prefs at app start
    try {
      hydratePrefs?.();
    } catch {}
    // Guard: avoid interrupting first-time onboarding flow
    const svc = new TaskNotificationService();
    if (!isFirstTime) {
      // Request notification permissions on app start (Android 13+ runtime)
      void svc.requestPermissions();
    }
    // Differentially re-plan notifications on app start
    void svc.rehydrateNotifications();

    // Watch timezone offset changes (DST/zone change). Polling approach to avoid new deps.
    let lastTz = getCurrentTimeZone();
    const interval = setInterval(() => {
      const currentTz = getCurrentTimeZone();
      if (currentTz !== lastTz) {
        lastTz = currentTz;
        void svc.rehydrateNotifications();
      }
    }, 60 * 1000); // check every minute

    return () => clearInterval(interval);
  }, [isFirstTime, hydratePrefs]);

  React.useEffect(() => {
    const start = Date.now();
    requestAnimationFrame(() => {
      const firstPaintMs = Date.now() - start;
      void NoopAnalytics.track('perf_first_paint_ms', { ms: firstPaintMs });
    });
  }, []);

  React.useEffect(() => {
    // Register background sync task (best-effort; OS schedules execution)
    void registerBackgroundTask();
    // Set up foreground/connectivity sync triggers
    const dispose = setupSyncTriggers();

    const start = Date.now();
    const cleanup = registerNotificationMetrics();
    const coldStartTimer = setTimeout(() => {
      void NoopAnalytics.track('perf_cold_start_ms', {
        ms: Date.now() - start,
      });
    }, 0);
    return () => {
      clearTimeout(coldStartTimer);
      cleanup();
      dispose();
    };
  }, []);

  return (
    <Providers>
      <Stack>
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack>
    </Providers>
  );
}

export default Sentry.wrap(RootLayout);

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
