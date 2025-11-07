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
  storage.set(key, JSON.stringify(value));
}

export function removeItem(key: string): void {
  storage.delete(key);
}

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

  // Status
  SYSTEM_STATUS_CACHE: 'status.cache',
  STATUS_BANNER_DISMISSED: 'status.bannerDismissed',

  // Educational Content
  EDUCATION_CONTENT_MAP: 'education.contentMap',
  EDUCATION_PREFETCH_QUEUE: 'education.prefetchQueue',

  // Second Opinion
  SECOND_OPINION_CONSENT: 'secondOpinion.consent',
} as const;
