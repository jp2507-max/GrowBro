/* eslint-disable max-lines-per-function */
import { Env } from '@env';
import { act, renderHook } from '@testing-library/react-native';

import {
  type FeatureFlags,
  getFeatureFlags,
  isFeatureEnabled,
  refreshFeatureFlags,
  useFeatureFlag,
  useFeatureFlags,
} from '@/lib/feature-flags';

// Mock the @env module
jest.mock('@env', () => ({
  Env: {
    FEATURE_STRAINS_ENABLED: true,
    FEATURE_STRAINS_FAVORITES_SYNC: false,
    FEATURE_STRAINS_OFFLINE_CACHE: true,
  },
}));

describe('feature-flags', () => {
  beforeEach(() => {
    refreshFeatureFlags();
  });

  describe('getFeatureFlags', () => {
    test('returns feature flags from environment', () => {
      const flags = getFeatureFlags();
      expect(flags).toEqual({
        strainsEnabled: true,
        strainsFavoritesSync: false,
        strainsOfflineCache: true,
      });
    });

    test('uses default values when env vars undefined', () => {
      const originalEnv = { ...Env };
      Object.assign(Env, {
        FEATURE_STRAINS_ENABLED: undefined,
        FEATURE_STRAINS_FAVORITES_SYNC: undefined,
        FEATURE_STRAINS_OFFLINE_CACHE: undefined,
      });

      const flags = getFeatureFlags();
      expect(flags).toEqual({
        strainsEnabled: true,
        strainsFavoritesSync: true,
        strainsOfflineCache: true,
      });

      Object.assign(Env, originalEnv);
    });
  });

  describe('useFeatureFlags', () => {
    test('returns feature flags from store', () => {
      const { result } = renderHook(() => useFeatureFlags());
      expect(result.current).toEqual({
        strainsEnabled: true,
        strainsFavoritesSync: false,
        strainsOfflineCache: true,
      });
    });

    test('re-renders when flags refreshed', () => {
      const { result } = renderHook(() => useFeatureFlags());
      const originalEnv = { ...Env };
      Object.assign(Env, {
        FEATURE_STRAINS_ENABLED: false,
        FEATURE_STRAINS_FAVORITES_SYNC: true,
      });

      act(() => {
        refreshFeatureFlags();
      });

      expect(result.current).toEqual({
        strainsEnabled: false,
        strainsFavoritesSync: true,
        strainsOfflineCache: true,
      });

      Object.assign(Env, originalEnv);
    });
  });

  describe('refreshFeatureFlags', () => {
    test('updates store with current env values', () => {
      const { result } = renderHook(() => useFeatureFlags());
      expect(result.current.strainsEnabled).toBe(true);

      const originalEnv = { ...Env };
      Object.assign(Env, { FEATURE_STRAINS_ENABLED: false });

      act(() => {
        refreshFeatureFlags();
      });

      expect(result.current.strainsEnabled).toBe(false);
      Object.assign(Env, originalEnv);
    });
  });

  describe('isFeatureEnabled', () => {
    test('returns true for enabled features', () => {
      expect(isFeatureEnabled('strainsEnabled')).toBe(true);
      expect(isFeatureEnabled('strainsOfflineCache')).toBe(true);
    });

    test('returns false for disabled features', () => {
      expect(isFeatureEnabled('strainsFavoritesSync')).toBe(false);
    });

    test('returns undefined for invalid feature key', () => {
      expect(
        isFeatureEnabled('invalidKey' as keyof FeatureFlags)
      ).toBeUndefined();
    });
  });

  describe('useFeatureFlag', () => {
    test('returns feature flag value for specific feature', () => {
      const { result: enabledResult } = renderHook(() =>
        useFeatureFlag('strainsEnabled')
      );
      const { result: disabledResult } = renderHook(() =>
        useFeatureFlag('strainsFavoritesSync')
      );

      expect(enabledResult.current).toBe(true);
      expect(disabledResult.current).toBe(false);
    });

    test('re-renders when flags refreshed', () => {
      const { result } = renderHook(() => useFeatureFlag('strainsEnabled'));
      expect(result.current).toBe(true);

      const originalEnv = { ...Env };
      Object.assign(Env, { FEATURE_STRAINS_ENABLED: false });

      act(() => {
        refreshFeatureFlags();
      });

      expect(result.current).toBe(false);
      Object.assign(Env, originalEnv);
    });
  });
});
