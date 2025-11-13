/**
 * Remote Configuration for Model Lifecycle Management
 *
 * Manages remote delivery of model versions with:
 * - Staged rollout support (canary → 10% → 50% → 100%)
 * - A/B testing and shadow mode
 * - Automatic rollback on error rate spikes
 * - Version tracking and validation
 *
 * Requirements:
 * - 10.1: Deliver quantized ONNX models with checksum validation
 * - 10.2: Remote config with staged rollout and automatic rollback
 * - 9.3: Shadow mode testing before flipping default
 */

import { Platform } from 'react-native';
import { z } from 'zod';
import { create } from 'zustand';

import { storage } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

import { isValidModelVersion } from './model-config';

type PlatformKey = 'ios' | 'android' | 'universal';

type ModelConfigSource = 'remote' | 'cache' | 'stale-cache' | 'default';

export type ModelRemoteConfig = {
  activeModelVersion: string;
  rolloutPercentage: number;
  shadowModelVersion?: string;
  shadowPercentage?: number;
  rollbackThreshold: number;
  minAppVersion?: string;
  updatedAt: string;
};

type ModelConfigMetadata = {
  version: string;
  source: ModelConfigSource;
  fetchedAt?: number;
  platform: PlatformKey;
  userBucket?: number; // 0-99 for percentage-based rollout
};

type ModelConfigState = {
  config: ModelRemoteConfig;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error?: string;
  metadata: ModelConfigMetadata;
};

type RemoteCacheEntry = RemoteResponse & {
  fetchedAt: number;
  platform: PlatformKey;
};

type RemoteResponse = z.infer<typeof responseSchema>;

type FetchResult = {
  payload: RemoteResponse;
  source: Exclude<ModelConfigSource, 'default'>;
};

const REMOTE_CACHE_STORAGE_KEY = 'assessment.model-config.cache.v1';
const USER_BUCKET_STORAGE_KEY = 'assessment.model-config.user-bucket';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours (shorter than calibration)

const responseSchema = z.object({
  activeModelVersion: z.string(),
  rolloutPercentage: z.number().int().min(0).max(100),
  shadowModelVersion: z.string().optional(),
  shadowPercentage: z.number().int().min(0).max(100).optional(),
  rollbackThreshold: z.number().min(0).max(1),
  minAppVersion: z.string().optional(),
  updatedAt: z.string(),
  etag: z.string().optional(),
});

const DEFAULT_CONFIG: ModelRemoteConfig = {
  activeModelVersion: 'v1.0.0',
  rolloutPercentage: 100,
  rollbackThreshold: 0.15, // 15% error rate triggers rollback
  updatedAt: new Date().toISOString(),
};

const initialPlatform = getPlatformKey();

const useModelConfigStore = create<ModelConfigState>(() => ({
  config: DEFAULT_CONFIG,
  status: 'idle',
  metadata: {
    version: DEFAULT_CONFIG.activeModelVersion,
    source: 'default',
    platform: initialPlatform,
  },
}));

let inflightRequest: Promise<ModelRemoteConfig> | null = null;

/**
 * Hook to access model configuration state
 */
export function useModelConfig() {
  return useModelConfigStore();
}

/**
 * Get current model configuration state
 */
export function getModelConfigState() {
  return useModelConfigStore.getState();
}

/**
 * Get the model version this user should use based on rollout percentage
 */
export function getActiveModelVersion(): string {
  const { config, metadata } = useModelConfigStore.getState();
  const userBucket = metadata.userBucket ?? getUserBucket();

  // Check if user is in shadow mode cohort
  if (
    config.shadowModelVersion &&
    config.shadowPercentage &&
    userBucket < config.shadowPercentage
  ) {
    return config.shadowModelVersion;
  }

  // Check if user is in active rollout cohort
  if (userBucket < config.rolloutPercentage) {
    return config.activeModelVersion;
  }

  // User is not in rollout cohort, use previous stable version
  // In production, this should fetch from a "stable" field in remote config
  return DEFAULT_CONFIG.activeModelVersion;
}

/**
 * Check if user should use shadow model for testing
 */
export function shouldUseShadowModel(): boolean {
  const { config, metadata } = useModelConfigStore.getState();
  if (!config.shadowModelVersion || !config.shadowPercentage) {
    return false;
  }

  const userBucket = metadata.userBucket ?? getUserBucket();
  return userBucket < config.shadowPercentage;
}

/**
 * Refresh model configuration from remote
 */
export async function refreshModelConfig(
  options: { force?: boolean } = {}
): Promise<ModelRemoteConfig> {
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
}): Promise<ModelRemoteConfig> {
  const platform = getPlatformKey();
  const userBucket = getUserBucket();
  const cached = readCache();

  useModelConfigStore.setState((state) => ({
    ...state,
    status: 'loading',
    error: undefined,
  }));

  try {
    const result = await fetchRemoteConfig({
      cached,
      force,
      platform,
    });

    const config = toModelRemoteConfig(result.payload);

    // Validate model versions
    if (!isValidModelVersion(config.activeModelVersion)) {
      throw new Error(
        `Invalid active model version: ${config.activeModelVersion}`
      );
    }

    if (
      config.shadowModelVersion &&
      !isValidModelVersion(config.shadowModelVersion)
    ) {
      throw new Error(
        `Invalid shadow model version: ${config.shadowModelVersion}`
      );
    }

    const fetchedAt = Date.now();
    const metadata: ModelConfigMetadata = {
      version: config.activeModelVersion,
      source: result.source,
      fetchedAt,
      platform,
      userBucket,
    };

    if (result.source === 'remote') {
      writeCache({
        ...result.payload,
        fetchedAt,
        platform,
      });
    } else if (cached) {
      metadata.fetchedAt = cached.fetchedAt;
    }

    useModelConfigStore.setState({
      config,
      status: 'ready',
      error: undefined,
      metadata,
    });

    return config;
  } catch (error) {
    return handleRefreshError({ error, cached, platform, userBucket });
  }
}

