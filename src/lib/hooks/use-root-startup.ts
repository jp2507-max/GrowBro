import * as Localization from 'expo-localization';
import React from 'react';

import { retentionWorker, useSyncPrefs } from '@/lib';
import { NoopAnalytics } from '@/lib/analytics';
import { getAnalyticsClient } from '@/lib/analytics-registry';
import { registerNotificationMetrics } from '@/lib/notification-metrics';
import { startUiResponsivenessMonitor } from '@/lib/perf/ui-responsiveness-monitor';
import { consentManager } from '@/lib/privacy/consent-manager';
import { setDeletionAdapter } from '@/lib/privacy/deletion-adapter';
import { createSupabaseDeletionAdapter } from '@/lib/privacy/deletion-adapter-supabase';
import { refreshQualityThresholds } from '@/lib/quality/remote-config';
import { registerBackgroundTask } from '@/lib/sync/background-sync';
import { setupSyncTriggers } from '@/lib/sync/sync-triggers';
import { TaskNotificationService } from '@/lib/task-notifications';

type LocalizationWithTimeZone = typeof Localization & { timezone?: string };

export function getCurrentTimeZone(): string {
  try {
    const calendars = Localization.getCalendars?.();
    if (Array.isArray(calendars) && calendars.length > 0) {
      const calendar = calendars[0];
      if (calendar && typeof calendar === 'object' && 'timeZone' in calendar) {
        const timeZone = calendar.timeZone;
        if (typeof timeZone === 'string') {
          return timeZone;
        }
      }
    }
  } catch {
    // fallback
  }

  try {
    const locales = Localization.getLocales?.();
    if (Array.isArray(locales) && locales.length > 0) {
      const locale = locales[0];
      if (locale && typeof locale === 'object' && 'timeZone' in locale) {
        const timeZone = locale.timeZone;
        if (typeof timeZone === 'string') {
          return timeZone;
        }
      }
    }
  } catch {
    // fallback
  }

  try {
    const localizationExt = Localization as LocalizationWithTimeZone;
    const timezone = localizationExt.timezone;
    if (typeof timezone === 'string' && timezone.length > 0) {
      const timezonePattern = /^[A-Za-z][A-Za-z0-9/._+-]+$/;
      if (timezonePattern.test(timezone)) return timezone;
    }
  } catch {
    // fallback
  }

  return 'UTC';
}

function useSyncAndMetrics(): void {
  React.useEffect(() => {
    registerBackgroundTask().catch((error) => {
      console.warn(
        '[use-root-startup] Background task registration failed (may require iOS configuration):',
        error
      );
    });
    const dispose = setupSyncTriggers();
    const start = Date.now();

    // IMPORTANT: registerNotificationMetrics installs listeners that emit
    // telemetry via NoopAnalytics.track for notification events. These
    // listeners must not be registered before the user has given analytics
    // consent, otherwise an actual analytics client wired in place of
    // NoopAnalytics would record events prior to opt-in. We subscribe to
    // consent changes so listeners are added when consent is granted and
    // removed again if consent is withdrawn during the app lifetime.

    let cleanupNotificationMetrics: (() => void) | undefined;
    let coldStartTimer: ReturnType<typeof setTimeout> | undefined;
    let coldStartTracked = false; // ensure we track the cold start metric at most once
    let cleanupUiMonitor: (() => void) | undefined;

    function registerMetricsOnce() {
      if (!cleanupNotificationMetrics) {
        cleanupNotificationMetrics = registerNotificationMetrics();
      }
      if (!cleanupUiMonitor) {
        cleanupUiMonitor = startUiResponsivenessMonitor({
          analytics: getAnalyticsClient(),
          isTrackingEnabled: () => consentManager.hasConsented('analytics'),
        });
      }
      if (!coldStartTracked) {
        coldStartTimer = setTimeout(() => {
          void NoopAnalytics.track('perf_cold_start_ms', {
            ms: Date.now() - start,
          });
          coldStartTracked = true;
          coldStartTimer = undefined;
        }, 0);
      }
    }

    function unregisterMetrics() {
      try {
        cleanupNotificationMetrics?.();
      } catch {}
      cleanupNotificationMetrics = undefined;
      try {
        cleanupUiMonitor?.();
      } catch {}
      cleanupUiMonitor = undefined;
      if (coldStartTimer) {
        clearTimeout(coldStartTimer);
        coldStartTimer = undefined;
      }
    }

    // Initialize based on current consent state
    if (consentManager.hasConsented('analytics')) {
      registerMetricsOnce();
    }

    // Subscribe to consent changes so we can add/remove listeners at runtime
    const unsubscribe = consentManager.onConsentChanged(
      'analytics',
      (consented) => {
        try {
          if (consented) registerMetricsOnce();
          else unregisterMetrics();
        } catch {}
      }
    );

    return () => {
      // cleanup subscription and any registered metrics/listeners
      try {
        unsubscribe();
      } catch {}
      unregisterMetrics();
      dispose();
    };
  }, []);
}

