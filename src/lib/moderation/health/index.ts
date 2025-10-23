/**
 * Health Check Module
 *
 * Exports health check service and related types for monitoring
 * system health and service availability.
 */

export {
  createDefaultHealthChecks,
  getHealthCheckService,
  type HealthCheckFunction,
  HealthCheckService,
  type HealthStatus,
  resetHealthCheckService,
  type ServiceHealth,
  type SystemHealth,
} from './health-check-service';
