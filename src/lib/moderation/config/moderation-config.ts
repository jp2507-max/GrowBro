/**
 * Moderation System Configuration
 *
 * Environment-specific configuration for the DSA-compliant moderation system.
 * Supports development, staging, and production environments with secure
 * credential management and feature flag controls.
 */

import { z } from 'zod';

/**
 * Environment types
 */
export type Environment = 'development' | 'staging' | 'production';

/**
 * Configuration schema for moderation system
 */
const ModerationConfigSchema = z.object({
  // Environment
  environment: z.enum(['development', 'staging', 'production']),

  // Feature Flags
  features: z.object({
    contentReporting: z.boolean().default(false),
    moderationQueue: z.boolean().default(false),
    appeals: z.boolean().default(false),
    odsIntegration: z.boolean().default(false),
    sorExport: z.boolean().default(false),
    ageVerification: z.boolean().default(false),
    geoBlocking: z.boolean().default(false),
    trustedFlaggers: z.boolean().default(false),
    repeatOffenderDetection: z.boolean().default(false),
    transparencyReporting: z.boolean().default(false),
  }),

  // SLA Configuration
  sla: z.object({
    csam: z.number().default(0), // Immediate
    selfHarm: z.number().default(0), // Immediate
    credibleThreats: z.number().default(1), // 1 hour
    illegalContent: z.number().default(24), // 24 hours
    policyViolation: z.number().default(72), // 72 hours
    warningThreshold: z.number().default(0.75), // 75%
    criticalThreshold: z.number().default(0.9), // 90%
  }),

  // DSA Transparency Database
  dsa: z.object({
    enabled: z.boolean().default(false),
    apiUrl: z.string().url().optional(),
    apiKey: z.string().optional(),
    batchSize: z.number().min(1).max(100).default(50),
    retryAttempts: z.number().default(3),
    retryDelay: z.number().default(1000),
    circuitBreakerThreshold: z.number().default(5),
    circuitBreakerTimeout: z.number().default(60000),
  }),

  // PII Scrubbing
  pii: z.object({
    salt: z.string().optional(),
    saltVersion: z.string().default('v1.0'),
    kAnonymity: z.number().default(5),
  }),

  // Age Verification
  ageVerification: z.object({
    enabled: z.boolean().default(false),
    tokenExpiryDays: z.number().default(90),
    appealWindowDays: z.number().default(7),
    provider: z.string().optional(),
  }),

  // Geo-Location
  geoLocation: z.object({
    enabled: z.boolean().default(false),
    ipGeolocationProvider: z.string().default('internal'),
    vpnBlockingEnabled: z.boolean().default(false),
    decisionCacheTtl: z.number().default(3600000), // 1 hour
  }),

  // Audit Configuration
  audit: z.object({
    enabled: z.boolean().default(true),
    retentionDays: z.number().default(365),
    signingEnabled: z.boolean().default(true),
    partitioningEnabled: z.boolean().default(true),
  }),

  // Database Configuration
  database: z.object({
    maxConnections: z.number().default(20),
    connectionTimeout: z.number().default(30000),
    queryTimeout: z.number().default(60000),
    enablePartitioning: z.boolean().default(true),
  }),

  // Rate Limiting
  rateLimiting: z.object({
    reportsPerUser: z.number().default(10),
    reportsPerUserWindow: z.number().default(3600000), // 1 hour
    appealsPerUser: z.number().default(5),
    appealsPerUserWindow: z.number().default(86400000), // 24 hours
  }),

  // Monitoring
  monitoring: z.object({
    enabled: z.boolean().default(true),
    healthCheckInterval: z.number().default(30000), // 30 seconds
    metricsInterval: z.number().default(60000), // 1 minute
    sentryEnabled: z.boolean().default(true),
  }),
});

export type ModerationConfig = z.infer<typeof ModerationConfigSchema>;

/**
 * Load configuration from environment variables
 */
