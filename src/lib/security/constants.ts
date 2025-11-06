/**
 * Security constants for the application
 */

import type { PIIPattern, VulnerabilitySeverity } from './types';

// ==================== Sentry Configuration ====================

export const SENTRY_CATEGORY = 'security' as const;

export const SENTRY_SAMPLING = {
  CRITICAL: 1.0, // 100% sampling for critical events
  DEFAULT: 0.1, // 10% sampling for other events
} as const;

// ==================== Security Event Types ====================

export const SECURITY_EVENT_TYPES = {
  AUTH_FAILED: 'auth_failed',
  INTEGRITY_COMPROMISED: 'integrity_compromised',
  PIN_VIOLATION: 'pin_violation',
  RATE_LIMIT_HIT: 'rate_limit_hit',
  SESSION_ANOMALY: 'session_anomaly',
  STORAGE_REKEY: 'storage_rekey',
} as const;

export const SECURITY_EVENT_SEVERITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;

// ==================== Auth Throttling Constants ====================

/**
 * Exponential backoff sequence in milliseconds
 * 1s → 2s → 4s → 8s → 16s → 30s (capped)
 */
export const AUTH_BACKOFF_SEQUENCE = [1000, 2000, 4000, 8000, 16000, 30000];

/**
 * Maximum failed attempts before lockout
 */
export const AUTH_MAX_ATTEMPTS = 5;

/**
 * Lockout duration in milliseconds (15 minutes)
 */
export const AUTH_LOCKOUT_DURATION = 15 * 60 * 1000;

/**
 * Storage key for attempt counter
 */
export const AUTH_ATTEMPTS_KEY = 'security:auth:attempts';

/**
 * Storage key for lockout timestamp
 */
export const AUTH_LOCKOUT_KEY = 'security:auth:lockout';

// ==================== Device Integrity Constants ====================

/**
 * Cache TTL for integrity status (24 hours)
 */
export const INTEGRITY_CACHE_TTL = 24 * 60 * 60 * 1000;

/**
 * Storage key for integrity status
 */
export const INTEGRITY_STATUS_KEY = 'security:integrity:status';

/**
 * iOS jailbreak indicators
 */
export const IOS_JAILBREAK_INDICATORS = [
  '/Applications/Cydia.app',
  '/Library/MobileSubstrate/MobileSubstrate.dylib',
  '/bin/bash',
  '/usr/sbin/sshd',
  '/etc/apt',
  '/private/var/lib/apt/',
] as const;

/**
 * Android root indicators
 */
export const ANDROID_ROOT_INDICATORS = [
  '/system/app/Superuser.apk',
  '/sbin/su',
  '/system/bin/su',
  '/system/xbin/su',
  '/data/local/xbin/su',
  '/data/local/bin/su',
  '/system/sd/xbin/su',
  '/system/bin/failsafe/su',
  '/data/local/su',
] as const;

// ==================== Certificate Pinning Constants ====================

/**
 * Remote config cache TTL in milliseconds (7 days)
 */
export const PIN_CONFIG_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

/**
 * Remote config stale threshold (30 days)
 */
export const PIN_CONFIG_STALE_THRESHOLD = 30 * 24 * 60 * 60 * 1000;

/**
 * Pin expiry warning thresholds in days
 */
export const PIN_EXPIRY_WARNING_DAYS = [30, 7, 1] as const;

/**
 * Storage key for cached pin configuration
 */
export const PIN_CONFIG_CACHE_KEY = 'security:pinning:config';

// ==================== PII Scrubbing Patterns ====================

/**
 * PII detection patterns for scrubbing
 */
