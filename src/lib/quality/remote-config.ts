import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { z } from 'zod';
import { create } from 'zustand';

import { storage } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

import { getQualityThresholds, setQualityThresholds } from './config';
import type { QualityThresholds } from './types';

type PlatformKey = 'ios' | 'android' | 'universal';

type QualityConfigSource = 'remote' | 'cache' | 'stale-cache' | 'default';

type QualityConfigMetadata = {
  version?: number;
  updatedAt?: string;
  rolloutPercentage?: number;
  source: QualityConfigSource;
  fetchedAt?: number;
  deviceTier?: string | null;
  platform: PlatformKey;
};

type QualityConfigState = {
  thresholds: QualityThresholds;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error?: string;
  metadata: QualityConfigMetadata;
};

type RemoteCacheEntry = RemoteResponse & {
  fetchedAt: number;
  platform: PlatformKey;
  deviceTier?: string | null;
};

type RemoteResponse = z.infer<typeof responseSchema>;

type FetchResult = {
  payload: RemoteResponse;
  source: Exclude<QualityConfigSource, 'default'>;
};

const REMOTE_CACHE_STORAGE_KEY = 'quality.remote-config.cache.v1';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

const responseSchema = z.object({
  thresholds: z.object({
    blur: z.object({
      minVariance: z.number(),
      severeVariance: z.number(),
      weight: z.number(),
    }),
    exposure: z.object({
      underExposureMaxRatio: z.number().positive(),
      overExposureMaxRatio: z.number().positive(),
      acceptableRange: z
        .tuple([z.number(), z.number()])
        .refine(
          ([min, max]) => min < max,
          'acceptableRange must be an increasing tuple (min < max)'
        ),
      weight: z.number(),
    }),
    whiteBalance: z.object({
      maxDeviation: z.number(),
      severeDeviation: z.number(),
      weight: z.number(),
    }),
    composition: z.object({
      minPlantCoverage: z.number(),
      minCenterCoverage: z.number(),
      weight: z.number(),
    }),
    acceptableScore: z.number(),
    borderlineScore: z.number(),
  }),
  version: z.number(),
  updatedAt: z.string(),
  rolloutPercentage: z.number().int().min(0).max(100).optional(),
  etag: z.string().optional(),
});

const initialPlatform = getPlatformKey();

const useQualityConfigStore = create<QualityConfigState>(() => ({
  thresholds: getQualityThresholds(),
  status: 'idle',
  metadata: {
    source: 'default',
    platform: initialPlatform,
  },
}));

let inflightRequest: Promise<QualityThresholds> | null = null;

export function useQualityThresholds() {
  return useQualityConfigStore();
}

export function getQualityConfigState() {
  return useQualityConfigStore.getState();
}

export function setInitialQualityThresholds(thresholds: QualityThresholds) {
  setQualityThresholds(thresholds);
  useQualityConfigStore.setState({
    thresholds,
    status: 'ready',
    error: undefined,
    metadata: {
      source: 'default',
      platform: getPlatformKey(),
    },
  });
}

export async function refreshQualityThresholds(
  options: { force?: boolean } = {}
) {
  if (inflightRequest && !options.force) {
    return inflightRequest;
  }

  const task = performRefresh(options).finally(() => {
    inflightRequest = null;
  });

  inflightRequest = task;
  return task;
}