function loadConfigFromEnv(): Partial<ModerationConfig> {
  const env = (process.env.APP_ENV || 'development') as Environment;

  return {
    environment: env,
    features: {
      contentReporting:
        process.env.FEATURE_CONTENT_REPORTING_ENABLED === 'true',
      moderationQueue: process.env.FEATURE_MODERATION_QUEUE_ENABLED === 'true',
      appeals: process.env.FEATURE_APPEALS_ENABLED === 'true',
      odsIntegration: process.env.FEATURE_ODS_INTEGRATION_ENABLED === 'true',
      sorExport: process.env.FEATURE_SOR_EXPORT_ENABLED === 'true',
      ageVerification: process.env.FEATURE_AGE_VERIFICATION_ENABLED === 'true',
      geoBlocking: process.env.FEATURE_GEO_BLOCKING_ENABLED === 'true',
      trustedFlaggers: process.env.FEATURE_TRUSTED_FLAGGERS_ENABLED === 'true',
      repeatOffenderDetection:
        process.env.FEATURE_REPEAT_OFFENDER_DETECTION_ENABLED === 'true',
      transparencyReporting:
        process.env.FEATURE_TRANSPARENCY_REPORTING_ENABLED === 'true',
    },
    dsa: {
      enabled: process.env.FEATURE_SOR_EXPORT_ENABLED === 'true',
      apiUrl: process.env.DSA_TRANSPARENCY_DB_URL,
      apiKey: process.env.DSA_TRANSPARENCY_DB_API_KEY,
      retryDelay: 5000,
      batchSize: 100,
      retryAttempts: 3,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeout: 60000,
    },
    pii: {
      salt: process.env.PII_SCRUBBING_SALT,
      saltVersion: process.env.PII_SALT_VERSION || 'v1.0',
      kAnonymity: 5,
    },
    ageVerification: {
      enabled: process.env.FEATURE_AGE_VERIFICATION_ENABLED === 'true',
      tokenExpiryDays: 90,
      appealWindowDays: 30,
    },
    geoLocation: {
      enabled: process.env.FEATURE_GEO_BLOCKING_ENABLED === 'true',
      ipGeolocationProvider: 'ipinfo',
      vpnBlockingEnabled: false,
      decisionCacheTtl: 3600000,
    },
  };
}

/**
 * Base default configuration
 */
const baseDefaults: ModerationConfig = {
  environment: 'development',
  features: {
    contentReporting: false,
    moderationQueue: false,
    appeals: false,
    odsIntegration: false,
    sorExport: false,
    ageVerification: false,
    geoBlocking: false,
    trustedFlaggers: false,
    repeatOffenderDetection: false,
    transparencyReporting: false,
  },
  sla: {
    csam: 0,
    selfHarm: 0,
    credibleThreats: 1,
    illegalContent: 24,
    policyViolation: 72,
    warningThreshold: 0.75,
    criticalThreshold: 0.9,
  },
  dsa: {
    enabled: false,
    batchSize: 50,
    retryAttempts: 3,
    retryDelay: 1000,
    circuitBreakerThreshold: 5,
    circuitBreakerTimeout: 60000,
  },
  pii: {
    saltVersion: 'v1.0',
    kAnonymity: 5,
  },
  ageVerification: {
    enabled: false,
    tokenExpiryDays: 90,
    appealWindowDays: 7,
  },
  geoLocation: {
    enabled: false,
    ipGeolocationProvider: 'internal',
    vpnBlockingEnabled: false,
    decisionCacheTtl: 3600000,
  },
  audit: {
    enabled: true,
    retentionDays: 365,
    signingEnabled: true,
    partitioningEnabled: true,
  },
  database: {
    maxConnections: 20,
    connectionTimeout: 30000,
    queryTimeout: 60000,
    enablePartitioning: true,
  },
  rateLimiting: {
    reportsPerUser: 10,
    reportsPerUserWindow: 3600000,
    appealsPerUser: 5,
    appealsPerUserWindow: 86400000,
  },
  monitoring: {
    enabled: true,
    healthCheckInterval: 30000,
    metricsInterval: 60000,
    sentryEnabled: false,
  },
};

