/**
 * Feature flags for gradual rollout and A/B testing
 */

import { Env } from '@env';
import { create } from 'zustand';

export interface FeatureFlags {
  // Strains feature flags
  strainsEnabled: boolean;
  strainsFavoritesSync: boolean;
  strainsOfflineCache: boolean;
}

/**
 * Get current feature flags from environment
 */
export function getFeatureFlags(): FeatureFlags {
  return {
    strainsEnabled: Env.FEATURE_STRAINS_ENABLED ?? true,
    strainsFavoritesSync: Env.FEATURE_STRAINS_FAVORITES_SYNC ?? true,
    strainsOfflineCache: Env.FEATURE_STRAINS_OFFLINE_CACHE ?? true,
  };
}

/**
 * Zustand store for feature flags
 */
interface FeatureFlagsStore {
  flags: FeatureFlags;
  setFeatureFlags: (flags: FeatureFlags) => void;
}

const useFeatureFlagsStore = create<FeatureFlagsStore>((set) => ({
  flags: getFeatureFlags(),
  setFeatureFlags: (flags) => set({ flags }),
}));

/**
 * Refresh feature flags from environment and update store
 */
export function refreshFeatureFlags(): void {
  const updatedFlags = getFeatureFlags();
  useFeatureFlagsStore.getState().setFeatureFlags(updatedFlags);
}

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  const flags = getFeatureFlags();
  return flags[feature];
}

/**
 * Hook to use feature flags in React components
 */
export function useFeatureFlags(): FeatureFlags {
  return useFeatureFlagsStore((state) => state.flags);
}

/**
 * Hook to check if a specific feature is enabled
 */
export function useFeatureFlag(feature: keyof FeatureFlags): boolean {
  const flags = useFeatureFlags();
  return flags[feature];
}
