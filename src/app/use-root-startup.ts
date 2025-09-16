import * as Localization from 'expo-localization';
import React from 'react';

import { retentionWorker, useSyncPrefs } from '@/lib';
import { NoopAnalytics } from '@/lib/analytics';
import { registerNotificationMetrics } from '@/lib/notification-metrics';
import { setDeletionAdapter } from '@/lib/privacy/deletion-adapter';
import { createSupabaseDeletionAdapter } from '@/lib/privacy/deletion-adapter-supabase';
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

function useSyncAndMetrics(): void {
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
    try {
      const i18nModule = await import('@/lib/i18n');
      await i18nModule.initI18n();
      i18nInitSucceeded = true;
      applyRTLIfNeeded = i18nModule.applyRTLIfNeeded;
      refreshIsRTL = i18nModule.refreshIsRTL;
    } catch {
      // non-fatal
    } finally {
      if (!isMounted) return;
      refreshIsRTL?.();
      applyRTLIfNeeded?.();
      setIsI18nReady(true);
    }

    // NOTE: There's a race between i18n initialization and showing the
    // permission prompt. Only call requestPermissions when i18n init
    // succeeded so the prompt can show localized strings.
    svc = new TaskNotificationService();
    if (i18nInitSucceeded && !isFirstTime) void svc.requestPermissions();
    void svc.rehydrateNotifications();

    if (!isMounted) return;

    let lastTz = getCurrentTimeZone();
    interval = setInterval(() => {
      const currentTz = getCurrentTimeZone();
      if (currentTz !== lastTz) {
        lastTz = currentTz;
        void svc?.rehydrateNotifications();
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
      void NoopAnalytics.track('perf_first_paint_ms', { ms: firstPaintMs });
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
      try {
        retentionWorker.runNow();
      } catch {}
    };
    // initial run at app start
    run();
    const dayMs = 24 * 60 * 60 * 1000;
    const id = setInterval(run, dayMs);
    return () => clearInterval(id);
  }, []);
}
