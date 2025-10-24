/**
 * Moderation Configuration Tests
 */

import {
  createModerationConfig,
  getModerationConfig,
  resetModerationConfig,
  validateModerationConfig,
} from './moderation-config';

describe('ModerationConfig', () => {
  beforeEach(() => {
    resetModerationConfig();
  });

  describe('createModerationConfig', () => {
    test('creates config with defaults', () => {
      const config = createModerationConfig();

      expect(config).toBeDefined();
      expect(config.environment).toBe('development');
      expect(config.features).toBeDefined();
      expect(config.sla).toBeDefined();
      expect(config.dsa).toBeDefined();
    });

    test('applies environment-specific defaults', () => {
      process.env.APP_ENV = 'production';

      const config = createModerationConfig();

      expect(config.environment).toBe('production');
      expect(config.features.contentReporting).toBe(false);
      expect(config.features.moderationQueue).toBe(false);
    });

    test('applies overrides', () => {
      const config = createModerationConfig({
        features: {
          contentReporting: true,
          moderationQueue: true,
          appeals: false,
          odsIntegration: false,
          sorExport: false,
          ageVerification: false,
          geoBlocking: false,
          trustedFlaggers: false,
          repeatOffenderDetection: false,
          transparencyReporting: false,
        },
      });

      expect(config.features.contentReporting).toBe(true);
      expect(config.features.moderationQueue).toBe(true);
      expect(config.features.appeals).toBe(false);
    });

    test('loads from environment variables', () => {
      process.env.FEATURE_CONTENT_REPORTING_ENABLED = 'true';
      process.env.DSA_TRANSPARENCY_DB_URL = 'https://test.example.com';
      process.env.DSA_TRANSPARENCY_DB_API_KEY = 'test-key';

      const config = createModerationConfig();

      expect(config.features.contentReporting).toBe(true);
      expect(config.dsa.apiUrl).toBe('https://test.example.com');
      expect(config.dsa.apiKey).toBe('test-key');
    });
  });

  describe('getModerationConfig', () => {
    test('returns singleton instance', () => {
      const config1 = getModerationConfig();
      const config2 = getModerationConfig();

      expect(config1).toBe(config2);
    });

    test('creates instance on first call', () => {
      const config = getModerationConfig();

      expect(config).toBeDefined();
      expect(config.environment).toBeDefined();
    });
  });

  describe('validateModerationConfig', () => {
    test('validates valid config', () => {
      const config = createModerationConfig();
      const result = validateModerationConfig(config);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('rejects invalid environment', () => {
      const config = {
        environment: 'invalid' as any,
      };

      const result = validateModerationConfig(config);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('validates SLA configuration', () => {
      const config = createModerationConfig({
        sla: {
          csam: 0,
          selfHarm: 0,
          credibleThreats: 1,
          illegalContent: 24,
          policyViolation: 72,
          warningThreshold: 0.75,
          criticalThreshold: 0.9,
        },
      });

      const result = validateModerationConfig(config);

      expect(result.valid).toBe(true);
    });

    test('validates DSA configuration', () => {
      const config = createModerationConfig({
        dsa: {
          enabled: true,
          apiUrl: 'https://transparency-db.ec.europa.eu',
          apiKey: 'test-key',
          batchSize: 50,
          retryAttempts: 3,
          retryDelay: 1000,
          circuitBreakerThreshold: 5,
          circuitBreakerTimeout: 60000,
        },
      });

      const result = validateModerationConfig(config);

      expect(result.valid).toBe(true);
    });
  });

  describe('Feature Flags', () => {
    test('all features disabled in production by default', () => {
      const originalEnv = process.env.APP_ENV;
      process.env.APP_ENV = 'production';
      resetModerationConfig();

      const config = createModerationConfig();

      expect(config.environment).toBe('production');
      expect(config.features.contentReporting).toBe(false);
      expect(config.features.moderationQueue).toBe(false);
      expect(config.features.appeals).toBe(false);
      expect(config.features.odsIntegration).toBe(false);
      expect(config.features.sorExport).toBe(false);
      expect(config.features.ageVerification).toBe(false);
      expect(config.features.geoBlocking).toBe(false);
      expect(config.features.trustedFlaggers).toBe(false);
      expect(config.features.repeatOffenderDetection).toBe(false);
      expect(config.features.transparencyReporting).toBe(false);

      process.env.APP_ENV = originalEnv;
    });

    test('features enabled in development by default', () => {
      const originalEnv = process.env.APP_ENV;
      process.env.APP_ENV = 'development';
      resetModerationConfig();

      const config = createModerationConfig();

      expect(config.environment).toBe('development');
      expect(config.features.contentReporting).toBe(true);
      expect(config.features.moderationQueue).toBe(true);
      expect(config.features.appeals).toBe(true);

      process.env.APP_ENV = originalEnv;
    });
  });

  describe('SLA Configuration', () => {
    test('has correct default SLA values', () => {
      const config = createModerationConfig();

      expect(config.sla.csam).toBe(0);
      expect(config.sla.selfHarm).toBe(0);
      expect(config.sla.credibleThreats).toBe(1);
      expect(config.sla.illegalContent).toBe(24);
      expect(config.sla.policyViolation).toBe(72);
      expect(config.sla.warningThreshold).toBe(0.75);
      expect(config.sla.criticalThreshold).toBe(0.9);
    });
  });

  describe('Monitoring Configuration', () => {
    test('has correct monitoring defaults', () => {
      const config = createModerationConfig();

      expect(config.monitoring.enabled).toBe(true);
      expect(config.monitoring.healthCheckInterval).toBeGreaterThan(0);
      expect(config.monitoring.metricsInterval).toBeGreaterThan(0);
    });

    test('adjusts intervals for development', () => {
      process.env.APP_ENV = 'development';

      const config = createModerationConfig();

      expect(config.monitoring.healthCheckInterval).toBe(60000);
      expect(config.monitoring.metricsInterval).toBe(120000);
    });
  });
});
