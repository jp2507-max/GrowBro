import { renderHook } from '@testing-library/react-native';

import { storage } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

import {
  getQualityConfigState,
  refreshQualityThresholds,
  setInitialQualityThresholds,
  useQualityThresholds,
} from './remote-config';
import type { QualityThresholds } from './types';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));

jest.mock('@/lib/storage', () => ({
  storage: {
    getString: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    deviceYearClass: 2021,
  },
}));

const mockInvoke = supabase.functions.invoke as jest.MockedFunction<
  typeof supabase.functions.invoke
>;
const mockGetString = storage.getString as jest.MockedFunction<
  typeof storage.getString
>;
const mockSet = storage.set as jest.MockedFunction<typeof storage.set>;
const mockDelete = storage.delete as jest.MockedFunction<typeof storage.delete>;

const DEFAULT_THRESHOLDS: QualityThresholds = {
  blur: {
    minVariance: 100,
    severeVariance: 60,
    weight: 0.35,
  },
  exposure: {
    underExposureMaxRatio: 0.18,
    overExposureMaxRatio: 0.18,
    acceptableRange: [0.25, 0.75],
    weight: 0.25,
  },
  whiteBalance: {
    maxDeviation: 0.15,
    severeDeviation: 0.25,
    weight: 0.2,
  },
  composition: {
    minPlantCoverage: 0.38,
    minCenterCoverage: 0.22,
    weight: 0.2,
  },
  acceptableScore: 75,
  borderlineScore: 60,
};

const REMOTE_THRESHOLDS: QualityThresholds = {
  ...DEFAULT_THRESHOLDS,
  acceptableScore: 80,
  borderlineScore: 65,
};

const REMOTE_RESPONSE = {
  thresholds: REMOTE_THRESHOLDS,
  version: 2,
  updatedAt: '2025-01-01T00:00:00Z',
  rolloutPercentage: 100,
  etag: 'etag-123',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetString.mockReturnValue(undefined);
});

describe('useQualityThresholds', () => {
  it('should return default thresholds initially', () => {
    const { result } = renderHook(() => useQualityThresholds());

    expect(result.current.thresholds).toEqual(DEFAULT_THRESHOLDS);
    expect(result.current.status).toBe('idle');
    expect(result.current.metadata.source).toBe('default');
  });

  it('should expose metadata with platform and device tier', () => {
    const { result } = renderHook(() => useQualityThresholds());

    expect(result.current.metadata.platform).toMatch(/ios|android|universal/);
  });
});

describe('setInitialQualityThresholds', () => {
  it('should update store and persist to storage', () => {
    const customThresholds: QualityThresholds = {
      ...DEFAULT_THRESHOLDS,
      acceptableScore: 85,
    };

    setInitialQualityThresholds(customThresholds);

    const state = getQualityConfigState();
    expect(state.thresholds.acceptableScore).toBe(85);
    expect(state.status).toBe('ready');
    expect(mockSet).toHaveBeenCalledWith(
      'quality.thresholds.v1',
      expect.any(String)
    );
  });
});

describe('refreshQualityThresholds - successful fetch', () => {
  it('should fetch remote config and update state', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: REMOTE_RESPONSE,
      error: null,
    });

    await refreshQualityThresholds();

    const state = getQualityConfigState();
    expect(state.thresholds.acceptableScore).toBe(80);
    expect(state.status).toBe('ready');
    expect(state.metadata.source).toBe('remote');
    expect(state.metadata.version).toBe(2);
    expect(mockSet).toHaveBeenCalledWith(
      'quality.remote-config.cache.v1',
      expect.stringContaining('"version":2')
    );
  });

  it('should include platform and device tier headers', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: REMOTE_RESPONSE,
      error: null,
    });

    await refreshQualityThresholds();

    expect(mockInvoke).toHaveBeenCalledWith('quality-config', {
      body: {},
      headers: expect.objectContaining({
        'X-App-Platform': expect.stringMatching(/ios|android|universal/),
        'X-Device-Tier': expect.any(String),
      }),
    });
  });
});