/**
 * Default configurations for each environment
 */
const environmentDefaults: Record<Environment, Partial<ModerationConfig>> = {
  development: {
    environment: 'development',
    features: {
      contentReporting: true,
      moderationQueue: true,
      appeals: true,
      odsIntegration: false,
      sorExport: false,
      ageVerification: false,
      geoBlocking: false,
      trustedFlaggers: true,
      repeatOffenderDetection: true,
      transparencyReporting: false,
    },
    monitoring: {
      enabled: true,
      healthCheckInterval: 60000, // 1 minute in dev
      metricsInterval: 120000, // 2 minutes in dev
      sentryEnabled: false,
    },
  },
  staging: {
    environment: 'staging',
    features: {
      contentReporting: true,
      moderationQueue: true,
      appeals: true,
      odsIntegration: false,
      sorExport: false,
      ageVerification: false,
      geoBlocking: false,
      trustedFlaggers: true,
      repeatOffenderDetection: true,
      transparencyReporting: false,
    },
    monitoring: {
      enabled: true,
      healthCheckInterval: 30000,
      metricsInterval: 60000,
      sentryEnabled: true,
    },
  },
  production: {
    environment: 'production',
    features: {
      contentReporting: false,
      moderationQueue: false,
      appeals: false,
      odsIntegration: false,
      sorExport: false,
      ageVerification: false,
      geoBlocking: false,
      trustedFlaggers: false,
      repeatOffenderDetection: false,
      transparencyReporting: false,
    },
    monitoring: {
      enabled: true,
      healthCheckInterval: 30000,
      metricsInterval: 60000,
      sentryEnabled: true,
    },
  },
};

/**
 * Deep merge objects
 */
function deepMerge<T extends Record<string, unknown>>(
  target: T,
  ...sources: Partial<T>[]
): T {
  const result = { ...target };

  for (const source of sources) {
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const sourceValue = source[key];
        const targetValue = result[key];

        if (
          sourceValue &&
          typeof sourceValue === 'object' &&
          !Array.isArray(sourceValue) &&
          targetValue &&
          typeof targetValue === 'object' &&
          !Array.isArray(targetValue)
        ) {
          result[key] = deepMerge(
            targetValue as Record<string, unknown>,
            sourceValue as Record<string, unknown>
          ) as T[Extract<keyof T, string>];
        } else if (sourceValue !== undefined) {
          result[key] = sourceValue as T[Extract<keyof T, string>];
        }
      }
    }
  }

  return result;
}

/**
 * Create moderation configuration
 */
export function createModerationConfig(
  overrides?: Partial<ModerationConfig>
): ModerationConfig {
  const env = (process.env.APP_ENV || 'development') as Environment;
  const envDefaults = environmentDefaults[env];
  const envConfig = loadConfigFromEnv();

  // Deep merge all configs: base -> env defaults -> env config -> overrides
  const config = deepMerge(
    baseDefaults,
    envDefaults,
    envConfig,
    overrides || {}
  );

  return ModerationConfigSchema.parse(config);
}

/**
 * Singleton configuration instance
 */
let configInstance: ModerationConfig | null = null;

/**
 * Get moderation configuration
 */
export function getModerationConfig(): ModerationConfig {
  if (!configInstance) {
    configInstance = createModerationConfig();
  }
  return configInstance;
}

/**
 * Reset configuration (for testing)
 */
export function resetModerationConfig(): void {
  configInstance = null;
}

/**
 * Validate configuration
 */
export function validateModerationConfig(config: Partial<ModerationConfig>): {
  valid: boolean;
  errors: string[];
} {
  const result = ModerationConfigSchema.safeParse(config);

  if (result.success) {
    return { valid: true, errors: [] };
  }

  const errors = result.error.errors.map(
    (err) => `${err.path.join('.')}: ${err.message}`
  );

  return { valid: false, errors };
}
