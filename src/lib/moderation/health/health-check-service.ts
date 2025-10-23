/**
 * Health Check Service
 *
 * Provides comprehensive health monitoring for all moderation services.
 * Implements health check endpoints for deployment validation and
 * operational monitoring.
 */

import type { ModerationConfig } from '../config/moderation-config';
import { createDefaultHealthChecks } from './health-check-defaults';

/**
 * Health status levels
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Service health check result
 */
export interface ServiceHealth {
  name: string;
  status: HealthStatus;
  message?: string;
  lastCheck: Date;
  responseTime?: number;
  details?: Record<string, unknown>;
}

/**
 * Overall system health result
 */
export interface SystemHealth {
  status: HealthStatus;
  timestamp: Date;
  services: ServiceHealth[];
  version: string;
  environment: string;
  uptime: number;
}

/**
 * Health check function type
 */
export type HealthCheckFunction = () => Promise<ServiceHealth>;

/**
 * Health Check Service
 */
export class HealthCheckService {
  private checks: Map<string, HealthCheckFunction> = new Map();
  private lastResults: Map<string, ServiceHealth> = new Map();
  private startTime: Date = new Date();

  constructor(private config: ModerationConfig) {}

  /**
   * Register a health check
   */
  registerCheck(name: string, checkFn: HealthCheckFunction): void {
    this.checks.set(name, checkFn);
  }

  /**
   * Unregister a health check
   */
  unregisterCheck(name: string): void {
    this.checks.delete(name);
    this.lastResults.delete(name);
  }

  /**
   * Run all health checks
   */
  async checkHealth(): Promise<SystemHealth> {
    const results: ServiceHealth[] = [];

    // Run all registered checks in parallel
    const checkPromises = Array.from(this.checks.entries()).map(
      async ([name, checkFn]) => {
        try {
          const startTime = Date.now();
          const result = await Promise.race([
            checkFn(),
            this.timeout(5000, name),
          ]);
          const responseTime = Date.now() - startTime;

          const health: ServiceHealth = {
            ...result,
            responseTime,
            lastCheck: new Date(),
          };

          this.lastResults.set(name, health);
          return health;
        } catch (error) {
          const health: ServiceHealth = {
            name,
            status: 'unhealthy',
            message: error instanceof Error ? error.message : 'Unknown error',
            lastCheck: new Date(),
          };

          this.lastResults.set(name, health);
          return health;
        }
      }
    );

    results.push(...(await Promise.all(checkPromises)));

    // Determine overall status
    const status = this.determineOverallStatus(results);

    return {
      status,
      timestamp: new Date(),
      services: results,
      version: this.getVersion(),
      environment: this.config.environment,
      uptime: Date.now() - this.startTime.getTime(),
    };
  }

  /**
   * Get last health check results
   */
  getLastResults(): SystemHealth {
    const results = Array.from(this.lastResults.values());
    const status = this.determineOverallStatus(results);

    return {
      status,
      timestamp: new Date(),
      services: results,
      version: this.getVersion(),
      environment: this.config.environment,
      uptime: Date.now() - this.startTime.getTime(),
    };
  }

  /**
   * Check if system is healthy
   */
  isHealthy(): boolean {
    const health = this.getLastResults();
    return health.status === 'healthy';
  }

  /**
   * Get service health
   */
  getServiceHealth(name: string): ServiceHealth | undefined {
    return this.lastResults.get(name);
  }

  /**
   * Determine overall system status
   */
  private determineOverallStatus(services: ServiceHealth[]): HealthStatus {
    if (services.length === 0) {
      return 'unhealthy';
    }

    const unhealthyCount = services.filter(
      (s) => s.status === 'unhealthy'
    ).length;
    const degradedCount = services.filter(
      (s) => s.status === 'degraded'
    ).length;

    // If any critical service is unhealthy, system is unhealthy
    if (unhealthyCount > 0) {
      return 'unhealthy';
    }

    // If any service is degraded, system is degraded
    if (degradedCount > 0) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Timeout helper
   */
  private async timeout(ms: number, name: string): Promise<ServiceHealth> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Health check timeout for ${name}`));
      }, ms);
    });
  }

  /**
   * Get application version
   */
  private getVersion(): string {
    return process.env.VERSION || '1.0.0';
  }
}

// createDefaultHealthChecks moved to health-check-defaults.ts
export { createDefaultHealthChecks } from './health-check-defaults';

/**
 * Singleton health check service
 */
let healthCheckServiceInstance: HealthCheckService | null = null;

/**
 * Get health check service instance
 */
export function getHealthCheckService(
  config: ModerationConfig
): HealthCheckService {
  if (!healthCheckServiceInstance) {
    healthCheckServiceInstance = new HealthCheckService(config);

    // Register default health checks
    const defaultChecks = createDefaultHealthChecks(config);
    defaultChecks.forEach((checkFn, name) => {
      healthCheckServiceInstance!.registerCheck(name, checkFn);
    });
  }

  return healthCheckServiceInstance;
}

/**
 * Reset health check service (for testing)
 */
export function resetHealthCheckService(): void {
  healthCheckServiceInstance = null;
}