export const PII_PATTERNS: PIIPattern[] = [
  {
    name: 'email',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: '[EMAIL_REDACTED]',
  },
  {
    name: 'ipv4',
    pattern:
      /\b(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]?|[8-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    replacement: '[IP_REDACTED]',
  },
  {
    name: 'ipv6',
    pattern:
      /\b(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}\b|\b(?:[a-fA-F0-9]{1,4}:){1,7}:\b/g,
    replacement: '[IP_REDACTED]',
  },
  {
    name: 'jwt',
    pattern: /eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
    replacement: '[JWT_REDACTED]',
  },
  {
    name: 'uuid',
    pattern:
      /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g,
    replacement: '[UUID_REDACTED]',
  },
  {
    name: 'phone',
    pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    replacement: '[PHONE_REDACTED]',
  },
  {
    name: 'authorization',
    pattern: /Bearer\s+[a-zA-Z0-9_-]+/gi,
    replacement: 'Bearer [TOKEN_REDACTED]',
  },
];

/**
 * HTTP headers to redact
 */
export const REDACTED_HEADERS = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-auth-token',
] as const;

/**
 * Endpoints where request bodies should be dropped
 */
export const BODY_DROP_ENDPOINTS = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh',
  '/auth/password',
  '/profile',
  '/user',
] as const;

// ==================== Vulnerability Management Constants ====================

/**
 * SLA deadlines by severity (in days)
 */
export const VULNERABILITY_SLA: Record<VulnerabilitySeverity, number> = {
  critical: 1,
  high: 7,
  medium: 30,
  low: 90,
} as const;

/**
 * Security scan artifact directory
 */
export const SECURITY_REPORTS_DIR = 'build/reports/security';

// ==================== Storage Domain Keys ====================

/**
 * MMKV instance IDs for different security domains
 */
export const STORAGE_DOMAINS = {
  AUTH: 'auth',
  USER_DATA: 'user-data',
  SYNC_METADATA: 'sync-metadata',
  SECURITY_CACHE: 'security-cache',
  FEATURE_FLAGS: 'feature-flags',
} as const;

/**
 * Sentinel key for encryption verification
 */
export const ENCRYPTION_SENTINEL_KEY = 'security:encryption:sentinel';

/**
 * Sentinel value (arbitrary constant)
 */
export const ENCRYPTION_SENTINEL_VALUE = 'encrypted_storage_v1';

/**
 * Key-to-domain map for audit trail
 */
export const KEY_DOMAIN_MAP: Record<string, string> = {
  'auth:token': STORAGE_DOMAINS.AUTH,
  'auth:refresh': STORAGE_DOMAINS.AUTH,
  'auth:session': STORAGE_DOMAINS.AUTH,
  'user:preferences': STORAGE_DOMAINS.USER_DATA,
  'user:settings': STORAGE_DOMAINS.USER_DATA,
  'sync:last_sync': STORAGE_DOMAINS.SYNC_METADATA,
  'sync:pending': STORAGE_DOMAINS.SYNC_METADATA,
  'security:integrity:status': STORAGE_DOMAINS.SECURITY_CACHE,
  'security:pinning:config': STORAGE_DOMAINS.SECURITY_CACHE,
  'security:auth:attempts': STORAGE_DOMAINS.SECURITY_CACHE,
  'feature:flags': STORAGE_DOMAINS.FEATURE_FLAGS,
};

// ==================== Encryption Key Constants ====================

/**
 * Encryption key length in bytes
 */
export const ENCRYPTION_KEY_LENGTH = 32;

/**
 * Key metadata storage key
 */
export const KEY_METADATA_KEY = 'security:encryption:metadata';

/**
 * App-specific salt for device fingerprint hashing
 * WARNING: Never change this value.
 * Changing this salt will invalidate all existing device fingerprints and
 * potentially break security telemetry correlation for historical data.
 * Only update if you are intentionally migrating all fingerprints and
 * understand the impact on device-based authentication and audit trails.
 */
export const DEVICE_FINGERPRINT_SALT = 'growbro_device_fp_v1_2025';

/**
 * Device fingerprint storage key
 */
export const DEVICE_FINGERPRINT_KEY = 'security:device:fingerprint';

// ==================== Background Job Constants ====================

/**
 * Weekly pin expiry check interval (7 days in milliseconds)
 */
export const PIN_EXPIRY_CHECK_INTERVAL = 7 * 24 * 60 * 60 * 1000;

/**
 * Background task identifier for pin expiry check
 */
export const PIN_EXPIRY_TASK_NAME = 'security-pin-expiry-check';
