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
): { finish: () => void } {
  if (!sentryInitialized) {
    return { finish: () => {} };
  }

  const span = Sentry.startInactiveSpan({
    op: operation,
    name,
  });

  return {
    finish: () => {
      span?.end();
    },
  };
}

/**
 * Creates a promise-based latch that can be resolved externally with timeout protection
 */
function createFinishPromise(): {
  finishPromise: Promise<void>;
  resolveFinish: () => void;
  cleanup: () => void;
} {
  let resolveFinish: (() => void) | null = null;
  let timeoutId: NodeJS.Timeout | null = null;

  const finishPromise = new Promise<void>((resolve) => {
    resolveFinish = resolve;
  });

  // Add timeout to ensure promise always resolves
  const timeoutPromise = new Promise<void>((resolve) => {
    timeoutId = setTimeout(resolve, SENTRY_PERFORMANCE_CONFIG.SPAN_TIMEOUT_MS);
  });

  // Race between finish being called and timeout
  const finalPromise = Promise.race([finishPromise, timeoutPromise]);

  return {
    finishPromise: finalPromise,
    resolveFinish: () => {
      if (resolveFinish) {
        resolveFinish();
        resolveFinish = null;
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },
    cleanup: () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      resolveFinish = null;
    },
  };
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

  const { finishPromise, resolveFinish, cleanup } = createFinishPromise();

  void Sentry.startSpan(
    {
      op: 'sync',
      name: transactionName,
      attributes: itemCount ? { itemCount } : undefined,
    },
    async () => {
      await finishPromise;
    }
  );

  let finished = false;
  return {
    finish: () => {
      if (!finished) {
        finished = true;
        resolveFinish();
        cleanup();
      }
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

  const { finishPromise, resolveFinish, cleanup } = createFinishPromise();

  void Sentry.startSpan(
    {
      op: 'ai.infer',
      name: PERFORMANCE_TRANSACTIONS.AI_INFER,
      attributes: modelName ? { modelName } : undefined,
    },
    async () => {
      await finishPromise;
    }
  );

  let finished = false;
  return {
    finish: () => {
      if (!finished) {
        finished = true;
        resolveFinish();
        cleanup();
      }
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

  const { finishPromise, resolveFinish, cleanup } = createFinishPromise();

  void Sentry.startSpan(
    {
      op: 'ui.scroll',
      name: `${PERFORMANCE_TRANSACTIONS.AGENDA_SCROLL}:${listName}`,
    },
    async () => {
      await finishPromise;
    }
  );

  let finished = false;
  return {
    finish: () => {
      if (!finished) {
        finished = true;
        resolveFinish();
        cleanup();
      }
    },
  };
}
