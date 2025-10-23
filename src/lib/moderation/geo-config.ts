/**
 * Geo-Location Configuration
 * Manages environment-specific settings for geographic content filtering
 * Part of Task 10: Geo-Location Service (Requirements 9.1-9.7)
 */

import type { GeoLocationConfig } from '@/types/geo-location';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: GeoLocationConfig = {
  vpnBlockingEnabled: false, // Disabled by default; enable via feature flag
  cacheTtlMs: 3600000, // 1 hour (3600000ms)
  ruleUpdateSlaMs: 14400000, // 4 hours (14400000ms)
  ipProvider: 'supabase', // Use Supabase edge function by default
  defaultConfidenceThreshold: 0.7, // Minimum confidence for location data
};

/**
 * Environment variable keys for geo-location configuration
 */
const ENV_KEYS = {
  VPN_BLOCKING_ENABLED: 'GEO_VPN_BLOCKING_ENABLED',
  CACHE_TTL_MS: 'GEO_CACHE_TTL_MS',
  RULE_UPDATE_SLA_MS: 'GEO_RULE_UPDATE_SLA_MS',
  IP_PROVIDER: 'GEO_IP_PROVIDER',
  CONFIDENCE_THRESHOLD: 'GEO_CONFIDENCE_THRESHOLD',
} as const;

/**
 * Get geo-location configuration with environment overrides
 */
export function getGeoLocationConfig(): GeoLocationConfig {
  return {
    vpnBlockingEnabled:
      process.env[ENV_KEYS.VPN_BLOCKING_ENABLED] === 'true' ||
      DEFAULT_CONFIG.vpnBlockingEnabled,
    cacheTtlMs: parseInt(
      process.env[ENV_KEYS.CACHE_TTL_MS] || String(DEFAULT_CONFIG.cacheTtlMs),
      10
    ),
    ruleUpdateSlaMs: parseInt(
      process.env[ENV_KEYS.RULE_UPDATE_SLA_MS] ||
        String(DEFAULT_CONFIG.ruleUpdateSlaMs),
      10
    ),
    ipProvider:
      (process.env[ENV_KEYS.IP_PROVIDER] as GeoLocationConfig['ipProvider']) ||
      DEFAULT_CONFIG.ipProvider,
    defaultConfidenceThreshold: parseFloat(
      process.env[ENV_KEYS.CONFIDENCE_THRESHOLD] ||
        String(DEFAULT_CONFIG.defaultConfidenceThreshold)
    ),
  };
}

/**
 * Region codes for common geographic areas
 */
export const REGION_CODES = {
  EU: 'EU', // European Union
  US: 'US', // United States
  CA: 'CA', // Canada
  UK: 'GB', // United Kingdom
  DE: 'DE', // Germany
  FR: 'FR', // France
  ES: 'ES', // Spain
  IT: 'IT', // Italy
  NL: 'NL', // Netherlands
  AU: 'AU', // Australia
  NZ: 'NZ', // New Zealand
} as const;

/**
 * EU member states (ISO 3166-1 alpha-2)
 * Updated as of 2025
 */
export const EU_MEMBER_STATES = [
  'AT', // Austria
  'BE', // Belgium
  'BG', // Bulgaria
  'HR', // Croatia
  'CY', // Cyprus
  'CZ', // Czech Republic
  'DK', // Denmark
  'EE', // Estonia
  'FI', // Finland
  'FR', // France
  'DE', // Germany
  'GR', // Greece
  'HU', // Hungary
  'IE', // Ireland
  'IT', // Italy
  'LV', // Latvia
  'LT', // Lithuania
  'LU', // Luxembourg
  'MT', // Malta
  'NL', // Netherlands
  'PL', // Poland
  'PT', // Portugal
  'RO', // Romania
  'SK', // Slovakia
  'SI', // Slovenia
  'ES', // Spain
  'SE', // Sweden
] as const;

/**
 * Check if a region code is an EU member state
 */
export function isEuMemberState(regionCode: string): boolean {
  return EU_MEMBER_STATES.includes(
    regionCode.toUpperCase() as (typeof EU_MEMBER_STATES)[number]
  );
}

/**
 * Expand 'EU' region code to all EU member states
 */
export function expandEuRegionCode(regionCodes: string[]): string[] {
  const expanded = new Set<string>();

  regionCodes.forEach((code) => {
    if (code.toUpperCase() === 'EU') {
      EU_MEMBER_STATES.forEach((euCode) => expanded.add(euCode));
    } else {
      expanded.add(code.toUpperCase());
    }
  });

  return Array.from(expanded);
}

/**
 * Explainer text templates for geo-restrictions
 */
export const GEO_RESTRICTION_EXPLAINERS = {
  illegal_content: (regions: string[]) =>
    `This content is not available in ${regions.join(', ')} due to legal restrictions. The content violates local laws in these regions.`,
  policy_violation: (regions: string[]) =>
    `This content is not available in ${regions.join(', ')} due to platform policy. Our community guidelines require region-specific content moderation.`,
  legal_request: (regions: string[]) =>
    `This content has been restricted in ${regions.join(', ')} following a legal request from authorities in these regions.`,
  age_restriction: (regions: string[]) =>
    `This content is age-restricted in ${regions.join(', ')}. Please verify your age to access this content.`,
} as const;

/**
 * SLA thresholds for rule updates
 */
export const RULE_UPDATE_SLA = {
  TARGET_MS: 14400000, // 4 hours (default)
  WARNING_THRESHOLD_PERCENT: 75, // Alert at 75% of SLA
  CRITICAL_THRESHOLD_PERCENT: 90, // Escalate at 90% of SLA
} as const;

/**
 * Cache configuration
 */
export const CACHE_CONFIG = {
  DEFAULT_TTL_MS: 3600000, // 1 hour
  MIN_TTL_MS: 300000, // 5 minutes
  MAX_TTL_MS: 86400000, // 24 hours
  REVALIDATE_ON_APP_START: true,
} as const;

/**
 * VPN detection configuration
 */
export const VPN_DETECTION_CONFIG = {
  CONFIDENCE_THRESHOLD: 0.8, // 80% confidence to flag as VPN
  CACHE_TTL_MS: 3600000, // 1 hour
  MAX_RETRIES: 2,
  FALLBACK_TO_IP: true, // Use IP-based location if VPN detected
} as const;

/**
 * GPS location request configuration
 */
export const GPS_CONFIG = {
  TIMEOUT_MS: 10000, // 10 seconds
  MAX_AGE_MS: 300000, // 5 minutes (accept cached GPS data within 5 min)
  ENABLE_HIGH_ACCURACY: false, // Default to battery-efficient mode
  MIN_ACCURACY_METERS: 1000, // Minimum acceptable accuracy (1km)
} as const;

/**
 * Notification configuration for geo-restrictions
 */
export const NOTIFICATION_CONFIG = {
  AUTHOR_ALERT_DELAY_MS: 0, // Send immediately
  USER_EXPLAINER_DELAY_MS: 0, // Send immediately
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 5000, // 5 seconds between retries
} as const;

/**
 * Appeal configuration
 */
export const APPEAL_CONFIG = {
  REVIEW_SLA_HOURS: 48, // 2 days to review appeal
  MAX_APPEALS_PER_RESTRICTION: 3,
  SUPPORTING_EVIDENCE_MAX_SIZE_MB: 10,
  SUPPORTING_EVIDENCE_ALLOWED_TYPES: [
    'image/jpeg',
    'image/png',
    'application/pdf',
  ] as const,
} as const;
