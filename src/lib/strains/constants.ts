/**
 * Constants and default values for strains feature
 */

/**
 * Default BlurHash placeholder for strain images
 * Represents a neutral gray/green gradient
 */
export const DEFAULT_STRAIN_BLURHASH = 'LGF5]+Yk^6#M@-5c,1J5@[or[Q6.';

/**
 * Default message for missing or unavailable data
 */
export const NOT_REPORTED = 'Not reported';

/**
 * Default description when strain description is missing
 */
export const DEFAULT_DESCRIPTION = 'No description available';

/**
 * Default flowering time label when data is missing
 */
export const DEFAULT_FLOWERING_TIME = 'Varies';

/**
 * Default yield label when data is missing
 */
export const DEFAULT_YIELD = 'Not reported';

/**
 * Default height label when data is missing
 */
export const DEFAULT_HEIGHT = 'Not reported';

/**
 * Fallback image placeholder for broken or missing strain images
 * Uses blurhash for lightweight placeholder rendering
 */
export const FALLBACK_IMAGE_BLURHASH = DEFAULT_STRAIN_BLURHASH;

/**
 * Error messages for API failures
 */
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
  API_ERROR: 'Failed to load strain data. Please try again.',
  RATE_LIMITED: 'Too many requests. Please wait a moment.',
  NOT_FOUND: 'Strain not found.',
  PARSE_ERROR: 'Failed to process strain data.',
} as const;

/**
 * Pagination defaults
 */
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  PRELOAD_THRESHOLD: 0.7,
  MAX_CACHED_PAGES: 10,
} as const;

/**
 * Cache durations in milliseconds
 */
export const CACHE_DURATION = {
  STRAIN_LIST: 5 * 60 * 1000, // 5 minutes
  STRAIN_DETAIL: 24 * 60 * 60 * 1000, // 24 hours
  IMAGE_CACHE: 7 * 24 * 60 * 60 * 1000, // 7 days
} as const;

/**
 * Search debounce delay in milliseconds
 */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Retry configuration for API requests
 */
export const RETRY_CONFIG = {
  MAX_RETRIES: 1,
  BASE_DELAY_MS: 1000,
  MAX_DELAY_MS: 5000,
  JITTER_FACTOR: 0.1,
} as const;
