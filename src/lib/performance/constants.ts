/**
 * Standardized transaction names for performance monitoring
 * These names are used across Sentry and RN Performance for consistent tracking
 */
export const PERFORMANCE_TRANSACTIONS = {
  AGENDA_SCROLL: 'agenda.scroll',
  NAVIGATION_PUSH: 'navigation.push',
  SYNC_PULL: 'sync.pull',
  SYNC_PUSH: 'sync.push',
  AI_INFER: 'ai.infer',
  IMAGE_DECODE: 'image.decode',
} as const;

/**
 * Performance operation types for Sentry spans
 */
export const PERFORMANCE_OPERATIONS = {
  DB_READ: 'db.read',
  DB_WRITE: 'db.write',
  NETWORK_REQUEST: 'http.client',
  IMAGE_PROCESSING: 'image.process',
  UI_RENDER: 'ui.render',
  SYNC: 'sync',
} as const;

/**
 * Performance metrics thresholds (in milliseconds)
 */
export const PERFORMANCE_THRESHOLDS = {
  // Startup
  TTI_PIXEL_6A: 1800, // 1.8s
  TTI_IPHONE_12: 1300, // 1.3s

  // Navigation
  NAVIGATION_P95: 250, // 250ms

  // Scrolling
  FRAME_TIME_TARGET: 16.7, // 16.7ms for 60 FPS
  MIN_FPS: 58,
  MAX_DROPPED_FRAMES_PERCENT: 1,

  // Sync
  SYNC_500_ITEMS_P95: 2500, // 2.5s

  // Gestures
  INPUT_TO_RENDER_P95: 50, // 50ms
} as const;

/**
 * Sentry performance configuration
 */
export const SENTRY_PERFORMANCE_CONFIG = {
  TRACES_SAMPLE_RATE_PRODUCTION: 0.1, // 10% sampling in production
  TRACES_SAMPLE_RATE_STAGING: 0.25,
  TRACES_SAMPLE_RATE_DEVELOPMENT: 1.0, // 100% sampling in development
  ENABLE_AUTO_INSTRUMENTATION: true,
  ENABLE_NAVIGATION_INSTRUMENTATION: true,
  ENABLE_APP_START_INSTRUMENTATION: true,
  ENABLE_STALL_TRACKING: true,
  // Maximum duration to wait for performance spans to complete (30 seconds)
  SPAN_TIMEOUT_MS: 30000,
} as const;

export type PerformanceTransaction =
  (typeof PERFORMANCE_TRANSACTIONS)[keyof typeof PERFORMANCE_TRANSACTIONS];

export type PerformanceOperation =
  (typeof PERFORMANCE_OPERATIONS)[keyof typeof PERFORMANCE_OPERATIONS];
