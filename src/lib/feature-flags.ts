/**
 * Feature flags for gradual rollout and A/B testing
 */

import { Env } from '@env';

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
  return getFeatureFlags();
}

/**
 * Hook to check if a specific feature is enabled
 */
export function useFeatureFlag(feature: keyof FeatureFlags): boolean {
  return isFeatureEnabled(feature);
}
