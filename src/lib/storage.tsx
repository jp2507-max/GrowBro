/**
 * MMKV Storage Module
 *
 * This is the default shared MMKV instance for general app state.
 * Use this for non-sensitive data like preferences, UI state, and caches.
 *
 * Storage Architecture:
 * 1. Default (this file): Use `storage` for general app state
 * 2. Encrypted auth: Use `auth-storage.ts` for auth tokens/sessions
 * 3. Secure domains: Use `security/secure-storage.ts` for sensitive data
 *    (auth, user-data, sync-metadata, security-cache, feature-flags)
 * 4. Feature isolation: Create namespaced instances when data isolation
 *    is needed (e.g., search-history.ts, filter-presets.ts)
 *
 * MMKV hooks (useMMKVString, useMMKVBoolean, etc.) should pass the
 * shared `storage` instance as the second argument for reactivity.
 */
import { MMKV } from 'react-native-mmkv';

export const storage = new MMKV();

export function getItem<T>(key: string): T | null {
  const value = storage.getString(key);
  if (value === null || value === undefined) {
    return null;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function setItem<T>(key: string, value: T): void {
  try {
    storage.set(key, JSON.stringify(value));
  } catch (error) {
    console.error(`[storage] Failed to serialize value for key: ${key}`, error);
    // Fail silently to prevent crashes, but log for debugging
  }
}

export function removeItem(key: string): void {
  storage.delete(key);
}

// Namespaced Storage Keys - use with shared `storage` instance
export const STORAGE_KEYS = {
  // Strains
  STRAINS_SEARCH_HISTORY: 'strains.searchHistory',
  STRAINS_FILTER_PRESETS: 'strains.filterPresets',

  // Community
  COMMUNITY_COMPLIANCE_DISMISSED: 'community.complianceBannerDismissed',
} as const;

// Support & Feedback MMKV Storage Keys
export const SUPPORT_STORAGE_KEYS = {
  // Help Center
  HELP_SEARCH_INDEX: 'help.searchIndex',
  HELP_SEARCH_HISTORY: 'help.searchHistory',
  HELP_ARTICLE_TELEMETRY: 'help.articleTelemetry',
  HELP_CACHE_VERSION: 'help.cacheVersion',

  // Support Tickets
  SUPPORT_QUEUE_META: 'support.queueMeta',
  SUPPORT_DRAFT: 'support.draft',

  // Rating & Feedback
  RATING_LAST_PROMPT: 'rating.lastPrompt',
  RATING_OPT_OUT: 'rating.optOut',
  RATING_HISTORY: 'rating.history',
  // Help article ratings (local cache before backend sync)
  HELP_ARTICLE_RATINGS: 'help.articleRatings',

  // Status
  SYSTEM_STATUS_CACHE: 'status.cache',
  STATUS_BANNER_DISMISSED: 'status.bannerDismissed',

  // Educational Content
  EDUCATION_CONTENT_MAP: 'education.contentMap',
  EDUCATION_PREFETCH_QUEUE: 'education.prefetchQueue',

  // Second Opinion
  SECOND_OPINION_CONSENT: 'secondOpinion.consent',
} as const;
