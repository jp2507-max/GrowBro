/**
 * Remote Configuration for Confidence Calibration
 *
 * Manages remote delivery of calibration parameters with:
 * - Staged rollout support
 * - Per-device-tier configuration
 * - Automatic fallback to cached/default values
 * - Version tracking and validation
 *
 * Requirements:
 * - 2.5: Deploy calibrated thresholds per class/locale/device to Remote Config
 * - 10.2: Remote config with staged rollout and automatic rollback
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { z } from 'zod';
import { create } from 'zustand';

import { storage } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

import type { CalibrationConfig } from './confidence-calibration';
import {
  getCalibrationConfig,
  setCalibrationConfig,
  validateCalibrationConfig,
} from './confidence-calibration';

type PlatformKey = 'ios' | 'android' | 'universal';

type CalibrationConfigSource = 'remote' | 'cache' | 'stale-cache' | 'default';

type CalibrationConfigMetadata = {
  version?: string;
  updatedAt?: string;
  rolloutPercentage?: number;
  source: CalibrationConfigSource;
  fetchedAt?: number;
  deviceTier?: string | null;
  platform: PlatformKey;
  locale?: string;
};

type CalibrationConfigState = {
  config: CalibrationConfig;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error?: string;
  metadata: CalibrationConfigMetadata;
};

type RemoteCacheEntry = RemoteResponse & {
  fetchedAt: number;
  platform: PlatformKey;
  deviceTier?: string | null;
  locale?: string;
};

type RemoteResponse = z.infer<typeof responseSchema>;

type FetchResult = {
  payload: RemoteResponse;
  source: Exclude<CalibrationConfigSource, 'default'>;
};

const REMOTE_CACHE_STORAGE_KEY = 'assessment.calibration-config.cache.v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const responseSchema = z.object({
  temperature: z.number().positive().max(10),
  classThresholds: z.record(z.string(), z.number().min(0).max(1)),
  globalThreshold: z.number().min(0).max(1),
  version: z.string(),
  calibratedAt: z.string(),
  rolloutPercentage: z.number().int().min(0).max(100).optional(),
  etag: z.string().optional(),
});

const initialPlatform = getPlatformKey();

const useCalibrationConfigStore = create<CalibrationConfigState>(() => ({
  config: getCalibrationConfig(),
  status: 'idle',
  metadata: {
    source: 'default',
    platform: initialPlatform,
  },
}));

let inflightRequest: Promise<CalibrationConfig> | null = null;

/**
 * Hook to access calibration configuration state
 */
export function useCalibrationConfig() {
  return useCalibrationConfigStore();
}

/**
 * Get current calibration configuration state
 */
export function getCalibrationConfigState() {
  return useCalibrationConfigStore.getState();
}

/**
 * Set initial calibration configuration
 */
export function setInitialCalibrationConfig(config: CalibrationConfig) {
  setCalibrationConfig(config);
  useCalibrationConfigStore.setState({
    config,
    status: 'ready',
    error: undefined,
    metadata: {
      source: 'default',
      platform: getPlatformKey(),
    },
  });
}

/**
 * Refresh calibration configuration from remote
 *
 * @param options - Refresh options
 * @param options.force - Force refresh even if cache is fresh
 * @returns Promise resolving to updated configuration
 */
export async function refreshCalibrationConfig(
  options: { force?: boolean } = {}
): Promise<CalibrationConfig> {
  if (inflightRequest && !options.force) {
    return inflightRequest;
  }

  const task = performRefresh(options).finally(() => {
    inflightRequest = null;
  });

  inflightRequest = task;
  return task;
}

async function performRefresh({
  force,
}: {
  force?: boolean;
}): Promise<CalibrationConfig> {
  const platform = getPlatformKey();
  const deviceTier = determineDeviceTier();
  const locale = getLocale();
  const cached = readCache();

  useCalibrationConfigStore.setState((state) => ({
    ...state,
    status: 'loading',
    error: undefined,
  }));

  try {
    const result = await fetchRemoteConfig({
      cached,
      force,
      platform,
      deviceTier,
      locale,
    });

    const config = result.payload;

    // Validate before applying
    if (!validateCalibrationConfig(config)) {
      throw new Error('Invalid calibration configuration received');
    }

    setCalibrationConfig(config);

    const metadata = buildMetadata({ result, platform, deviceTier, locale });

    if (result.source === 'remote') {
      writeCacheWithContext({
        payload: result.payload,
        metadata,
        platform,
        deviceTier,
        locale,
      });
    } else if (cached) {
      metadata.fetchedAt = cached.fetchedAt;
      metadata.deviceTier = cached.deviceTier ?? null;
      metadata.locale = cached.locale;
    }

    useCalibrationConfigStore.setState({
      config,
      status: 'ready',
      error: undefined,
      metadata,
    });

    return config;
  } catch (error) {
    return handleRefreshError({ error, cached, platform, deviceTier, locale });
  }
}

function buildMetadata(options: {
  result: FetchResult;
  platform: PlatformKey;
  deviceTier: string | undefined;
  locale: string;
}): CalibrationConfigMetadata {
  const { result, platform, deviceTier, locale } = options;
  return {
    version: result.payload.version,
    updatedAt: result.payload.calibratedAt,
    rolloutPercentage: result.payload.rolloutPercentage,
    source: result.source,
    fetchedAt: Date.now(),
    deviceTier: deviceTier ?? null,
    platform,
    locale,
  };
}

