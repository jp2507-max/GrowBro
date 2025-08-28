// Import  global CSS file
import '../../global.css';

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { ThemeProvider } from '@react-navigation/native';
import * as Sentry from '@sentry/react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React from 'react';
import { StyleSheet } from 'react-native';
import FlashMessage from 'react-native-flash-message';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { APIProvider } from '@/api';
import { hydrateAuth, loadSelectedTheme } from '@/lib';
import { Env } from '@/lib/env';
import { initializePrivacyConsent } from '@/lib/privacy-consent';
import { beforeSendHook } from '@/lib/sentry-utils';
import { useThemeConfig } from '@/lib/use-theme-config';

// Only initialize Sentry if DSN is provided
if (Env.SENTRY_DSN) {
  const integrations: any[] = [];

  // Only add replay and feedback integrations if replay is enabled
  if (Env.SENTRY_ENABLE_REPLAY) {
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

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(app)',
};

hydrateAuth();
loadSelectedTheme();
initializePrivacyConsent();
// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();
// Set the animation options. This is optional.
SplashScreen.setOptions({
  duration: 500,
  fade: true,
});

function RootLayout() {
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

function Providers({ children }: { children: React.ReactNode }) {
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
