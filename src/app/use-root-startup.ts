import * as Localization from 'expo-localization';
import * as SplashScreen from 'expo-splash-screen';
import React from 'react';

import { useSyncPrefs } from '@/lib';
import { NoopAnalytics } from '@/lib/analytics';
import { registerNotificationMetrics } from '@/lib/notification-metrics';
import { registerBackgroundTask } from '@/lib/sync/background-sync';
import { setupSyncTriggers } from '@/lib/sync/sync-triggers';
import { TaskNotificationService } from '@/lib/task-notifications';

export function getCurrentTimeZone(): string {
  try {
    const calendars = Localization.getCalendars?.();
    if (
      Array.isArray(calendars) &&
      calendars.length > 0 &&
      typeof (calendars[0] as any).timeZone === 'string'
    ) {
      return (calendars[0] as any).timeZone;
    }
  } catch {
    // fallback
  }

  try {
    const locales = Localization.getLocales?.();
    if (
      Array.isArray(locales) &&
      locales.length > 0 &&
      typeof (locales[0] as any).timeZone === 'string'
    ) {
      return (locales[0] as any).timeZone;
    }
  } catch {
    // fallback
  }

  try {
    const timezone = (Localization as any).timezone;
    if (typeof timezone === 'string' && timezone.length > 0) {
      const timezonePattern = /^[A-Za-z][A-Za-z0-9/_+-]+$/;
      if (timezonePattern.test(timezone)) return timezone;
    }
  } catch {
    // fallback
  }

  return 'UTC';
}

function useSyncAndMetrics() {
  React.useEffect(() => {
    void registerBackgroundTask();
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
}

export function useRootStartup(
  setIsI18nReady: (v: boolean) => void,
  isFirstTime: boolean
) {
  const hydratePrefs = useSyncPrefs.use.hydrate();

  React.useEffect(() => {
    const initializeI18n = async () => {
      try {
        const { initI18n, applyRTLIfNeeded } = await import('@/lib/i18n');
        await initI18n();
        applyRTLIfNeeded();
        setIsI18nReady(true);
      } catch {
        // non-fatal
        setIsI18nReady(true);
      }
    };

    void initializeI18n();

    try {
      hydratePrefs?.();
    } catch {
      // ignore
    }

    const svc = new TaskNotificationService();
    if (!isFirstTime) void svc.requestPermissions();
    void svc.rehydrateNotifications();

    let lastTz = getCurrentTimeZone();
    const interval = setInterval(() => {
      const currentTz = getCurrentTimeZone();
      if (currentTz !== lastTz) {
        lastTz = currentTz;
        void svc.rehydrateNotifications();
      }
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [isFirstTime, hydratePrefs, setIsI18nReady]);

  React.useEffect(() => {
    const t = setTimeout(() => {
      void SplashScreen.hideAsync();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  React.useEffect(() => {
    const start = Date.now();
    requestAnimationFrame(() => {
      const firstPaintMs = Date.now() - start;
      void NoopAnalytics.track('perf_first_paint_ms', { ms: firstPaintMs });
    });
  }, []);

  useSyncAndMetrics();
}
