/**
 * Privacy Consent Runtime Mapping
 * Controls SDK initialization and behavior based on user consent
 *
 * Requirement: 5.4
 */

import * as Sentry from '@sentry/react-native';

import { hasConsent } from '@/lib/privacy-consent';

let sentryInitialized = false;

/**
 * Initialize or disable Sentry based on crash reporting consent
 */
export async function syncSentryConsent(): Promise<void> {
  const hasCrashConsent = hasConsent('crashReporting');

  if (hasCrashConsent && !sentryInitialized) {
    // Sentry is initialized at app startup
    // Just mark as initialized if consent is given
    sentryInitialized = true;
  } else if (!hasCrashConsent && sentryInitialized) {
    // Disable Sentry
    await disableSentry();
    sentryInitialized = false;
  }
}

/**
 * Disable Sentry crash reporting
 * Flushes pending events and closes the client
 */
async function disableSentry(): Promise<void> {
  try {
    // Flush any pending events
    await Sentry.flush();

    // Close the client
    await Sentry.close();

    // Set user to null
    Sentry.setUser(null);

    console.log('[PrivacyRuntime] Sentry disabled');
  } catch (error) {
    console.error('[PrivacyRuntime] Failed to disable Sentry:', error);
  }
}

/**
 * Track event with analytics if consent is given
 * Falls back to no-op if consent is not given
 */
export function trackIfConsented(
  event: string,
  _data?: Record<string, unknown>
): void {
  const hasAnalyticsConsent = hasConsent('analytics');

  if (!hasAnalyticsConsent) {
    // Use NoopAnalytics
    return;
  }

  // In production, this would call the real analytics client
  // For now, just log in development
  if (__DEV__) {
    console.log('[PrivacyRuntime] Track event:', event);
  }
}

/**
 * Capture exception with Sentry if consent is given
 */
export function captureExceptionIfConsented(
  error: Error,
  context?: Record<string, unknown>
): void {
  const hasCrashConsent = hasConsent('crashReporting');

  if (!hasCrashConsent) {
    // Just log to console if consent not given
    console.error('[PrivacyRuntime] Exception (consent not given):', error);
    return;
  }

  Sentry.captureException(error, {
    contexts: context ? { custom: context } : undefined,
  });
}

/**
 * Initialize privacy runtime
 * Should be called at app startup after consent is loaded
 */
export async function initPrivacyRuntime(): Promise<void> {
  await syncSentryConsent();
}