function handleRefreshError(options: {
  error: unknown;
  cached: RemoteCacheEntry | null;
  platform: PlatformKey;
  userBucket: number;
}): ModelRemoteConfig {
  const { error, cached, platform, userBucket } = options;
  const message = error instanceof Error ? error.message : 'Unknown error';

  if (cached) {
    const config = toModelRemoteConfig(cached);
    useModelConfigStore.setState({
      config,
      status: 'ready',
      error: message,
      metadata: {
        version: config.activeModelVersion,
        source: 'stale-cache',
        fetchedAt: cached.fetchedAt,
        platform: cached.platform,
        userBucket,
      },
    });
    return config;
  }

  useModelConfigStore.setState({
    config: DEFAULT_CONFIG,
    status: 'error',
    error: message,
    metadata: {
      version: DEFAULT_CONFIG.activeModelVersion,
      source: 'default',
      platform,
      userBucket,
    },
  });
  return DEFAULT_CONFIG;
}

function getPlatformKey(): PlatformKey {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'universal';
}

/**
 * Get or create persistent user bucket (0-99) for rollout percentage
 */
function getUserBucket(): number {
  try {
    const stored = storage.getNumber(USER_BUCKET_STORAGE_KEY);
    if (stored !== undefined && stored >= 0 && stored < 100) {
      return stored;
    }

    // Generate new bucket
    const bucket = Math.floor(Math.random() * 100);
    storage.set(USER_BUCKET_STORAGE_KEY, bucket);
    return bucket;
  } catch (error) {
    console.warn('[ModelRemoteConfig] Failed to get user bucket:', error);
    return Math.floor(Math.random() * 100);
  }
}

function readCache(): RemoteCacheEntry | null {
  try {
    const raw = storage.getString(REMOTE_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RemoteCacheEntry;
    if (!parsed || !parsed.activeModelVersion) return null;
    return parsed;
  } catch (error) {
    console.warn('[ModelRemoteConfig] Failed to read cache:', error);
    storage.delete(REMOTE_CACHE_STORAGE_KEY);
    return null;
  }
}

function writeCache(entry: RemoteCacheEntry) {
  try {
    storage.set(REMOTE_CACHE_STORAGE_KEY, JSON.stringify(entry));
  } catch (error) {
    console.warn('[ModelRemoteConfig] Failed to persist cache:', error);
  }
}

async function fetchRemoteConfig({
  cached,
  force,
  platform,
}: {
  cached: RemoteCacheEntry | null;
  force?: boolean;
  platform: PlatformKey;
}): Promise<FetchResult> {
  const now = Date.now();
  if (!force && cached && isCacheFresh({ cache: cached, now, platform })) {
    return { payload: toRemoteResponse(cached), source: 'cache' };
  }

  const headers: Record<string, string> = {
    'X-App-Platform': platform,
  };

  if (cached?.etag) {
    headers['If-None-Match'] = cached.etag;
  }

  const { data, error } = await supabase.functions.invoke(
    'assessment-model-config',
    {
      body: {},
      headers,
    }
  );

  if (error) {
    const errorWithStatus = error as {
      context?: { status?: number };
      status?: number;
      message?: string;
    };
    const status = errorWithStatus.context?.status ?? errorWithStatus.status;
    if (status === 304 && cached) {
      return { payload: toRemoteResponse(cached), source: 'cache' };
    }
    throw new Error(
      errorWithStatus.message ?? 'Failed to fetch model configuration'
    );
  }

  if (!data) {
    if (cached) {
      return { payload: toRemoteResponse(cached), source: 'stale-cache' };
    }
    throw new Error('Received empty model configuration response');
  }

  const parsed = responseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error('Received invalid model configuration payload');
  }

  return {
    payload: parsed.data,
    source: 'remote',
  };
}

function isCacheFresh(options: {
  cache: RemoteCacheEntry;
  now: number;
  platform: PlatformKey;
}) {
  const { cache, now, platform } = options;
  const samePlatform = cache.platform === platform;
  const age = now - cache.fetchedAt;
  return samePlatform && age < CACHE_TTL_MS;
}

function toRemoteResponse(entry: RemoteCacheEntry): RemoteResponse {
  const {
    activeModelVersion,
    rolloutPercentage,
    shadowModelVersion,
    shadowPercentage,
    rollbackThreshold,
    minAppVersion,
    updatedAt,
    etag,
  } = entry;
  return {
    activeModelVersion,
    rolloutPercentage,
    shadowModelVersion,
    shadowPercentage,
    rollbackThreshold,
    minAppVersion,
    updatedAt,
    etag,
  };
}

function toModelRemoteConfig(
  source: RemoteResponse | RemoteCacheEntry
): ModelRemoteConfig {
  const {
    activeModelVersion,
    rolloutPercentage,
    shadowModelVersion,
    shadowPercentage,
    rollbackThreshold,
    minAppVersion,
    updatedAt,
  } = source;
  return {
    activeModelVersion,
    rolloutPercentage,
    shadowModelVersion,
    shadowPercentage,
    rollbackThreshold,
    minAppVersion,
    updatedAt,
  };
}
