/**
 * Graceful Degradation Manager
 *
 * Implements graceful degradation strategies for non-critical functions:
 * - Feature toggles for degraded mode
 * - Fallback implementations
 * - Service health monitoring
 * - Automatic recovery detection
 *
 * Requirements: 10.4 (graceful degradation for non-critical functions)
 */

import { createDegradationStrategies } from './graceful-degradation-strategies';

// ============================================================================
// Types
// ============================================================================

export type ServiceStatus = 'healthy' | 'degraded' | 'unavailable';

export type FeatureFlag =
  | 'transparency_reporting'
  | 'age_verification'
  | 'geo_restrictions'
  | 'trusted_flagger_analytics'
  | 'ods_escalation'
  | 'notification_delivery'
  | 'audit_logging'
  | 'sla_monitoring';

export interface ServiceHealth {
  service: string;
  status: ServiceStatus;
  lastCheck: Date;
  errorCount: number;
  degradedSince?: Date;
  message?: string;
}

export interface DegradationStrategy {
  feature: FeatureFlag;
  isCritical: boolean;
  fallbackEnabled: boolean;
  fallbackImplementation?: () => Promise<unknown>;
  degradationMessage: string;
}

// ============================================================================
// Constants
// ============================================================================

const HEALTH_CHECK_INTERVAL_MS = 30000; // 30 seconds
const ERROR_THRESHOLD_FOR_DEGRADATION = 3;
// const RECOVERY_CHECK_INTERVAL_MS = 60000; // Reserved for future use

// ============================================================================
// Graceful Degradation Manager
// ============================================================================

export class GracefulDegradationManager {
  private serviceHealth: Map<string, ServiceHealth> = new Map();
  private degradationStrategies: Map<FeatureFlag, DegradationStrategy> =
    new Map();
  private healthCheckIntervals: Map<string, ReturnType<typeof setInterval>> =
    new Map();

  constructor() {
    this.degradationStrategies = createDegradationStrategies();
  }

  /**
   * Register a service for health monitoring.
   */
  registerService(serviceName: string): void {
    if (!this.serviceHealth.has(serviceName)) {
      this.serviceHealth.set(serviceName, {
        service: serviceName,
        status: 'healthy',
        lastCheck: new Date(),
        errorCount: 0,
      });

      // Start health check interval
      this.startHealthCheck(serviceName);
    }
  }

  /**
   * Record service error.
   */
  recordError(serviceName: string, error: Error): void {
    const health = this.serviceHealth.get(serviceName);

    if (!health) {
      this.registerService(serviceName);
      return this.recordError(serviceName, error);
    }

    health.errorCount++;
    health.lastCheck = new Date();
    health.message = error.message;

    // Check if service should be marked as degraded
    if (
      health.errorCount >= ERROR_THRESHOLD_FOR_DEGRADATION &&
      health.status === 'healthy'
    ) {
      this.markServiceDegraded(serviceName);
    }
  }

  /**
   * Record successful service operation.
   */
  recordSuccess(serviceName: string): void {
    const health = this.serviceHealth.get(serviceName);

    if (!health) {
      this.registerService(serviceName);
      return;
    }

    health.lastCheck = new Date();

    // Reset error count on success
    if (health.errorCount > 0) {
      health.errorCount = Math.max(0, health.errorCount - 1);
    }

    // Check if service can be marked as recovered
    if (health.errorCount === 0 && health.status === 'degraded') {
      this.markServiceHealthy(serviceName);
    }
  }

  /**
   * Mark service as degraded.
   */
  private markServiceDegraded(serviceName: string): void {
    const health = this.serviceHealth.get(serviceName);

    if (!health) return;

    health.status = 'degraded';
    health.degradedSince = new Date();

    console.warn(
      `Service ${serviceName} marked as DEGRADED after ${health.errorCount} errors`
    );

    // Notify monitoring systems
    this.notifyDegradation(serviceName);
  }

  /**
   * Mark service as healthy (recovered).
   */
  private markServiceHealthy(serviceName: string): void {
    const health = this.serviceHealth.get(serviceName);

    if (!health) return;

    const wasDegraded = health.status === 'degraded';
    health.status = 'healthy';
    health.errorCount = 0;
    health.degradedSince = undefined;
    health.message = undefined;

    if (wasDegraded) {
      console.log(`Service ${serviceName} RECOVERED and marked as HEALTHY`);
      this.notifyRecovery(serviceName);
    }
  }

