import type { AnalyticsClient } from '@/lib/analytics';
import { NoopAnalytics } from '@/lib/analytics';

type UiMonitorOptions = {
  intervalMs?: number;
  windowMs?: number;
  thresholdMs?: number;
  analytics?: AnalyticsClient;
  isTrackingEnabled?: () => boolean;
  now?: () => number;
};

type MonitorState = {
  windowStart: number;
  lastTick: number;
  jankCount: number;
  maxBlock: number;
  totalBlock: number;
  samples: number;
};

const DEFAULT_INTERVAL_MS = 500;
const DEFAULT_WINDOW_MS = 15_000;
const DEFAULT_THRESHOLD_MS = 80;

export function startUiResponsivenessMonitor(
  options: UiMonitorOptions = {}
): () => void {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const windowMs = Math.max(intervalMs, options.windowMs ?? DEFAULT_WINDOW_MS);
  const thresholdMs = options.thresholdMs ?? DEFAULT_THRESHOLD_MS;
  const analytics = options.analytics ?? NoopAnalytics;
  const nowFn = options.now ?? Date.now;
  const isEnabled = options.isTrackingEnabled ?? (() => true);

  const initialNow = nowFn();
  const state: MonitorState = {
    windowStart: initialNow,
    lastTick: initialNow,
    jankCount: 0,
    maxBlock: 0,
    totalBlock: 0,
    samples: 0,
  };

  const interval = setInterval(async () => {
    const current = nowFn();
    const delta = current - state.lastTick;
    state.lastTick = current;
    state.samples += 1;

    const block = Math.max(0, delta - intervalMs);
    if (block > thresholdMs) {
      state.jankCount += 1;
      if (block > state.maxBlock) state.maxBlock = block;
      state.totalBlock += block;
    }

    const windowElapsed = current - state.windowStart;
    if (windowElapsed >= windowMs) {
      if (isEnabled() && state.samples > 0) {
        const avgBlock = state.jankCount
          ? state.totalBlock / state.jankCount
          : 0;
        try {
          await analytics.track('ui_thread_jank', {
            window_ms: windowElapsed,
            max_block_ms: Math.round(state.maxBlock),
            avg_block_ms: Math.round(avgBlock),
            jank_count: state.jankCount,
            sample_count: state.samples,
          });
        } catch (error) {
          if (__DEV__) {
            console.warn('[perf] failed to track UI responsiveness', error);
          }
        }
      }

      state.windowStart = current;
      state.jankCount = 0;
      state.maxBlock = 0;
      state.totalBlock = 0;
      state.samples = 0;
    }
  }, intervalMs);

  return () => {
    clearInterval(interval);
  };
}