describe('refreshQualityThresholds - cache behavior', () => {
  it('should use cached config if fresh', async () => {
    const cachedEntry = {
      ...REMOTE_RESPONSE,
      fetchedAt: Date.now() - 1000, // 1 second ago
      platform: 'ios' as const,
      deviceTier: 'high',
    };

    mockGetString.mockReturnValueOnce(JSON.stringify(cachedEntry));

    await refreshQualityThresholds();

    expect(mockInvoke).not.toHaveBeenCalled();
    const state = getQualityConfigState();
    expect(state.metadata.source).toBe('cache');
  });

  it('should fetch if cache is stale', async () => {
    const staleEntry = {
      ...REMOTE_RESPONSE,
      fetchedAt: Date.now() - 7 * 60 * 60 * 1000, // 7 hours ago
      platform: 'ios' as const,
      deviceTier: 'high',
    };

    mockGetString.mockReturnValueOnce(JSON.stringify(staleEntry));
    mockInvoke.mockResolvedValueOnce({
      data: REMOTE_RESPONSE,
      error: null,
    });

    await refreshQualityThresholds();

    expect(mockInvoke).toHaveBeenCalled();
    const state = getQualityConfigState();
    expect(state.metadata.source).toBe('remote');
  });

  it('should clear cache if stored JSON is invalid', async () => {
    mockGetString.mockReturnValueOnce('{ invalid json');
    mockInvoke.mockResolvedValueOnce({
      data: REMOTE_RESPONSE,
      error: null,
    });

    await refreshQualityThresholds();

    expect(mockDelete).toHaveBeenCalledWith('quality.remote-config.cache.v1');
    const state = getQualityConfigState();
    expect(state.metadata.source).toBe('remote');
  });

  it('should handle 304 Not Modified with cached ETag', async () => {
    const cachedEntry = {
      ...REMOTE_RESPONSE,
      fetchedAt: Date.now() - 7 * 60 * 60 * 1000, // stale
      platform: 'ios' as const,
      deviceTier: 'high',
    };

    mockGetString.mockReturnValueOnce(JSON.stringify(cachedEntry));
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { context: { status: 304 } } as any,
    });

    await refreshQualityThresholds();

    const state = getQualityConfigState();
    expect(state.metadata.source).toBe('cache');
    expect(state.thresholds.acceptableScore).toBe(80);
  });
});

describe('refreshQualityThresholds - error handling', () => {
  it('should fall back to stale cache on network error', async () => {
    const staleEntry = {
      ...REMOTE_RESPONSE,
      fetchedAt: Date.now() - 7 * 60 * 60 * 1000,
      platform: 'ios' as const,
      deviceTier: 'high',
    };

    mockGetString.mockReturnValueOnce(JSON.stringify(staleEntry));
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'Network error' } as any,
    });

    await refreshQualityThresholds();

    const state = getQualityConfigState();
    expect(state.metadata.source).toBe('stale-cache');
    expect(state.thresholds.acceptableScore).toBe(80);
    expect(state.error).toBe('Network error');
  });

  it('should fall back to defaults if no cache and fetch fails', async () => {
    mockGetString.mockReturnValue(undefined);
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: { message: 'Network error' } as any,
    });

    await refreshQualityThresholds();

    const state = getQualityConfigState();
    expect(state.metadata.source).toBe('default');
    expect(state.status).toBe('error');
    expect(state.error).toBe('Network error');
    expect(state.thresholds).toEqual(DEFAULT_THRESHOLDS);
  });

  it('should handle invalid response payload', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { invalid: 'payload' },
      error: null,
    });

    await refreshQualityThresholds();

    const state = getQualityConfigState();
    expect(state.status).toBe('error');
    expect(state.error).toContain('invalid');
  });
});

describe('refreshQualityThresholds - force refresh', () => {
  it('should bypass cache when force is true', async () => {
    const cachedEntry = {
      ...REMOTE_RESPONSE,
      fetchedAt: Date.now() - 1000, // fresh
      platform: 'ios' as const,
      deviceTier: 'high',
    };

    mockGetString.mockReturnValueOnce(JSON.stringify(cachedEntry));
    mockInvoke.mockResolvedValueOnce({
      data: { ...REMOTE_RESPONSE, version: 3 },
      error: null,
    });

    await refreshQualityThresholds({ force: true });

    expect(mockInvoke).toHaveBeenCalled();
    const state = getQualityConfigState();
    expect(state.metadata.version).toBe(3);
  });
});

describe('refreshQualityThresholds - concurrent requests', () => {
  it('should deduplicate concurrent refresh calls', async () => {
    mockInvoke.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ data: REMOTE_RESPONSE, error: null }), 100)
        )
    );

    const [result1, result2, result3] = await Promise.all([
      refreshQualityThresholds(),
      refreshQualityThresholds(),
      refreshQualityThresholds(),
    ]);

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(result1).toEqual(result2);
    expect(result2).toEqual(result3);
  });
});
