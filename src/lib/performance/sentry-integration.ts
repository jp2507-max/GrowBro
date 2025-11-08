/**
 * Sentry Performance Integration
 * Configures Sentry with performance monitoring and React Navigation instrumentation
 */

import { Env } from '@env';
import * as Sentry from '@sentry/react-native';

import { hasConsent } from '@/lib/privacy-consent';
import { beforeBreadcrumbHook, beforeSendHook } from '@/lib/sentry-utils';

import {
  PERFORMANCE_TRANSACTIONS,
  SENTRY_PERFORMANCE_CONFIG,
} from './constants';
import { createNavigationInstrumentation } from './navigation-instrumentation';

let sentryInitialized = false;

/**
 * Initialize Sentry with performance monitoring
 * Should be called once during app startup
 */
export function initializeSentryPerformance(): boolean {
  // Only initialize if DSN is provided and user has consented
  if (!Env.SENTRY_DSN || !hasConsent('crashReporting') || sentryInitialized) {
    return false;
  }

  sentryInitialized = true;

  const integrations: any[] = [];

  // Add React Navigation instrumentation for performance tracking
  if (SENTRY_PERFORMANCE_CONFIG.ENABLE_NAVIGATION_INSTRUMENTATION) {
    const navigationIntegration = createNavigationInstrumentation();
    integrations.push(navigationIntegration);
  }

  // Only add replay/feedback if enabled AND user consented to session replay
  if (Env.SENTRY_ENABLE_REPLAY && hasConsent('sessionReplay')) {
    integrations.push(Sentry.mobileReplayIntegration());
    integrations.push(Sentry.feedbackIntegration());
  }

  // Determine traces sample rate based on environment
  const tracesSampleRate =
    Env.APP_ENV === 'production'
      ? SENTRY_PERFORMANCE_CONFIG.TRACES_SAMPLE_RATE_PRODUCTION
      : SENTRY_PERFORMANCE_CONFIG.TRACES_SAMPLE_RATE_DEVELOPMENT;

  Sentry.init({
    dsn: Env.SENTRY_DSN,
    // Privacy-focused: only send PII if explicitly enabled via environment
    sendDefaultPii: Env.SENTRY_SEND_DEFAULT_PII ?? false,
    // Privacy-focused: prevent PII leakage via screenshots
    attachScreenshot: false,
    // Privacy-focused: default to 0 for replay sampling, only enable via environment
    replaysSessionSampleRate: Env.SENTRY_REPLAYS_SESSION_SAMPLE_RATE ?? 0,
    replaysOnErrorSampleRate: Env.SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE ?? 0,
    integrations,
    // Scrub sensitive data before sending to Sentry
    beforeSend: beforeSendHook,
    beforeBreadcrumb: beforeBreadcrumbHook,
    // Explicitly set environment and release
    environment: process.env.SENTRY_ENV || Env.APP_ENV || process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE || String(Env.VERSION),
    dist: process.env.SENTRY_DIST,
    // Performance monitoring configuration
    tracesSampleRate,
    profilesSampleRate: Env.APP_ENV === 'production' ? 0.1 : 1.0,
    // Enable auto instrumentation
    enableAutoSessionTracking:
      SENTRY_PERFORMANCE_CONFIG.ENABLE_AUTO_INSTRUMENTATION,
    enableNativeFramesTracking: true,
    enableStallTracking: SENTRY_PERFORMANCE_CONFIG.ENABLE_STALL_TRACKING,
    enableAppStartTracking:
      SENTRY_PERFORMANCE_CONFIG.ENABLE_APP_START_INSTRUMENTATION,
  });

  return true;
}

/**
 * Check if Sentry performance monitoring is initialized
 */
export function isSentryPerformanceInitialized(): boolean {
  return sentryInitialized;
}

/**
 * Start a performance transaction
 * Use standardized transaction names from PERFORMANCE_TRANSACTIONS
 */
export function startPerformanceTransaction(
  name: string,
  operation: string
): void {
  if (!sentryInitialized) {
    return;
  }

  Sentry.startSpan(
    {
      op: operation,
      name,
    },
    () => {
      // Span will be automatically finished when the callback completes
    }
  );
}

/**
 * Track app startup performance
 */
export function trackAppStartup(): void {
  if (!sentryInitialized) {
    return;
  }

  Sentry.startSpan(
    {
      op: 'app.startup',
      name: PERFORMANCE_TRANSACTIONS.APP_STARTUP,
    },
    () => {
      // This will be automatically tracked by Sentry's app start instrumentation
    }
  );
}

/**
 * Track sync operation performance
 */
export function trackSyncOperation(
  operation: 'pull' | 'push',
  itemCount?: number
): {
  finish: () => void;
} {
  if (!sentryInitialized) {
    return { finish: () => {} };
  }

  const transactionName =
    operation === 'pull'
      ? PERFORMANCE_TRANSACTIONS.SYNC_PULL
      : PERFORMANCE_TRANSACTIONS.SYNC_PUSH;

  let finished = false;

  void Sentry.startSpan(
    {
      op: 'sync',
      name: transactionName,
      attributes: itemCount ? { itemCount } : undefined,
    },
    async () => {
      // Wait for finish to be called
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (finished) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    }
  );

  return {
    finish: () => {
      finished = true;
    },
  };
}

/**
 * Track AI inference performance
 */
export function trackAIInference(modelName?: string): {
  finish: () => void;
} {
  if (!sentryInitialized) {
    return { finish: () => {} };
  }

  let finished = false;

  void Sentry.startSpan(
    {
      op: 'ai.infer',
      name: PERFORMANCE_TRANSACTIONS.AI_INFER,
      attributes: modelName ? { modelName } : undefined,
    },
    async () => {
      // Wait for finish to be called
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (finished) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    }
  );

  return {
    finish: () => {
      finished = true;
    },
  };
}

/**
 * Track list scroll performance
 */
export function trackListScroll(listName: string): {
  finish: () => void;
} {
  if (!sentryInitialized) {
    return { finish: () => {} };
  }

  let finished = false;

  void Sentry.startSpan(
    {
      op: 'ui.scroll',
      name: `${PERFORMANCE_TRANSACTIONS.AGENDA_SCROLL}:${listName}`,
    },
    async () => {
      // Wait for finish to be called
      await new Promise<void>((resolve) => {
        const checkInterval = setInterval(() => {
          if (finished) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
      });
    }
  );

  return {
    finish: () => {
      finished = true;
    },
  };
}