  /**
   * Check if feature should use degraded mode.
   */
  shouldDegrade(feature: FeatureFlag): boolean {
    const strategy = this.degradationStrategies.get(feature);

    if (!strategy) return false;

    // Critical features should not degrade unless absolutely necessary
    if (strategy.isCritical) {
      return false;
    }

    // Check if related service is degraded
    const serviceName = this.getServiceNameForFeature(feature);
    const health = this.serviceHealth.get(serviceName);

    return health?.status === 'degraded' || health?.status === 'unavailable';
  }

  /**
   * Execute operation with graceful degradation.
   */
  async executeWithDegradation<T>(
    feature: FeatureFlag,
    operation: () => Promise<T>
  ): Promise<T> {
    const strategy = this.degradationStrategies.get(feature);

    if (!strategy) {
      return operation();
    }

    const serviceName = this.getServiceNameForFeature(feature);

    try {
      const result = await operation();
      this.recordSuccess(serviceName);
      return result;
    } catch (error) {
      this.recordError(
        serviceName,
        error instanceof Error ? error : new Error(String(error))
      );

      // Check if we should use fallback
      if (strategy.fallbackEnabled && strategy.fallbackImplementation) {
        console.log(
          `Using fallback for ${feature}: ${strategy.degradationMessage}`
        );
        return strategy.fallbackImplementation() as Promise<T>;
      }

      // Re-throw if no fallback available
      throw error;
    }
  }

  /**
   * Get service health status.
   */
  getServiceHealth(serviceName: string): ServiceHealth | undefined {
    return this.serviceHealth.get(serviceName);
  }

  /**
   * Get all service health statuses.
   */
  getAllServiceHealth(): ServiceHealth[] {
    return Array.from(this.serviceHealth.values());
  }

  /**
   * Get degradation strategy for feature.
   */
  getDegradationStrategy(
    feature: FeatureFlag
  ): DegradationStrategy | undefined {
    return this.degradationStrategies.get(feature);
  }

  /**
   * Start health check interval for service.
   */
  private startHealthCheck(serviceName: string): void {
    const interval = setInterval(() => {
      this.performHealthCheck(serviceName);
    }, HEALTH_CHECK_INTERVAL_MS);

    this.healthCheckIntervals.set(serviceName, interval);
  }

  /**
   * Perform health check for service.
   */
  private async performHealthCheck(serviceName: string): Promise<void> {
    const health = this.serviceHealth.get(serviceName);

    if (!health) return;

    // If service is degraded, check more frequently for recovery
    if (health.status === 'degraded') {
      // Implement recovery check logic here
      // This would typically ping the service or check metrics
    }
  }

  /**
   * Get service name for feature.
   */
  private getServiceNameForFeature(feature: FeatureFlag): string {
    const mapping: Record<FeatureFlag, string> = {
      transparency_reporting: 'dsa_transparency_db',
      age_verification: 'age_verification_service',
      geo_restrictions: 'geo_location_service',
      trusted_flagger_analytics: 'analytics_service',
      ods_escalation: 'ods_service',
      notification_delivery: 'notification_service',
      audit_logging: 'audit_service',
      sla_monitoring: 'sla_monitor_service',
    };

    return mapping[feature] || feature;
  }

  /**
   * Notify monitoring systems of degradation.
   */
  private notifyDegradation(serviceName: string): void {
    // Implement notification logic (e.g., send alert to monitoring system)
    console.warn(`ALERT: Service ${serviceName} is degraded`);
  }

  /**
   * Notify monitoring systems of recovery.
   */
  private notifyRecovery(serviceName: string): void {
    // Implement notification logic
    console.log(`RECOVERY: Service ${serviceName} has recovered`);
  }

  /**
   * Cleanup resources.
   */
  cleanup(): void {
    // Clear all health check intervals
    this.healthCheckIntervals.forEach((interval) => clearInterval(interval));
    this.healthCheckIntervals.clear();
  }
}

// Export singleton instance
export const gracefulDegradationManager = new GracefulDegradationManager();
