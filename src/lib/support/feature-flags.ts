import { storage } from '@/lib/storage';

const FEATURE_FLAG_CACHE_KEY = 'support.featureFlags';
const FEATURE_FLAG_CACHE_TTL = 1000 * 60 * 60; // 1 hour

export interface SupportFeatureFlags {
  helpCenter: boolean;
  contact: boolean;
  ratingPrompt: boolean;
  killSwitch: {
    uploads: boolean;
  };
}

const DEFAULT_FLAGS: SupportFeatureFlags = {
  helpCenter: true,
  contact: true,
  ratingPrompt: true,
  killSwitch: {
    uploads: false,
  },
};

interface CachedFlags {
  flags: SupportFeatureFlags;
  timestamp: number;
}

/**
 * Get feature flags from cache or fetch from remote config
 * NOTE: This function cannot be a worklet because it performs storage I/O operations.
 * Worklets should avoid side effects and heavy operations like storage access,
 * which must be performed on the JS thread.
 */
export function getSupportFeatureFlags(): SupportFeatureFlags {
  const cached = storage.getString(FEATURE_FLAG_CACHE_KEY);

  if (cached) {
    try {
      const parsed: CachedFlags = JSON.parse(cached);
      const age = Date.now() - parsed.timestamp;

      if (age < FEATURE_FLAG_CACHE_TTL) {
        return parsed.flags;
      }
    } catch {
      // Invalid cache, fall through to defaults
    }
  }

  return DEFAULT_FLAGS;
}

/**
 * Update feature flags cache (call after fetching from Supabase)
 */
export function updateSupportFeatureFlags(flags: SupportFeatureFlags): void {
  const cached: CachedFlags = {
    flags,
    timestamp: Date.now(),
  };
  storage.set(FEATURE_FLAG_CACHE_KEY, JSON.stringify(cached));
}

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(
  feature: keyof Omit<SupportFeatureFlags, 'killSwitch'>
): boolean {
  // NOTE: This function cannot be a worklet because it performs storage I/O operations
  // via getSupportFeatureFlags(). Worklets should avoid side effects and heavy operations
  // like storage access, which must be performed on the JS thread.
  const flags = getSupportFeatureFlags();
  return flags[feature];
}

/**
 * Check if uploads are disabled by kill switch
 */
export function areUploadsDisabled(): boolean {
  // NOTE: This function cannot be a worklet because it performs storage I/O operations
  // via getSupportFeatureFlags(). Worklets should avoid side effects and heavy operations
  // like storage access, which must be performed on the JS thread.
  const flags = getSupportFeatureFlags();
  return flags.killSwitch.uploads;
}