async function performRefresh({ force }: { force?: boolean }) {
  const platform = getPlatformKey();
  const deviceTier = determineDeviceTier();
  const cached = readCache();

  useQualityConfigStore.setState((state) => ({
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
    });

    const thresholds = result.payload.thresholds;

    setQualityThresholds(thresholds);

    const metadata: QualityConfigMetadata = {
      version: result.payload.version,
      updatedAt: result.payload.updatedAt,
      rolloutPercentage: result.payload.rolloutPercentage,
      source: result.source,
      fetchedAt: Date.now(),
      deviceTier: deviceTier ?? null,
      platform,
    };

    if (result.source === 'remote') {
      writeCache({
        ...result.payload,
        fetchedAt: metadata.fetchedAt!,
        platform,
        deviceTier: deviceTier ?? null,
      });
    } else if (cached) {
      metadata.fetchedAt = cached.fetchedAt;
      metadata.deviceTier = cached.deviceTier ?? null;
    }

    useQualityConfigStore.setState({
      thresholds,
      status: 'ready',
      error: undefined,
      metadata,
    });

    return thresholds;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (cached) {
      setQualityThresholds(cached.thresholds);
      useQualityConfigStore.setState({
        thresholds: cached.thresholds,
        status: 'ready',
        error: message,
        metadata: {
          version: cached.version,
          updatedAt: cached.updatedAt,
          rolloutPercentage: cached.rolloutPercentage,
          source: 'stale-cache',
          fetchedAt: cached.fetchedAt,
          deviceTier: cached.deviceTier ?? null,
          platform: cached.platform,
        },
      });
      return cached.thresholds;
    }

    const fallback = getQualityThresholds();
    useQualityConfigStore.setState({
      thresholds: fallback,
      status: 'error',
      error: message,
      metadata: {
        source: 'default',
        platform,
        deviceTier: deviceTier ?? null,
      },
    });
    return fallback;
  }
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

function readCache(): RemoteCacheEntry | null {
  try {
    const raw = storage.getString(REMOTE_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RemoteCacheEntry;
    if (!parsed || !parsed.thresholds) return null;
    return parsed;
  } catch (error) {
    console.warn('[QualityRemoteConfig] Failed to read cache:', error);
    storage.delete(REMOTE_CACHE_STORAGE_KEY);
    return null;
  }
}

function writeCache(entry: RemoteCacheEntry) {
  try {
    storage.set(REMOTE_CACHE_STORAGE_KEY, JSON.stringify(entry));
  } catch (error) {
    console.warn('[QualityRemoteConfig] Failed to persist cache:', error);
  }
}

async function fetchRemoteConfig({
  cached,
  force,
  platform,
  deviceTier,
}: {
  cached: RemoteCacheEntry | null;
  force?: boolean;
  platform: PlatformKey;
  deviceTier?: string | undefined;
}): Promise<FetchResult> {
  const now = Date.now();
  if (!force && cached && isCacheFresh(cached, now, platform)) {
    const tierMatches = (cached.deviceTier ?? null) === (deviceTier ?? null);
    if (tierMatches) {
      return { payload: toRemoteResponse(cached), source: 'cache' };
    }
    // Cache is invalid due to tier mismatch, fall through to remote fetch
  }

  const headers: Record<string, string> = {
    'X-App-Platform': platform,
  };

  if (deviceTier) {
    headers['X-Device-Tier'] = deviceTier;
  }

  if (cached?.etag) {
    headers['If-None-Match'] = cached.etag;
  }

  const { data, error } = await supabase.functions.invoke('quality-config', {
    body: {},
    headers,
  });

  if (error) {
    const status = (error as any)?.context?.status ?? (error as any)?.status;
    if (status === 304 && cached) {
      return { payload: toRemoteResponse(cached), source: 'cache' };
    }
    throw new Error(error.message ?? 'Failed to fetch quality configuration');
  }

  if (!data) {
    if (cached) {
      return { payload: toRemoteResponse(cached), source: 'stale-cache' };
    }
    throw new Error('Received empty quality configuration response');
  }

  const parsed = responseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error('Received invalid quality configuration payload');
  }

  const payload = parsed.data;
  return {
    payload,
    source: 'remote',
  };
}

function isCacheFresh(
  cache: RemoteCacheEntry,
  now: number,
  platform: PlatformKey
) {
  const samePlatform = cache.platform === platform;
  const age = now - cache.fetchedAt;
  return samePlatform && age < CACHE_TTL_MS;
}

function toRemoteResponse(entry: RemoteCacheEntry): RemoteResponse {
  const { thresholds, version, updatedAt, rolloutPercentage, etag } = entry;
  return {
    thresholds,
    version,
    updatedAt,
    rolloutPercentage,
    etag,
  };
}