function startRootInitialization(
  setIsI18nReady: (v: boolean) => void,
  isFirstTime: boolean,
  hydratePrefs?: (() => void) | undefined
): () => void {
  // This function contains the implementation that was previously an
  // inline effect in `useRootStartup`. Extracting it reduces the size of
  // `useRootStartup` to satisfy the repository lint rule about function
  // length while keeping behavior identical.
  let isMounted = true;
  let svc: TaskNotificationService | undefined;
  let interval: ReturnType<typeof setInterval> | undefined;

  const initialize = async (): Promise<void> => {
    let applyRTLIfNeeded: (() => void) | undefined;
    let refreshIsRTL: (() => void) | undefined;
    let i18nInitSucceeded = false;
    void refreshQualityThresholds().catch((error) => {
      console.warn('[RootStartup] Failed to refresh quality thresholds', error);
    });
    try {
      const i18nModule = await import('@/lib/i18n');
      await i18nModule.initI18n();
      i18nInitSucceeded = true;
      applyRTLIfNeeded = i18nModule.applyRTLIfNeeded;
      refreshIsRTL = i18nModule.refreshIsRTL;
    } catch {
      // non-fatal
    } finally {
      if (isMounted) {
        refreshIsRTL?.();
        applyRTLIfNeeded?.();
        setIsI18nReady(true);
      }
    }
    // Additional safety: ensure component still mounted before creating service
    if (!isMounted) return;
    // NOTE: There's a race between i18n initialization and showing the
    // permission prompt. Only call requestPermissions when i18n init
    // succeeded so the prompt can show localized strings.
    svc = new TaskNotificationService();
    if (i18nInitSucceeded && !isFirstTime) void svc.requestPermissions();
    void svc.rehydrateNotifications();

    // Rehydrate harvest notifications (Requirement 14.3)
    try {
      const { rehydrateNotifications: rehydrateHarvestNotifications } =
        await import('@/lib/harvest/harvest-notification-service');
      void rehydrateHarvestNotifications();
    } catch {
      // non-fatal
    }

    if (!isMounted) return;

    let lastTz = getCurrentTimeZone();
    interval = setInterval(() => {
      const currentTz = getCurrentTimeZone();
      if (currentTz !== lastTz) {
        lastTz = currentTz;
        void svc?.rehydrateNotifications();
        // Also rehydrate harvest notifications on timezone change
        void import('@/lib/harvest/harvest-notification-service').then(
          ({ rehydrateNotifications }) => rehydrateNotifications()
        );
      }
    }, 60 * 1000);
  };

  void initialize();

  try {
    hydratePrefs?.();
  } catch {
    // ignore
  }

  return () => {
    isMounted = false;
    if (interval) clearInterval(interval);
  };
}

export function useRootStartup(
  setIsI18nReady: (v: boolean) => void,
  isFirstTime: boolean
): void {
  const hydratePrefs = useSyncPrefs.use.hydrate();

  React.useEffect(() => {
    const cleanup = startRootInitialization(
      setIsI18nReady,
      isFirstTime,
      hydratePrefs
    );

    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, [isFirstTime, hydratePrefs, setIsI18nReady]);

  React.useEffect(() => {
    const start = Date.now();
    requestAnimationFrame(() => {
      const firstPaintMs = Date.now() - start;
      // Only track performance metrics if user has consented to analytics
      if (consentManager.hasConsented('analytics')) {
        void NoopAnalytics.track('perf_first_paint_ms', { ms: firstPaintMs });
      }
    });
  }, []);

  useSyncAndMetrics();

  // Fire-and-forget: run retention daily (simple 24h interval)
  React.useEffect(() => {
    // Wire deletion adapter to Supabase buckets for cascades
    try {
      setDeletionAdapter(createSupabaseDeletionAdapter());
    } catch {}
    const run = () => {
      void retentionWorker.runNow().catch(() => {});
    };
    // initial run at app start
    run();
    const dayMs = 24 * 60 * 60 * 1000;
    const id = setInterval(run, dayMs);
    return () => clearInterval(id);
  }, []);
}
