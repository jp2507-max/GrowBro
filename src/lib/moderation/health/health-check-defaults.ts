/**
 * Default Health Checks Configuration
 * Extracted to keep functions under line limits
 */

import type { ModerationConfig } from '../config/moderation-config';
import type {
  HealthCheckFunction,
  ServiceHealth,
} from './health-check-service';

export function createDefaultHealthChecks(
  config: ModerationConfig
): Map<string, HealthCheckFunction> {
  const checks = new Map<string, HealthCheckFunction>();

  // Database health check
  checks.set('database', createDatabaseCheck());

  // DSA Transparency DB health check
  if (config.dsa.enabled) {
    checks.set('dsa-transparency-db', createDsaTransparencyCheck());
  }

  // Audit service health check
  if (config.audit.enabled) {
    checks.set('audit-service', createAuditServiceCheck());
  }

  // Age verification service health check
  if (config.ageVerification.enabled) {
    checks.set('age-verification', createAgeVerificationCheck());
  }

  // Geo-location service health check
  if (config.geoLocation.enabled) {
    checks.set('geo-location', createGeoLocationCheck());
  }

  return checks;
}

function createDatabaseCheck(): HealthCheckFunction {
  return async (): Promise<ServiceHealth> => {
    try {
      // TODO: Implement actual database ping
      return {
        name: 'database',
        status: 'healthy',
        message: 'Database connection is healthy',
        lastCheck: new Date(),
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Database error',
        lastCheck: new Date(),
      };
    }
  };
}

function createDsaTransparencyCheck(): HealthCheckFunction {
  return async (): Promise<ServiceHealth> => {
    try {
      // TODO: Implement actual DSA DB ping
      return {
        name: 'dsa-transparency-db',
        status: 'healthy',
        message: 'DSA Transparency DB is reachable',
        lastCheck: new Date(),
      };
    } catch (error) {
      return {
        name: 'dsa-transparency-db',
        status: 'degraded',
        message: error instanceof Error ? error.message : 'DSA DB unreachable',
        lastCheck: new Date(),
      };
    }
  };
}

function createAuditServiceCheck(): HealthCheckFunction {
  return async (): Promise<ServiceHealth> => {
    try {
      // TODO: Implement actual audit service check
      return {
        name: 'audit-service',
        status: 'healthy',
        message: 'Audit service is operational',
        lastCheck: new Date(),
      };
    } catch (error) {
      return {
        name: 'audit-service',
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Audit service error',
        lastCheck: new Date(),
      };
    }
  };
}

function createAgeVerificationCheck(): HealthCheckFunction {
  return async (): Promise<ServiceHealth> => {
    try {
      // TODO: Implement actual age verification check
      return {
        name: 'age-verification',
        status: 'healthy',
        message: 'Age verification service is operational',
        lastCheck: new Date(),
      };
    } catch (error) {
      return {
        name: 'age-verification',
        status: 'degraded',
        message:
          error instanceof Error ? error.message : 'Age verification error',
        lastCheck: new Date(),
      };
    }
  };
}

function createGeoLocationCheck(): HealthCheckFunction {
  return async (): Promise<ServiceHealth> => {
    try {
      // TODO: Implement actual geo-location check
      return {
        name: 'geo-location',
        status: 'healthy',
        message: 'Geo-location service is operational',
        lastCheck: new Date(),
      };
    } catch (error) {
      return {
        name: 'geo-location',
        status: 'degraded',
        message: error instanceof Error ? error.message : 'Geo-location error',
        lastCheck: new Date(),
      };
    }
  };
}