function writeCacheWithContext(options: {
  payload: RemoteResponse;
  metadata: CalibrationConfigMetadata;
  platform: PlatformKey;
  deviceTier: string | undefined;
  locale: string;
}) {
  const { payload, metadata, platform, deviceTier, locale } = options;
  writeCache({
    ...payload,
    fetchedAt: metadata.fetchedAt!,
    platform,
    deviceTier: deviceTier ?? null,
    locale,
  });
}

function handleRefreshError(options: {
  error: unknown;
  cached: RemoteCacheEntry | null;
  platform: PlatformKey;
  deviceTier: string | undefined;
  locale: string;
}): CalibrationConfig {
  const { error, cached, platform, deviceTier, locale } = options;
  const message = error instanceof Error ? error.message : 'Unknown error';

  if (cached) {
    setCalibrationConfig(cached);
    useCalibrationConfigStore.setState({
      config: cached,
      status: 'ready',
      error: message,
      metadata: {
        version: cached.version,
        updatedAt: cached.calibratedAt,
        rolloutPercentage: cached.rolloutPercentage,
        source: 'stale-cache',
        fetchedAt: cached.fetchedAt,
        deviceTier: cached.deviceTier ?? null,
        platform: cached.platform,
        locale: cached.locale,
      },
    });
    return cached;
  }

  const fallback = getCalibrationConfig();
  useCalibrationConfigStore.setState({
    config: fallback,
    status: 'error',
    error: message,
    metadata: {
      source: 'default',
      platform,
      deviceTier: deviceTier ?? null,
      locale,
    },
  });
  return fallback;
}

function getPlatformKey(): PlatformKey {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'universal';
}

function determineDeviceTier(): string | undefined {
  const yearClass = Constants.deviceYearClass ?? undefined;
  if (!yearClass) return undefined;
  if (yearClass <= 2016) return 'low';
  if (yearClass <= 2020) return 'mid';
  return 'high';
}

function getLocale(): string {
  // Default to 'en' - can be extended with i18n integration
  return 'en';
}

function readCache(): RemoteCacheEntry | null {
  try {
    const raw = storage.getString(REMOTE_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RemoteCacheEntry;
    if (!parsed || !parsed.temperature) return null;
    return parsed;
  } catch (error) {
    console.warn('[CalibrationRemoteConfig] Failed to read cache:', error);
    storage.delete(REMOTE_CACHE_STORAGE_KEY);
    return null;
  }
}

function writeCache(entry: RemoteCacheEntry) {
  try {
    storage.set(REMOTE_CACHE_STORAGE_KEY, JSON.stringify(entry));
  } catch (error) {
    console.warn('[CalibrationRemoteConfig] Failed to persist cache:', error);
  }
}

async function fetchRemoteConfig({
  cached,
  force,
  platform,
  deviceTier,
  locale,
}: {
  cached: RemoteCacheEntry | null;
  force?: boolean;
  platform: PlatformKey;
  deviceTier?: string | undefined;
  locale?: string;
}): Promise<FetchResult> {
  const now = Date.now();
  if (
    !force &&
    cached &&
    isCacheFresh({ cache: cached, now, platform, locale })
  ) {
    const tierMatches = (cached.deviceTier ?? null) === (deviceTier ?? null);
    if (tierMatches) {
      return { payload: toRemoteResponse(cached), source: 'cache' };
    }
    // Device tier changed, but cache is still fresh - use it
    return { payload: toRemoteResponse(cached), source: 'cache' };
  }

  const headers: Record<string, string> = {
    'X-App-Platform': platform,
  };

  if (deviceTier) {
    headers['X-Device-Tier'] = deviceTier;
  }

  if (locale) {
    headers['X-Locale'] = locale;
  }

  if (cached?.etag) {
    headers['If-None-Match'] = cached.etag;
  }

  const { data, error } = await supabase.functions.invoke(
    'assessment-calibration-config',
    {
      body: {},
      headers,
    }
  );

  if (error) {
    const status = (error as any)?.context?.status ?? (error as any)?.status;
    if (status === 304 && cached) {
      return { payload: toRemoteResponse(cached), source: 'cache' };
    }
    throw new Error(
      error.message ?? 'Failed to fetch calibration configuration'
    );
  }

  if (!data) {
    if (cached) {
      return { payload: toRemoteResponse(cached), source: 'stale-cache' };
    }
    throw new Error('Received empty calibration configuration response');
  }

  const parsed = responseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error('Received invalid calibration configuration payload');
  }

  const payload = parsed.data;
  return {
    payload,
    source: 'remote',
  };
}

function isCacheFresh(options: {
  cache: RemoteCacheEntry;
  now: number;
  platform: PlatformKey;
  locale?: string;
}) {
  const { cache, now, platform, locale } = options;
  const samePlatform = cache.platform === platform;
  const sameLocale = !locale || cache.locale === locale;
  const age = now - cache.fetchedAt;
  return samePlatform && sameLocale && age < CACHE_TTL_MS;
}

function toRemoteResponse(entry: RemoteCacheEntry): RemoteResponse {
  const {
    temperature,
    classThresholds,
    globalThreshold,
    version,
    calibratedAt,
    rolloutPercentage,
    etag,
  } = entry;
  return {
    temperature,
    classThresholds,
    globalThreshold,
    version,
    calibratedAt,
    rolloutPercentage,
    etag,
  };
}
