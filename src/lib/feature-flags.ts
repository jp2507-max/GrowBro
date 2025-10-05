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
  // AI adjustment feature flags
  aiAdjustmentsEnabled: boolean;
  aiAdjustmentsMinSkippedTasks: number;
  aiAdjustmentsMinConfidence: number;
}

/**
 * Get current feature flags from environment
 */
export function getFeatureFlags(): FeatureFlags {
  return {
    strainsEnabled: Env.FEATURE_STRAINS_ENABLED ?? true,
    strainsFavoritesSync: Env.FEATURE_STRAINS_FAVORITES_SYNC ?? true,
    strainsOfflineCache: Env.FEATURE_STRAINS_OFFLINE_CACHE ?? true,
    aiAdjustmentsEnabled: Env.FEATURE_AI_ADJUSTMENTS_ENABLED ?? false,
    aiAdjustmentsMinSkippedTasks:
      Env.FEATURE_AI_ADJUSTMENTS_MIN_SKIPPED_TASKS ?? 2,
    aiAdjustmentsMinConfidence:
      Env.FEATURE_AI_ADJUSTMENTS_MIN_CONFIDENCE ?? 0.7,
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
export function isFeatureEnabled(
  feature: keyof FeatureFlags
): boolean | number {
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
export function useFeatureFlag(feature: keyof FeatureFlags): boolean | number {
  const flags = useFeatureFlags();
  return flags[feature];
}
